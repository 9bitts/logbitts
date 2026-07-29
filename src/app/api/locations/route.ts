import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireWarehouse } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const warehouseId = new URL(req.url).searchParams.get("warehouseId");
    const db = await getDb();
    let rows = await db
      .select()
      .from(schema.location)
      .where(eq(schema.location.organizationId, ctx.organizationId))
      .orderBy(desc(schema.location.createdAt));
    if (warehouseId) rows = rows.filter((r) => r.warehouseId === warehouseId);
    return json(rows);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const body = await req.json();
    const db = await getDb();
    const row = {
      id: id("loc"),
      organizationId: ctx.organizationId,
      warehouseId: String(body.warehouseId),
      code: String(body.code || "").trim().toUpperCase(),
      type: body.type || "storage",
      createdAt: new Date(),
    };
    if (!row.warehouseId || !row.code) {
      return json({ error: "warehouseId e code obrigatórios" }, 400);
    }
    await db.insert(schema.location).values(row);
    return json(row, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
