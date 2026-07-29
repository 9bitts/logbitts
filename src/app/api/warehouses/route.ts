import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireWarehouse } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET() {
  try {
    const ctx = await requireWarehouse();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.warehouse)
      .where(eq(schema.warehouse.organizationId, ctx.organizationId))
      .orderBy(desc(schema.warehouse.createdAt));
    return json(rows);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireWarehouse();
    if (ctx.role === "warehouse") {
      return json({ error: "Sem permissão para criar CD" }, 403);
    }
    const body = await req.json();
    const db = await getDb();
    const row = {
      id: id("wh"),
      organizationId: ctx.organizationId,
      name: String(body.name || "").trim(),
      code: body.code ? String(body.code).trim().toUpperCase() : null,
      address: body.address || null,
      lat: body.lat != null ? Number(body.lat) : null,
      lng: body.lng != null ? Number(body.lng) : null,
      active: body.active !== false,
      createdAt: new Date(),
    };
    if (!row.name) return json({ error: "Nome obrigatório" }, 400);
    await db.insert(schema.warehouse).values(row);
    return json(row, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireWarehouse();
    if (ctx.role === "warehouse") {
      return json({ error: "Sem permissão" }, 403);
    }
    const body = await req.json();
    if (!body.id) return json({ error: "id obrigatório" }, 400);
    const db = await getDb();
    await db
      .update(schema.warehouse)
      .set({
        name: body.name,
        code: body.code,
        address: body.address,
        active: body.active,
        lat: body.lat != null ? Number(body.lat) : undefined,
        lng: body.lng != null ? Number(body.lng) : undefined,
      })
      .where(eq(schema.warehouse.id, body.id));
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
