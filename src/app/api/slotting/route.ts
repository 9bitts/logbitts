import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";
import { suggestPutaway } from "@/server/slotting/suggest";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const db = await getDb();

    if (url.searchParams.get("suggest") === "1") {
      const warehouseId = url.searchParams.get("warehouseId");
      if (!warehouseId) return json({ error: "warehouseId obrigatório" }, 400);
      const suggestions = await suggestPutaway({
        organizationId: ctx.organizationId,
        warehouseId,
        sku: url.searchParams.get("sku"),
        weightKg: url.searchParams.get("weightKg")
          ? Number(url.searchParams.get("weightKg"))
          : null,
        qty: url.searchParams.get("qty")
          ? Number(url.searchParams.get("qty"))
          : null,
      });
      return json(suggestions);
    }

    const rows = await db
      .select()
      .from(schema.slottingRule)
      .where(eq(schema.slottingRule.organizationId, ctx.organizationId))
      .orderBy(asc(schema.slottingRule.priority));
    return json(rows);
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
    const row = {
      id: id("slr"),
      organizationId: ctx.organizationId,
      warehouseId: body.warehouseId || null,
      name: String(body.name || "").trim(),
      priority: body.priority != null ? Number(body.priority) : 100,
      productSkuPrefix: body.productSkuPrefix || null,
      locationType: body.locationType || null,
      preferPicking: body.preferPicking !== false,
      maxWeightKg:
        body.maxWeightKg != null ? Number(body.maxWeightKg) : null,
      active: body.active !== false,
      createdAt: new Date(),
    };
    if (!row.name) return json({ error: "Nome obrigatório" }, 400);
    await db.insert(schema.slottingRule).values(row);
    return json(row, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const body = await req.json();
    if (!body.id) return json({ error: "id obrigatório" }, 400);
    const db = await getDb();
    await db
      .update(schema.slottingRule)
      .set({
        name: body.name,
        priority: body.priority,
        productSkuPrefix: body.productSkuPrefix,
        locationType: body.locationType,
        preferPicking: body.preferPicking,
        maxWeightKg: body.maxWeightKg,
        active: body.active,
        warehouseId: body.warehouseId,
      })
      .where(
        and(
          eq(schema.slottingRule.id, body.id),
          eq(schema.slottingRule.organizationId, ctx.organizationId),
        ),
      );
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
