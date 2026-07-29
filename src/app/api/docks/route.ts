import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const db = await getDb();
    const rows = await db
      .select({
        dock: schema.dock,
        warehouse: schema.warehouse,
      })
      .from(schema.dock)
      .innerJoin(
        schema.warehouse,
        eq(schema.dock.warehouseId, schema.warehouse.id),
      )
      .where(eq(schema.dock.organizationId, ctx.organizationId))
      .orderBy(asc(schema.dock.code));
    return json(rows.map((r) => ({ ...r.dock, warehouse: r.warehouse })));
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
        id: id("dock"),
        organizationId: ctx.organizationId,
        warehouseId,
        code: String(body.code || "").trim().toUpperCase(),
        name: String(body.name || body.code || "Dock"),
        type: body.type || "both",
        status: body.status || "free",
        active: body.active !== false,
        createdAt: new Date(),
      };
      if (!row.code) return json({ error: "code obrigatório" }, 400);
      await db.insert(schema.dock).values(row);
      return json(row, 201);
    }

    if (action === "update_status") {
      await db
        .update(schema.dock)
        .set({ status: body.status, active: body.active ?? undefined })
        .where(
          and(
            eq(schema.dock.id, body.id),
            eq(schema.dock.organizationId, ctx.organizationId),
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
