import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireWarehouse } from "@/server/session";

/** Aggregated tasks for collector PWA */
export async function GET(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const type = new URL(req.url).searchParams.get("type") || "pick";
    const db = await getDb();

    if (type === "pick") {
      const tasks = await db
        .select({
          task: schema.pickTask,
          product: schema.product,
          location: schema.location,
          wave: schema.pickWave,
          delivery: schema.delivery,
        })
        .from(schema.pickTask)
        .innerJoin(schema.pickWave, eq(schema.pickTask.waveId, schema.pickWave.id))
        .innerJoin(schema.product, eq(schema.pickTask.productId, schema.product.id))
        .leftJoin(
          schema.location,
          eq(schema.pickTask.fromLocationId, schema.location.id),
        )
        .innerJoin(
          schema.delivery,
          eq(schema.pickTask.deliveryId, schema.delivery.id),
        )
        .where(
          and(
            eq(schema.pickTask.organizationId, ctx.organizationId),
            eq(schema.pickTask.status, "pending"),
            eq(schema.pickWave.status, "released"),
          ),
        )
        .orderBy(desc(schema.pickWave.releasedAt));

      return json(
        tasks.map((t) => ({
          kind: "pick",
          ...t.task,
          product: t.product,
          fromLocation: t.location,
          wave: t.wave,
          delivery: t.delivery,
        })),
      );
    }

    if (type === "putaway") {
      const lines = await db
        .select({
          line: schema.receiptLine,
          product: schema.product,
          receipt: schema.receipt,
        })
        .from(schema.receiptLine)
        .innerJoin(
          schema.receipt,
          eq(schema.receiptLine.receiptId, schema.receipt.id),
        )
        .innerJoin(
          schema.product,
          eq(schema.receiptLine.productId, schema.product.id),
        )
        .where(
          and(
            eq(schema.receiptLine.organizationId, ctx.organizationId),
            eq(schema.receiptLine.status, "received"),
          ),
        );

      return json(
        lines.map((l) => ({
          kind: "putaway",
          ...l.line,
          product: l.product,
          receipt: l.receipt,
        })),
      );
    }

    if (type === "cycle") {
      const lines = await db
        .select({
          line: schema.cycleCountLine,
          product: schema.product,
          location: schema.location,
          count: schema.cycleCount,
        })
        .from(schema.cycleCountLine)
        .innerJoin(
          schema.cycleCount,
          eq(schema.cycleCountLine.cycleCountId, schema.cycleCount.id),
        )
        .innerJoin(
          schema.product,
          eq(schema.cycleCountLine.productId, schema.product.id),
        )
        .innerJoin(
          schema.location,
          eq(schema.cycleCountLine.locationId, schema.location.id),
        )
        .where(
          and(
            eq(schema.cycleCountLine.organizationId, ctx.organizationId),
            eq(schema.cycleCountLine.status, "pending"),
            eq(schema.cycleCount.status, "open"),
          ),
        );

      return json(
        lines.map((l) => ({
          kind: "cycle",
          ...l.line,
          product: l.product,
          location: l.location,
          count: l.count,
        })),
      );
    }

    return json({ error: "type inválido" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
