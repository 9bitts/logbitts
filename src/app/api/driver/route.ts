import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireSession } from "@/server/session";
import { id, todayISO } from "@/server/lib/ids";
import { saveProofFile } from "@/server/storage";

async function driverForUser(organizationId: string, userId: string) {
  const db = await getDb();
  const [drv] = await db
    .select()
    .from(schema.driver)
    .where(
      and(
        eq(schema.driver.organizationId, organizationId),
        eq(schema.driver.userId, userId),
      ),
    )
    .limit(1);
  return drv;
}

async function loadDriverRoute(routeId: string, organizationId: string) {
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

  const stopIds = stops.map((s) => s.stop.id);
  const proofs =
    stopIds.length === 0
      ? []
      : await db
          .select()
          .from(schema.proof)
          .where(
            and(
              eq(schema.proof.organizationId, organizationId),
              inArray(schema.proof.stopId, stopIds),
            ),
          );

  return {
    ...r,
    stops: stops.map((s) => ({
      ...s.stop,
      delivery: s.delivery,
      customer: s.customer,
      proofs: proofs.filter((p) => p.stopId === s.stop.id),
    })),
  };
}

export async function GET(req: Request) {
  try {
    const ctx = await requireSession();
    const url = new URL(req.url);
    const routeId = url.searchParams.get("id");
    const db = await getDb();

    const drv = await driverForUser(ctx.organizationId, ctx.user.id);
    // Dispatchers can also preview a route
    const driverId = drv?.id;

    if (routeId) {
      const detail = await loadDriverRoute(routeId, ctx.organizationId);
      if (!detail) return json({ error: "Rota não encontrada" }, 404);
      if (
        ctx.role === "driver" &&
        driverId &&
        detail.driverId &&
        detail.driverId !== driverId
      ) {
        return json({ error: "Rota de outro motorista" }, 403);
      }
      return json(detail);
    }

    const date = url.searchParams.get("date") || todayISO();
    let routes = await db
      .select()
      .from(schema.route)
      .where(
        and(
          eq(schema.route.organizationId, ctx.organizationId),
          eq(schema.route.routeDate, date),
        ),
      );

    routes = routes.filter((r) =>
      ["published", "in_progress", "completed"].includes(r.status),
    );
    if (ctx.role === "driver" && driverId) {
      routes = routes.filter((r) => r.driverId === driverId);
    }

    return json({ driver: drv, routes });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSession();
    const body = await req.json();
    const db = await getDb();
    const action = body.action as string;
    const stopId = body.stopId as string | undefined;
    const routeId = body.routeId as string;

    if (action === "start_route") {
      const [rt] = await db
        .select()
        .from(schema.route)
        .where(
          and(
            eq(schema.route.id, routeId),
            eq(schema.route.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!rt) return json({ error: "Rota não encontrada" }, 404);
      const drv = await driverForUser(ctx.organizationId, ctx.user.id);
      if (
        ctx.role === "driver" &&
        drv &&
        rt.driverId &&
        rt.driverId !== drv.id
      ) {
        return json({ error: "Rota de outro motorista" }, 403);
      }
      await db
        .update(schema.route)
        .set({
          status: "in_progress",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.route.id, routeId),
            eq(schema.route.organizationId, ctx.organizationId),
          ),
        );
      const firstStops = await db
        .select()
        .from(schema.stop)
        .where(eq(schema.stop.routeId, routeId))
        .orderBy(asc(schema.stop.sequence));
      if (firstStops[0]) {
        await db
          .update(schema.stop)
          .set({ status: "en_route" })
          .where(eq(schema.stop.id, firstStops[0].id));
      }
      return json(await loadDriverRoute(routeId, ctx.organizationId));
    }

    if (!stopId) return json({ error: "stopId obrigatório" }, 400);
    const [stp] = await db
      .select()
      .from(schema.stop)
      .where(
        and(
          eq(schema.stop.id, stopId),
          eq(schema.stop.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    if (!stp) return json({ error: "Parada não encontrada" }, 404);

    const lat = body.lat != null ? Number(body.lat) : null;
    const lng = body.lng != null ? Number(body.lng) : null;

    if (action === "arrive") {
      await db
        .update(schema.stop)
        .set({ status: "arrived", arrivedAt: new Date() })
        .where(eq(schema.stop.id, stopId));
      await db.insert(schema.stopEvent).values({
        id: id("evt"),
        organizationId: ctx.organizationId,
        stopId,
        type: "arrived",
        lat,
        lng,
        notes: null,
        createdAt: new Date(),
      });
    } else if (action === "deliver") {
      let photoUrl: string | null = null;
      let signatureUrl: string | null = null;
      if (body.photoDataUrl) {
        photoUrl = await saveProofFile(
          ctx.organizationId,
          body.photoDataUrl,
          "photo",
        );
      }
      if (body.signatureDataUrl) {
        signatureUrl = await saveProofFile(
          ctx.organizationId,
          body.signatureDataUrl,
          "signature",
        );
      }
      await db.insert(schema.proof).values({
        id: id("prf"),
        organizationId: ctx.organizationId,
        stopId,
        photoUrl,
        signatureUrl,
        recipientName: body.recipientName || null,
        lat,
        lng,
        capturedAt: new Date(),
        createdAt: new Date(),
      });
      await db
        .update(schema.stop)
        .set({ status: "delivered", completedAt: new Date() })
        .where(eq(schema.stop.id, stopId));
      await db
        .update(schema.delivery)
        .set({ status: "delivered", updatedAt: new Date() })
        .where(eq(schema.delivery.id, stp.deliveryId));
      await db.insert(schema.stopEvent).values({
        id: id("evt"),
        organizationId: ctx.organizationId,
        stopId,
        type: "delivered",
        lat,
        lng,
        notes: body.notes || null,
        createdAt: new Date(),
      });
      // advance next stop
      const stops = await db
        .select()
        .from(schema.stop)
        .where(eq(schema.stop.routeId, stp.routeId))
        .orderBy(asc(schema.stop.sequence));
      const next = stops.find(
        (s) => s.sequence > stp.sequence && s.status === "pending",
      );
      if (next) {
        await db
          .update(schema.stop)
          .set({ status: "en_route" })
          .where(eq(schema.stop.id, next.id));
      } else {
        const remaining = stops.filter(
          (s) =>
            s.id !== stopId && !["delivered", "failed"].includes(s.status),
        );
        if (!remaining.length) {
          await db
            .update(schema.route)
            .set({
              status: "completed",
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.route.id, stp.routeId));
        }
      }
    } else if (action === "fail") {
      await db
        .update(schema.stop)
        .set({
          status: "failed",
          completedAt: new Date(),
          failureReason: body.reason || "Ocorrência",
          occurrenceNotes: body.notes || null,
        })
        .where(eq(schema.stop.id, stopId));
      await db
        .update(schema.delivery)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(schema.delivery.id, stp.deliveryId));
      await db.insert(schema.stopEvent).values({
        id: id("evt"),
        organizationId: ctx.organizationId,
        stopId,
        type: "failed",
        lat,
        lng,
        notes: body.notes || body.reason || null,
        createdAt: new Date(),
      });
      const stops = await db
        .select()
        .from(schema.stop)
        .where(eq(schema.stop.routeId, stp.routeId))
        .orderBy(asc(schema.stop.sequence));
      const next = stops.find(
        (s) => s.sequence > stp.sequence && s.status === "pending",
      );
      if (next) {
        await db
          .update(schema.stop)
          .set({ status: "en_route" })
          .where(eq(schema.stop.id, next.id));
      }
    } else if (action === "sync_batch") {
      // offline queue replay — body.events[]
      return json({ ok: true, note: "use individual actions" });
    } else {
      return json({ error: "action inválida" }, 400);
    }

    return json(await loadDriverRoute(stp.routeId, ctx.organizationId));
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
