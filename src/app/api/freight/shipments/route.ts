import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const shipmentId = new URL(req.url).searchParams.get("id");
    const db = await getDb();

    if (shipmentId) {
      const [row] = await db
        .select({
          shipment: schema.freightShipment,
          carrier: schema.carrier,
          quote: schema.freightQuote,
          delivery: schema.delivery,
        })
        .from(schema.freightShipment)
        .innerJoin(
          schema.carrier,
          eq(schema.freightShipment.carrierId, schema.carrier.id),
        )
        .leftJoin(
          schema.freightQuote,
          eq(schema.freightShipment.quoteId, schema.freightQuote.id),
        )
        .leftJoin(
          schema.delivery,
          eq(schema.freightShipment.deliveryId, schema.delivery.id),
        )
        .where(
          and(
            eq(schema.freightShipment.id, shipmentId),
            eq(schema.freightShipment.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!row) return json({ error: "Não encontrado" }, 404);
      const ctes = await db
        .select()
        .from(schema.cteDocument)
        .where(eq(schema.cteDocument.shipmentId, shipmentId));
      return json({ ...row.shipment, carrier: row.carrier, quote: row.quote, delivery: row.delivery, ctes });
    }

    const rows = await db
      .select({
        shipment: schema.freightShipment,
        carrier: schema.carrier,
      })
      .from(schema.freightShipment)
      .innerJoin(
        schema.carrier,
        eq(schema.freightShipment.carrierId, schema.carrier.id),
      )
      .where(eq(schema.freightShipment.organizationId, ctx.organizationId))
      .orderBy(desc(schema.freightShipment.bookedAt));

    return json(rows.map((r) => ({ ...r.shipment, carrier: r.carrier })));
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

    if (!action || action === "book") {
      let carrierId = body.carrierId as string | undefined;
      let expectedAmount = Number(body.expectedAmount || 0);
      let quoteId = body.quoteId || null;

      if (quoteId) {
        const [q] = await db
          .select()
          .from(schema.freightQuote)
          .where(
            and(
              eq(schema.freightQuote.id, quoteId),
              eq(schema.freightQuote.organizationId, ctx.organizationId),
            ),
          )
          .limit(1);
        if (!q) return json({ error: "Cotação não encontrada" }, 404);
        carrierId = q.carrierId || carrierId;
        expectedAmount = q.amount;
        await db
          .update(schema.freightQuote)
          .set({ status: "selected" })
          .where(eq(schema.freightQuote.id, q.id));
      }

      if (!carrierId) return json({ error: "carrierId ou quoteId obrigatório" }, 400);

      const row = {
        id: id("fsh"),
        organizationId: ctx.organizationId,
        carrierId,
        quoteId,
        deliveryId: body.deliveryId || null,
        routeId: body.routeId || null,
        externalCode: body.externalCode || `EMB-${Date.now().toString().slice(-6)}`,
        expectedAmount,
        status: "booked",
        trackingCode: body.trackingCode || null,
        bookedAt: new Date(),
        deliveredAt: null,
        notes: body.notes || null,
      };
      await db.insert(schema.freightShipment).values(row);
      return json(row, 201);
    }

    if (action === "update_status") {
      await db
        .update(schema.freightShipment)
        .set({
          status: body.status,
          trackingCode: body.trackingCode ?? undefined,
          deliveredAt: body.status === "delivered" ? new Date() : undefined,
        })
        .where(
          and(
            eq(schema.freightShipment.id, body.id),
            eq(schema.freightShipment.organizationId, ctx.organizationId),
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
