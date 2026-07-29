import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id, todayISO } from "@/server/lib/ids";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || todayISO();
    const warehouseId = url.searchParams.get("warehouseId");
    const db = await getDb();
    let rows = await db
      .select({
        appointment: schema.yardAppointment,
        dock: schema.dock,
        carrier: schema.carrier,
        warehouse: schema.warehouse,
      })
      .from(schema.yardAppointment)
      .innerJoin(
        schema.warehouse,
        eq(schema.yardAppointment.warehouseId, schema.warehouse.id),
      )
      .leftJoin(schema.dock, eq(schema.yardAppointment.dockId, schema.dock.id))
      .leftJoin(
        schema.carrier,
        eq(schema.yardAppointment.carrierId, schema.carrier.id),
      )
      .where(
        and(
          eq(schema.yardAppointment.organizationId, ctx.organizationId),
          eq(schema.yardAppointment.scheduledDate, date),
        ),
      )
      .orderBy(asc(schema.yardAppointment.windowStart));
    if (warehouseId) {
      rows = rows.filter((r) => r.appointment.warehouseId === warehouseId);
    }

    return json(
      rows.map((r) => ({
        ...r.appointment,
        dock: r.dock,
        carrier: r.carrier,
        warehouse: r.warehouse,
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
      let warehouseId = body.warehouseId as string | undefined;
      if (!warehouseId) {
        const [wh] = await db
          .select()
          .from(schema.warehouse)
          .where(eq(schema.warehouse.organizationId, ctx.organizationId))
          .limit(1);
        if (!wh) return json({ error: "Sem depósito" }, 400);
        warehouseId = wh.id;
      }

      const row = {
        id: id("yap"),
        organizationId: ctx.organizationId,
        warehouseId,
        dockId: body.dockId || null,
        type: body.type || "inbound",
        status: body.status || "scheduled",
        scheduledDate: body.scheduledDate || todayISO(),
        windowStart: body.windowStart || "08:00",
        windowEnd: body.windowEnd || "09:00",
        carrierId: body.carrierId || null,
        vehiclePlate: body.vehiclePlate
          ? String(body.vehiclePlate).toUpperCase()
          : null,
        driverName: body.driverName || null,
        driverDocument: body.driverDocument || null,
        receiptId: body.receiptId || null,
        shipmentId: body.shipmentId || null,
        routeId: body.routeId || null,
        notes: body.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(schema.yardAppointment).values(row);
      return json(row, 201);
    }

    if (action === "update_status") {
      await db
        .update(schema.yardAppointment)
        .set({
          status: body.status,
          dockId: body.dockId !== undefined ? body.dockId : undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.yardAppointment.id, body.id),
            eq(schema.yardAppointment.organizationId, ctx.organizationId),
          ),
        );
      return json({ ok: true });
    }

    if (action === "assign_dock") {
      const dockId = body.dockId as string;
      await db
        .update(schema.yardAppointment)
        .set({
          dockId,
          status: body.status || "confirmed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.yardAppointment.id, body.id),
            eq(schema.yardAppointment.organizationId, ctx.organizationId),
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
