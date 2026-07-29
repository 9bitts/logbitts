import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id, todayISO } from "@/server/lib/ids";
import { optimizeSequence } from "@/server/routing/optimize";

async function loadRouteDetail(routeId: string, organizationId: string) {
  const db = await getDb();
  const [r] = await db
    .select()
    .from(schema.route)
    .where(
      and(
        eq(schema.route.id, routeId),
        eq(schema.route.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!r) return null;

  const stops = await db
    .select({
      stop: schema.stop,
      delivery: schema.delivery,
      customer: schema.customer,
    })
    .from(schema.stop)
    .innerJoin(schema.delivery, eq(schema.stop.deliveryId, schema.delivery.id))
    .innerJoin(
      schema.customer,
      eq(schema.delivery.customerId, schema.customer.id),
    )
    .where(eq(schema.stop.routeId, routeId))
    .orderBy(asc(schema.stop.sequence));

  let driver = null;
  let vehicle = null;
  if (r.driverId) {
    [driver] = await db
      .select()
      .from(schema.driver)
      .where(eq(schema.driver.id, r.driverId))
      .limit(1);
  }
  if (r.vehicleId) {
    [vehicle] = await db
      .select()
      .from(schema.vehicle)
      .where(eq(schema.vehicle.id, r.vehicleId))
      .limit(1);
  }

  return {
    ...r,
    driver,
    vehicle,
    stops: stops.map((s) => ({
      ...s.stop,
      delivery: s.delivery,
      customer: s.customer,
    })),
  };
}

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const routeId = url.searchParams.get("id");
    const date = url.searchParams.get("date");
    const db = await getDb();

    if (routeId) {
      const detail = await loadRouteDetail(routeId, ctx.organizationId);
      if (!detail) return json({ error: "Rota não encontrada" }, 404);
      return json(detail);
    }

    let routes = await db
      .select()
      .from(schema.route)
      .where(eq(schema.route.organizationId, ctx.organizationId))
      .orderBy(desc(schema.route.routeDate), desc(schema.route.createdAt));

    if (date) routes = routes.filter((r) => r.routeDate === date);
    return json(routes);
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
    const deliveryIds: string[] = body.deliveryIds || [];
    const routeDate = body.routeDate || todayISO();

    const routeRow = {
      id: id("rte"),
      organizationId: ctx.organizationId,
      name: body.name || `Rota ${routeDate}`,
      routeDate,
      driverId: body.driverId || null,
      vehicleId: body.vehicleId || null,
      status: "draft",
      depotLat: body.depotLat != null ? Number(body.depotLat) : -23.5505,
      depotLng: body.depotLng != null ? Number(body.depotLng) : -46.6333,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(schema.route).values(routeRow);

    if (deliveryIds.length) {
      const deliveries = await db
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
            eq(schema.delivery.organizationId, ctx.organizationId),
            inArray(schema.delivery.id, deliveryIds),
          ),
        );

      const order =
        body.optimize !== false
          ? optimizeSequence(
              deliveries.map((d) => ({
                id: d.delivery.id,
                lat: d.customer.lat ?? 0,
                lng: d.customer.lng ?? 0,
                zip: d.customer.zip,
                weightKg: d.delivery.weightKg,
                volumeM3: d.delivery.volumeM3,
              })),
              { lat: routeRow.depotLat!, lng: routeRow.depotLng! },
            )
          : deliveryIds;

      let seq = 1;
      for (const deliveryId of order) {
        const found = deliveries.find((d) => d.delivery.id === deliveryId);
        if (!found) continue;
        await db.insert(schema.stop).values({
          id: id("stp"),
          organizationId: ctx.organizationId,
          routeId: routeRow.id,
          deliveryId,
          sequence: seq++,
          status: "pending",
          etaMinutes: null,
          arrivedAt: null,
          completedAt: null,
          failureReason: null,
          occurrenceNotes: null,
          createdAt: new Date(),
        });
        await db
          .update(schema.delivery)
          .set({ status: "assigned", updatedAt: new Date() })
          .where(eq(schema.delivery.id, deliveryId));
      }
    }

    const detail = await loadRouteDetail(routeRow.id, ctx.organizationId);
    return json(detail, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const body = await req.json();
    const db = await getDb();
    if (!body.id) return json({ error: "id obrigatório" }, 400);

    const action = body.action as string | undefined;

    if (action === "reorder") {
      const stopIds: string[] = body.stopIds || [];
      for (let i = 0; i < stopIds.length; i++) {
        await db
          .update(schema.stop)
          .set({ sequence: i + 1 })
          .where(
            and(
              eq(schema.stop.id, stopIds[i]),
              eq(schema.stop.organizationId, ctx.organizationId),
            ),
          );
      }
    } else if (action === "optimize") {
      const detail = await loadRouteDetail(body.id, ctx.organizationId);
      if (!detail) return json({ error: "Rota não encontrada" }, 404);
      const ordered = optimizeSequence(
        detail.stops.map((s) => ({
          id: s.id,
          lat: s.customer.lat ?? 0,
          lng: s.customer.lng ?? 0,
          zip: s.customer.zip,
        })),
        {
          lat: detail.depotLat ?? -23.55,
          lng: detail.depotLng ?? -46.63,
        },
      );
      for (let i = 0; i < ordered.length; i++) {
        await db
          .update(schema.stop)
          .set({ sequence: i + 1 })
          .where(eq(schema.stop.id, ordered[i]));
      }
    } else if (action === "publish") {
      await db
        .update(schema.route)
        .set({ status: "published", updatedAt: new Date() })
        .where(
          and(
            eq(schema.route.id, body.id),
            eq(schema.route.organizationId, ctx.organizationId),
          ),
        );
    } else if (action === "assign") {
      await db
        .update(schema.route)
        .set({
          driverId: body.driverId ?? undefined,
          vehicleId: body.vehicleId ?? undefined,
          name: body.name ?? undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.route.id, body.id),
            eq(schema.route.organizationId, ctx.organizationId),
          ),
        );
    } else if (action === "addStops") {
      const deliveryIds: string[] = body.deliveryIds || [];
      const existing = await db
        .select()
        .from(schema.stop)
        .where(eq(schema.stop.routeId, body.id));
      let seq = existing.length + 1;
      for (const deliveryId of deliveryIds) {
        await db.insert(schema.stop).values({
          id: id("stp"),
          organizationId: ctx.organizationId,
          routeId: body.id,
          deliveryId,
          sequence: seq++,
          status: "pending",
          etaMinutes: null,
          arrivedAt: null,
          completedAt: null,
          failureReason: null,
          occurrenceNotes: null,
          createdAt: new Date(),
        });
        await db
          .update(schema.delivery)
          .set({ status: "assigned", updatedAt: new Date() })
          .where(eq(schema.delivery.id, deliveryId));
      }
    }

    const detail = await loadRouteDetail(body.id, ctx.organizationId);
    return json(detail);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
