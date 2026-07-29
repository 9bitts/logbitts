import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";
import { emitDomainEvent } from "@/server/events/emit";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const status = new URL(req.url).searchParams.get("status");
    const db = await getDb();
    let rows = await db
      .select({
        offer: schema.loadOffer,
        delivery: schema.delivery,
      })
      .from(schema.loadOffer)
      .leftJoin(
        schema.delivery,
        eq(schema.loadOffer.deliveryId, schema.delivery.id),
      )
      .where(eq(schema.loadOffer.organizationId, ctx.organizationId))
      .orderBy(desc(schema.loadOffer.createdAt));
    if (status) rows = rows.filter((r) => r.offer.status === status);

    const bids = await db
      .select({
        bid: schema.loadBid,
        carrier: schema.carrier,
      })
      .from(schema.loadBid)
      .innerJoin(schema.carrier, eq(schema.loadBid.carrierId, schema.carrier.id))
      .where(eq(schema.loadBid.organizationId, ctx.organizationId));

    return json(
      rows.map((r) => ({
        ...r.offer,
        delivery: r.delivery,
        bids: bids
          .filter((b) => b.bid.offerId === r.offer.id)
          .map((b) => ({ ...b.bid, carrier: b.carrier })),
      })),
    );
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const body = await req.json();
    const db = await getDb();
    const action = body.action as string | undefined;

    if (!action || action === "create") {
      let originCity = body.originCity || "São Paulo";
      let originState = body.originState || "SP";
      let destCity = body.destCity || "";
      let destState = body.destState || "";
      let weightKg = Number(body.weightKg || 0);
      let volumeM3 = Number(body.volumeM3 || 0);
      let deliveryId = body.deliveryId || null;

      if (deliveryId) {
        const [row] = await db
          .select({
            delivery: schema.delivery,
            customer: schema.customer,
          })
          .from(schema.delivery)
          .innerJoin(
            schema.customer,
            eq(schema.delivery.customerId, schema.customer.id),
          )
          .where(
            and(
              eq(schema.delivery.id, deliveryId),
              eq(schema.delivery.organizationId, ctx.organizationId),
            ),
          )
          .limit(1);
        if (row) {
          destCity = row.customer.city;
          destState = row.customer.state;
          weightKg = row.delivery.weightKg || weightKg;
          volumeM3 = row.delivery.volumeM3 || volumeM3;
        }
      }

      if (!destCity || !destState) {
        return json({ error: "Destino obrigatório" }, 400);
      }

      const offer = {
        id: id("lof"),
        organizationId: ctx.organizationId,
        deliveryId,
        shipmentId: null,
        originCity,
        originState,
        destCity,
        destState,
        weightKg,
        volumeM3,
        priceAsk: body.priceAsk != null ? Number(body.priceAsk) : null,
        status: "open",
        notes: body.notes || null,
        createdAt: new Date(),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      };
      await db.insert(schema.loadOffer).values(offer);
      await emitDomainEvent({
        organizationId: ctx.organizationId,
        eventType: "marketplace.offer.created",
        entityType: "load_offer",
        entityId: offer.id,
        payload: { destState, weightKg },
      });
      return json(offer, 201);
    }

    if (action === "bid") {
      const bid = {
        id: id("lbd"),
        organizationId: ctx.organizationId,
        offerId: body.offerId,
        carrierId: body.carrierId,
        amount: Number(body.amount),
        transitDays: body.transitDays != null ? Number(body.transitDays) : 2,
        status: "open",
        notes: body.notes || null,
        createdAt: new Date(),
      };
      if (!bid.offerId || !bid.carrierId || !bid.amount) {
        return json({ error: "offerId, carrierId e amount obrigatórios" }, 400);
      }
      await db.insert(schema.loadBid).values(bid);
      await db
        .update(schema.loadOffer)
        .set({ status: "bidding" })
        .where(eq(schema.loadOffer.id, bid.offerId));
      return json(bid, 201);
    }

    if (action === "accept_bid") {
      const [bid] = await db
        .select()
        .from(schema.loadBid)
        .where(
          and(
            eq(schema.loadBid.id, body.bidId),
            eq(schema.loadBid.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!bid) return json({ error: "Lance não encontrado" }, 404);
      const [offer] = await db
        .select()
        .from(schema.loadOffer)
        .where(eq(schema.loadOffer.id, bid.offerId))
        .limit(1);
      if (!offer) return json({ error: "Oferta não encontrada" }, 404);

      const shipment = {
        id: id("fsh"),
        organizationId: ctx.organizationId,
        carrierId: bid.carrierId,
        quoteId: null,
        deliveryId: offer.deliveryId,
        routeId: null,
        externalCode: `MKT-${Date.now().toString().slice(-6)}`,
        expectedAmount: bid.amount,
        status: "booked",
        trackingCode: null,
        bookedAt: new Date(),
        deliveredAt: null,
        notes: `Marketplace bid ${bid.id}`,
      };
      await db.insert(schema.freightShipment).values(shipment);
      await db
        .update(schema.loadBid)
        .set({ status: "accepted" })
        .where(eq(schema.loadBid.id, bid.id));
      await db
        .update(schema.loadBid)
        .set({ status: "rejected" })
        .where(
          and(
            eq(schema.loadBid.offerId, offer.id),
            eq(schema.loadBid.status, "open"),
          ),
        );
      await db
        .update(schema.loadOffer)
        .set({ status: "awarded", shipmentId: shipment.id })
        .where(eq(schema.loadOffer.id, offer.id));
      await emitDomainEvent({
        organizationId: ctx.organizationId,
        eventType: "marketplace.offer.awarded",
        entityType: "load_offer",
        entityId: offer.id,
        payload: { bidId: bid.id, shipmentId: shipment.id, amount: bid.amount },
      });
      return json({ offerId: offer.id, shipment });
    }

    if (action === "cancel") {
      await db
        .update(schema.loadOffer)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(schema.loadOffer.id, body.id),
            eq(schema.loadOffer.organizationId, ctx.organizationId),
          ),
        );
      return json({ ok: true });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
