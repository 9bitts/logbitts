import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireWarehouse } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET() {
  try {
    const ctx = await requireWarehouse();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.product)
      .where(eq(schema.product.organizationId, ctx.organizationId))
      .orderBy(desc(schema.product.createdAt));
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
      id: id("prd"),
      organizationId: ctx.organizationId,
      sku: String(body.sku || "").trim().toUpperCase(),
      name: String(body.name || "").trim(),
      barcode: body.barcode || null,
      unit: body.unit || "UN",
      weightKg: body.weightKg != null ? Number(body.weightKg) : 0,
      volumeM3: body.volumeM3 != null ? Number(body.volumeM3) : 0,
      active: body.active !== false,
      createdAt: new Date(),
    };
    if (!row.sku || !row.name) return json({ error: "SKU e nome obrigatórios" }, 400);
    await db.insert(schema.product).values(row);
    return json(row, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const body = await req.json();
    if (!body.id) return json({ error: "id obrigatório" }, 400);
    const db = await getDb();
    await db
      .update(schema.product)
      .set({
        name: body.name,
        barcode: body.barcode,
        unit: body.unit,
        weightKg: body.weightKg != null ? Number(body.weightKg) : undefined,
        volumeM3: body.volumeM3 != null ? Number(body.volumeM3) : undefined,
        active: body.active,
      })
      .where(
        and(
          eq(schema.product.id, body.id),
          eq(schema.product.organizationId, ctx.organizationId),
        ),
      );
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
