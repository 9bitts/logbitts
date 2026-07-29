import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const onSite = new URL(req.url).searchParams.get("onSite") === "1";
    const db = await getDb();

    let rows;
    if (onSite) {
      rows = await db
        .select({
          visit: schema.yardVisit,
          dock: schema.dock,
          appointment: schema.yardAppointment,
        })
        .from(schema.yardVisit)
        .leftJoin(schema.dock, eq(schema.yardVisit.dockId, schema.dock.id))
        .leftJoin(
          schema.yardAppointment,
          eq(schema.yardVisit.appointmentId, schema.yardAppointment.id),
        )
        .where(
          and(
            eq(schema.yardVisit.organizationId, ctx.organizationId),
            inArray(schema.yardVisit.status, ["on_site", "at_dock"]),
          ),
        )
        .orderBy(desc(schema.yardVisit.checkedInAt));
    } else {
      rows = await db
        .select({
          visit: schema.yardVisit,
          dock: schema.dock,
          appointment: schema.yardAppointment,
        })
        .from(schema.yardVisit)
        .leftJoin(schema.dock, eq(schema.yardVisit.dockId, schema.dock.id))
        .leftJoin(
          schema.yardAppointment,
          eq(schema.yardVisit.appointmentId, schema.yardAppointment.id),
        )
        .where(eq(schema.yardVisit.organizationId, ctx.organizationId))
        .orderBy(desc(schema.yardVisit.checkedInAt));
    }

    return json(
      rows.map((r) => ({
        ...r.visit,
        dock: r.dock,
        appointment: r.appointment,
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

    if (!action || action === "check_in") {
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

      const plate = String(body.vehiclePlate || "")
        .trim()
        .toUpperCase();
      if (!plate) return json({ error: "Placa obrigatória" }, 400);

      let appointmentId = body.appointmentId || null;
      if (!appointmentId && body.appointmentId !== null) {
        // auto-match open appointment by plate today
        const today = new Date().toISOString().slice(0, 10);
        const [match] = await db
          .select()
          .from(schema.yardAppointment)
          .where(
            and(
              eq(schema.yardAppointment.organizationId, ctx.organizationId),
              eq(schema.yardAppointment.scheduledDate, today),
              eq(schema.yardAppointment.vehiclePlate, plate),
            ),
          )
          .limit(1);
        if (match && !["done", "cancelled", "no_show"].includes(match.status)) {
          appointmentId = match.id;
        }
      }

      const dockId = body.dockId || null;
      const now = new Date();
      const visit = {
        id: id("yvi"),
        organizationId: ctx.organizationId,
        appointmentId,
        warehouseId,
        dockId,
        vehiclePlate: plate,
        driverName: body.driverName || null,
        status: dockId ? "at_dock" : "on_site",
        checkedInAt: now,
        dockAssignedAt: dockId ? now : null,
        checkedOutAt: null,
        waitMinutes: null,
        notes: body.notes || null,
      };
      await db.insert(schema.yardVisit).values(visit);

      if (appointmentId) {
        await db
          .update(schema.yardAppointment)
          .set({
            status: dockId ? "at_dock" : "checked_in",
            dockId: dockId || undefined,
            vehiclePlate: plate,
            driverName: body.driverName || undefined,
            updatedAt: now,
          })
          .where(eq(schema.yardAppointment.id, appointmentId));
      }
      if (dockId) {
        await db
          .update(schema.dock)
          .set({ status: "occupied" })
          .where(eq(schema.dock.id, dockId));
      }

      return json(visit, 201);
    }

    if (action === "assign_dock") {
      const now = new Date();
      await db
        .update(schema.yardVisit)
        .set({
          dockId: body.dockId,
          status: "at_dock",
          dockAssignedAt: now,
        })
        .where(
          and(
            eq(schema.yardVisit.id, body.id),
            eq(schema.yardVisit.organizationId, ctx.organizationId),
          ),
        );
      await db
        .update(schema.dock)
        .set({ status: "occupied" })
        .where(eq(schema.dock.id, body.dockId));

      const [visit] = await db
        .select()
        .from(schema.yardVisit)
        .where(eq(schema.yardVisit.id, body.id))
        .limit(1);
      if (visit?.appointmentId) {
        await db
          .update(schema.yardAppointment)
          .set({
            dockId: body.dockId,
            status: "at_dock",
            updatedAt: now,
          })
          .where(eq(schema.yardAppointment.id, visit.appointmentId));
      }
      return json({ ok: true });
    }

    if (action === "check_out") {
      const [visit] = await db
        .select()
        .from(schema.yardVisit)
        .where(
          and(
            eq(schema.yardVisit.id, body.id),
            eq(schema.yardVisit.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!visit) return json({ error: "Visita não encontrada" }, 404);

      const now = new Date();
      const waitMinutes = Math.max(
        0,
        Math.round((now.getTime() - visit.checkedInAt.getTime()) / 60000),
      );

      await db
        .update(schema.yardVisit)
        .set({
          status: "departed",
          checkedOutAt: now,
          waitMinutes,
        })
        .where(eq(schema.yardVisit.id, visit.id));

      if (visit.dockId) {
        // free dock only if no other on-site visit uses it
        const others = await db
          .select()
          .from(schema.yardVisit)
          .where(
            and(
              eq(schema.yardVisit.dockId, visit.dockId),
              inArray(schema.yardVisit.status, ["on_site", "at_dock"]),
            ),
          );
        const still = others.filter((v) => v.id !== visit.id);
        if (!still.length) {
          await db
            .update(schema.dock)
            .set({ status: "free" })
            .where(eq(schema.dock.id, visit.dockId));
        }
      }

      if (visit.appointmentId) {
        await db
          .update(schema.yardAppointment)
          .set({ status: "done", updatedAt: now })
          .where(eq(schema.yardAppointment.id, visit.appointmentId));
      }

      return json({ ok: true, waitMinutes });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
