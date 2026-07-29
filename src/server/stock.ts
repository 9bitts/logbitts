import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { id } from "./lib/ids";

type AdjustInput = {
  organizationId: string;
  productId: string;
  locationId: string;
  qtyDelta: number;
  type: "receipt" | "putaway" | "pick" | "adjust" | "cycle";
  userId?: string | null;
  refType?: string | null;
  refId?: string | null;
  notes?: string | null;
};

export async function adjustStock(input: AdjustInput) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(schema.stockLevel)
    .where(
      and(
        eq(schema.stockLevel.productId, input.productId),
        eq(schema.stockLevel.locationId, input.locationId),
      ),
    )
    .limit(1);

  const nextQty = (existing?.qty ?? 0) + input.qtyDelta;
  if (nextQty < -0.0001) {
    throw new Error("Estoque insuficiente");
  }

  if (existing) {
    await db
      .update(schema.stockLevel)
      .set({ qty: nextQty, updatedAt: new Date() })
      .where(eq(schema.stockLevel.id, existing.id));
  } else {
    await db.insert(schema.stockLevel).values({
      id: id("stk"),
      organizationId: input.organizationId,
      productId: input.productId,
      locationId: input.locationId,
      qty: nextQty,
      updatedAt: new Date(),
    });
  }

  await db.insert(schema.stockMovement).values({
    id: id("mvt"),
    organizationId: input.organizationId,
    productId: input.productId,
    locationId: input.locationId,
    type: input.type,
    qty: input.qtyDelta,
    refType: input.refType || null,
    refId: input.refId || null,
    userId: input.userId || null,
    notes: input.notes || null,
    createdAt: new Date(),
  });

  return nextQty;
}

export async function findBestPickLocation(
  organizationId: string,
  productId: string,
  qtyNeeded: number,
) {
  const db = await getDb();
  const rows = await db
    .select({
      stock: schema.stockLevel,
      location: schema.location,
    })
    .from(schema.stockLevel)
    .innerJoin(
      schema.location,
      eq(schema.stockLevel.locationId, schema.location.id),
    )
    .where(
      and(
        eq(schema.stockLevel.organizationId, organizationId),
        eq(schema.stockLevel.productId, productId),
      ),
    );

  const preferred = rows
    .filter((r) => r.stock.qty > 0)
    .sort((a, b) => {
      const rank = (t: string) =>
        t === "picking" ? 0 : t === "storage" ? 1 : 2;
      const d = rank(a.location.type) - rank(b.location.type);
      if (d !== 0) return d;
      return b.stock.qty - a.stock.qty;
    });

  const hit = preferred.find((r) => r.stock.qty >= qtyNeeded) || preferred[0];
  return hit || null;
}
