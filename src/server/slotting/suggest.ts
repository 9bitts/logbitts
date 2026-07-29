import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

export type SlotSuggestion = {
  locationId: string;
  code: string;
  type: string;
  score: number;
  reason: string;
};

/** Rule-based "IA leve" slotting: score locations for putaway. */
export async function suggestPutaway(input: {
  organizationId: string;
  warehouseId: string;
  sku?: string | null;
  weightKg?: number | null;
  qty?: number | null;
}): Promise<SlotSuggestion[]> {
  const db = await getDb();
  const locations = await db
    .select()
    .from(schema.location)
    .where(
      and(
        eq(schema.location.organizationId, input.organizationId),
        eq(schema.location.warehouseId, input.warehouseId),
      ),
    )
    .orderBy(asc(schema.location.code));

  const rules = await db
    .select()
    .from(schema.slottingRule)
    .where(
      and(
        eq(schema.slottingRule.organizationId, input.organizationId),
        eq(schema.slottingRule.active, true),
      ),
    )
    .orderBy(asc(schema.slottingRule.priority));

  const stock = await db
    .select({
      stock: schema.stockLevel,
      location: schema.location,
      product: schema.product,
    })
    .from(schema.stockLevel)
    .innerJoin(
      schema.location,
      eq(schema.stockLevel.locationId, schema.location.id),
    )
    .innerJoin(
      schema.product,
      eq(schema.stockLevel.productId, schema.product.id),
    )
    .where(eq(schema.stockLevel.organizationId, input.organizationId));

  const qtyByLoc = new Map<string, number>();
  for (const s of stock) {
    if (s.location.warehouseId !== input.warehouseId) continue;
    qtyByLoc.set(
      s.location.id,
      (qtyByLoc.get(s.location.id) || 0) + (s.stock.qty || 0),
    );
  }

  const sku = (input.sku || "").toUpperCase();
  const suggestions: SlotSuggestion[] = [];

  for (const loc of locations) {
    if (loc.type === "shipping" || loc.type === "receiving") continue;
    let score = 50;
    const reasons: string[] = [];

    for (const rule of rules) {
      if (rule.warehouseId && rule.warehouseId !== input.warehouseId) continue;
      if (rule.productSkuPrefix && sku && !sku.startsWith(rule.productSkuPrefix.toUpperCase())) {
        continue;
      }
      if (rule.locationType && rule.locationType !== loc.type) continue;
      if (
        rule.maxWeightKg != null &&
        input.weightKg != null &&
        input.weightKg > rule.maxWeightKg
      ) {
        continue;
      }
      const boost = Math.max(5, 40 - (rule.priority || 100) / 5);
      score += boost;
      reasons.push(rule.name);
      if (rule.preferPicking && loc.type === "picking") {
        score += 15;
        reasons.push("prefer picking");
      }
    }

    if (loc.type === "picking") score += 10;
    if (loc.type === "storage") score += 5;

    const occ = qtyByLoc.get(loc.id) || 0;
    if (occ === 0) {
      score += 12;
      reasons.push("vazio");
    } else if (occ < 20) {
      score += 6;
      reasons.push("baixa ocupação");
    } else {
      score -= Math.min(20, occ / 10);
      reasons.push("ocupado");
    }

    // same SKU affinity
    if (sku) {
      const same = stock.some(
        (s) =>
          s.location.id === loc.id &&
          s.product.sku.toUpperCase() === sku &&
          s.stock.qty > 0,
      );
      if (same) {
        score += 20;
        reasons.push("mesmo SKU");
      }
    }

    suggestions.push({
      locationId: loc.id,
      code: loc.code,
      type: loc.type,
      score: Math.round(score),
      reason: reasons.slice(0, 3).join(" · ") || "baseline",
    });
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 8);
}
