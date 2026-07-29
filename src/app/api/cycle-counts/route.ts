import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireWarehouse } from "@/server/session";
import { id } from "@/server/lib/ids";
import { adjustStock } from "@/server/stock";

async function loadCount(countId: string, organizationId: string) {
  const db = await getDb();
  const [c] = await db
    .select()
    .from(schema.cycleCount)
    .where(
      and(
        eq(schema.cycleCount.id, countId),
        eq(schema.cycleCount.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!c) return null;
  const lines = await db
    .select({
      line: schema.cycleCountLine,
      product: schema.product,
      location: schema.location,
    })
    .from(schema.cycleCountLine)
    .innerJoin(schema.product, eq(schema.cycleCountLine.productId, schema.product.id))
    .innerJoin(
      schema.location,
      eq(schema.cycleCountLine.locationId, schema.location.id),
    )
    .where(eq(schema.cycleCountLine.cycleCountId, countId));
  return {
    ...c,
    lines: lines.map((l) => ({
      ...l.line,
      product: l.product,
      location: l.location,
    })),
  };
}

export async function GET(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const countId = new URL(req.url).searchParams.get("id");
    if (countId) {
      const detail = await loadCount(countId, ctx.organizationId);
      if (!detail) return json({ error: "Não encontrado" }, 404);
      return json(detail);
    }
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.cycleCount)
      .where(eq(schema.cycleCount.organizationId, ctx.organizationId))
      .orderBy(desc(schema.cycleCount.createdAt));
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
    const action = body.action as string | undefined;

    if (!action || action === "create") {
      const [wh] = await db
        .select()
        .from(schema.warehouse)
        .where(eq(schema.warehouse.organizationId, ctx.organizationId))
        .limit(1);
      if (!wh) return json({ error: "Sem warehouse" }, 400);

      const stock = await db
        .select()
        .from(schema.stockLevel)
        .where(eq(schema.stockLevel.organizationId, ctx.organizationId));

      const count = {
        id: id("cyc"),
        organizationId: ctx.organizationId,
        warehouseId: wh.id,
        name: body.name || `Inventário ${new Date().toISOString().slice(0, 10)}`,
        status: "open",
        createdAt: new Date(),
        completedAt: null,
      };
      await db.insert(schema.cycleCount).values(count);

      const locationFilter: string[] | null = body.locationIds || null;
      for (const s of stock) {
        if (locationFilter && !locationFilter.includes(s.locationId)) continue;
        if (s.qty <= 0 && !body.includeEmpty) continue;
        await db.insert(schema.cycleCountLine).values({
          id: id("ccl"),
          organizationId: ctx.organizationId,
          cycleCountId: count.id,
          productId: s.productId,
          locationId: s.locationId,
          qtySystem: s.qty,
          qtyCounted: null,
          status: "pending",
        });
      }

      return json(await loadCount(count.id, ctx.organizationId), 201);
    }

    if (action === "count") {
      const lineId = body.lineId as string;
      const qtyCounted = Number(body.qtyCounted);
      const [line] = await db
        .select()
        .from(schema.cycleCountLine)
        .where(
          and(
            eq(schema.cycleCountLine.id, lineId),
            eq(schema.cycleCountLine.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!line) return json({ error: "Linha não encontrada" }, 404);

      const delta = qtyCounted - line.qtySystem;
      if (Math.abs(delta) > 0.0001) {
        await adjustStock({
          organizationId: ctx.organizationId,
          productId: line.productId,
          locationId: line.locationId,
          qtyDelta: delta,
          type: "cycle",
          userId: ctx.user.id,
          refType: "cycle_count_line",
          refId: line.id,
          notes: `Ajuste inventário: sistema ${line.qtySystem} → contado ${qtyCounted}`,
        });
      }

      await db
        .update(schema.cycleCountLine)
        .set({ qtyCounted, status: "counted" })
        .where(eq(schema.cycleCountLine.id, line.id));

      const lines = await db
        .select()
        .from(schema.cycleCountLine)
        .where(eq(schema.cycleCountLine.cycleCountId, line.cycleCountId));
      if (lines.every((l) => l.status === "counted" || l.id === lineId)) {
        await db
          .update(schema.cycleCount)
          .set({ status: "done", completedAt: new Date() })
          .where(eq(schema.cycleCount.id, line.cycleCountId));
      }

      return json(await loadCount(line.cycleCountId, ctx.organizationId));
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 400);
  }
}
