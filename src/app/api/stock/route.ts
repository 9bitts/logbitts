import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireWarehouse } from "@/server/session";
import { adjustStock } from "@/server/stock";

export async function GET(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    const warehouseId = url.searchParams.get("warehouseId");
    const db = await getDb();

    if (url.searchParams.get("movements") === "1") {
      let moves = await db
        .select({
          movement: schema.stockMovement,
          product: schema.product,
          location: schema.location,
        })
        .from(schema.stockMovement)
        .innerJoin(
          schema.product,
          eq(schema.stockMovement.productId, schema.product.id),
        )
        .leftJoin(
          schema.location,
          eq(schema.stockMovement.locationId, schema.location.id),
        )
        .where(eq(schema.stockMovement.organizationId, ctx.organizationId))
        .orderBy(desc(schema.stockMovement.createdAt))
        .limit(100);
      if (warehouseId) {
        moves = moves.filter((m) => m.location?.warehouseId === warehouseId);
      }
      return json(
        moves.map((m) => ({
          ...m.movement,
          product: m.product,
          location: m.location,
        })),
      );
    }

    let rows = await db
      .select({
        stock: schema.stockLevel,
        product: schema.product,
        location: schema.location,
      })
      .from(schema.stockLevel)
      .innerJoin(schema.product, eq(schema.stockLevel.productId, schema.product.id))
      .innerJoin(
        schema.location,
        eq(schema.stockLevel.locationId, schema.location.id),
      )
      .where(eq(schema.stockLevel.organizationId, ctx.organizationId));

    if (productId) rows = rows.filter((r) => r.stock.productId === productId);
    if (warehouseId) {
      rows = rows.filter((r) => r.location.warehouseId === warehouseId);
    }

    return json(
      rows.map((r) => ({
        ...r.stock,
        product: r.product,
        location: r.location,
      })),
    );
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const body = await req.json();
    if (body.action === "adjust") {
      const qty = await adjustStock({
        organizationId: ctx.organizationId,
        productId: body.productId,
        locationId: body.locationId,
        qtyDelta: Number(body.qtyDelta),
        type: "adjust",
        userId: ctx.user.id,
        notes: body.notes || null,
      });
      return json({ qty });
    }
    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 400);
  }
}
