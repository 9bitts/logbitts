import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireWarehouse } from "@/server/session";
import { id } from "@/server/lib/ids";
import { adjustStock } from "@/server/stock";

async function loadReceipt(idValue: string, organizationId: string) {
  const db = await getDb();
  const [r] = await db
    .select()
    .from(schema.receipt)
    .where(
      and(
        eq(schema.receipt.id, idValue),
        eq(schema.receipt.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!r) return null;
  const lines = await db
    .select({
      line: schema.receiptLine,
      product: schema.product,
      location: schema.location,
    })
    .from(schema.receiptLine)
    .innerJoin(schema.product, eq(schema.receiptLine.productId, schema.product.id))
    .leftJoin(
      schema.location,
      eq(schema.receiptLine.putawayLocationId, schema.location.id),
    )
    .where(eq(schema.receiptLine.receiptId, idValue));
  return {
    ...r,
    lines: lines.map((l) => ({
      ...l.line,
      product: l.product,
      putawayLocation: l.location,
    })),
  };
}

export async function GET(req: Request) {
  try {
    const ctx = await requireWarehouse();
    const url = new URL(req.url);
    const receiptId = url.searchParams.get("id");
    if (receiptId) {
      const detail = await loadReceipt(receiptId, ctx.organizationId);
      if (!detail) return json({ error: "Não encontrado" }, 404);
      return json(detail);
    }
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.receipt)
      .where(eq(schema.receipt.organizationId, ctx.organizationId))
      .orderBy(desc(schema.receipt.createdAt));
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
      const row = {
        id: id("rcp"),
        organizationId: ctx.organizationId,
        warehouseId: String(body.warehouseId),
        code: body.code || `ASN-${Date.now().toString().slice(-6)}`,
        supplier: body.supplier || null,
        status: "open",
        notes: body.notes || null,
        createdAt: new Date(),
        closedAt: null,
      };
      await db.insert(schema.receipt).values(row);
      const lines: { productId: string; qtyExpected: number }[] =
        body.lines || [];
      for (const line of lines) {
        await db.insert(schema.receiptLine).values({
          id: id("rln"),
          organizationId: ctx.organizationId,
          receiptId: row.id,
          productId: line.productId,
          qtyExpected: Number(line.qtyExpected) || 0,
          qtyReceived: 0,
          putawayLocationId: null,
          status: "pending",
        });
      }
      return json(await loadReceipt(row.id, ctx.organizationId), 201);
    }

    if (action === "receive") {
      const lineId = body.lineId as string;
      const qty = Number(body.qty);
      const [line] = await db
        .select()
        .from(schema.receiptLine)
        .where(
          and(
            eq(schema.receiptLine.id, lineId),
            eq(schema.receiptLine.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!line) return json({ error: "Linha não encontrada" }, 404);

      const [receivingLoc] = await db
        .select()
        .from(schema.location)
        .where(
          and(
            eq(schema.location.organizationId, ctx.organizationId),
            eq(schema.location.type, "receiving"),
          ),
        )
        .limit(1);
      if (!receivingLoc) {
        return json({ error: "Crie um endereço tipo receiving" }, 400);
      }

      await adjustStock({
        organizationId: ctx.organizationId,
        productId: line.productId,
        locationId: receivingLoc.id,
        qtyDelta: qty,
        type: "receipt",
        userId: ctx.user.id,
        refType: "receipt_line",
        refId: line.id,
      });

      await db
        .update(schema.receiptLine)
        .set({
          qtyReceived: (line.qtyReceived || 0) + qty,
          status: "received",
        })
        .where(eq(schema.receiptLine.id, line.id));
      await db
        .update(schema.receipt)
        .set({ status: "receiving" })
        .where(eq(schema.receipt.id, line.receiptId));

      return json(await loadReceipt(line.receiptId, ctx.organizationId));
    }

    if (action === "putaway") {
      const lineId = body.lineId as string;
      const toLocationId = body.locationId as string;
      const qty = Number(body.qty);
      const [line] = await db
        .select()
        .from(schema.receiptLine)
        .where(
          and(
            eq(schema.receiptLine.id, lineId),
            eq(schema.receiptLine.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!line) return json({ error: "Linha não encontrada" }, 404);

      const [receivingLoc] = await db
        .select()
        .from(schema.location)
        .where(
          and(
            eq(schema.location.organizationId, ctx.organizationId),
            eq(schema.location.type, "receiving"),
          ),
        )
        .limit(1);
      if (!receivingLoc) return json({ error: "Sem receiving dock" }, 400);

      await adjustStock({
        organizationId: ctx.organizationId,
        productId: line.productId,
        locationId: receivingLoc.id,
        qtyDelta: -qty,
        type: "putaway",
        userId: ctx.user.id,
        refType: "receipt_line",
        refId: line.id,
        notes: "saída do recebimento",
      });
      await adjustStock({
        organizationId: ctx.organizationId,
        productId: line.productId,
        locationId: toLocationId,
        qtyDelta: qty,
        type: "putaway",
        userId: ctx.user.id,
        refType: "receipt_line",
        refId: line.id,
      });

      await db
        .update(schema.receiptLine)
        .set({
          putawayLocationId: toLocationId,
          status: "putaway",
        })
        .where(eq(schema.receiptLine.id, line.id));

      const all = await db
        .select()
        .from(schema.receiptLine)
        .where(eq(schema.receiptLine.receiptId, line.receiptId));
      if (all.every((l) => l.status === "putaway" || l.id === lineId)) {
        await db
          .update(schema.receipt)
          .set({ status: "closed", closedAt: new Date() })
          .where(eq(schema.receipt.id, line.receiptId));
      }

      return json(await loadReceipt(line.receiptId, ctx.organizationId));
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 400);
  }
}
