import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";
import { calcRateAmount, matchRates } from "@/server/freight/quote";

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const db = await getDb();
    const rows = await db
      .select({
        quote: schema.freightQuote,
        carrier: schema.carrier,
      })
      .from(schema.freightQuote)
      .leftJoin(
        schema.carrier,
        eq(schema.freightQuote.carrierId, schema.carrier.id),
      )
      .where(eq(schema.freightQuote.organizationId, ctx.organizationId))
      .orderBy(desc(schema.freightQuote.createdAt))
      .limit(50);
    return json(rows.map((r) => ({ ...r.quote, carrier: r.carrier })));
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

    let originState = String(body.originState || "SP").toUpperCase().slice(0, 2);
    let destState = String(body.destState || "").toUpperCase().slice(0, 2);
    let originZip = body.originZip || null;
    let destZip = body.destZip || null;
    let weightKg = Number(body.weightKg || 0);
    let deliveryId = body.deliveryId || null;

    if (deliveryId) {
      const [row] = await db
        .select({
          delivery: schema.delivery,
          customer: schema.customer,
        })
        .from(schema.delivery)
        .innerJoin(
          schema.customer,
          eq(schema.delivery.customerId, schema.customer.id),
        )
        .where(
          and(
            eq(schema.delivery.id, deliveryId),
            eq(schema.delivery.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!row) return json({ error: "Entrega não encontrada" }, 404);
      destState = row.customer.state;
      destZip = row.customer.zip;
      weightKg = row.delivery.weightKg || weightKg || 1;
      const [wh] = await db
        .select()
        .from(schema.warehouse)
        .where(eq(schema.warehouse.organizationId, ctx.organizationId))
        .limit(1);
      if (wh?.address?.includes("/")) {
        // keep default SP
      }
      originZip = originZip || "01000-000";
    }

    if (!destState) return json({ error: "destState ou deliveryId obrigatório" }, 400);

    const tables = await db
      .select()
      .from(schema.freightRateTable)
      .where(
        and(
          eq(schema.freightRateTable.organizationId, ctx.organizationId),
          eq(schema.freightRateTable.active, true),
        ),
      );
    const rates = await db
      .select()
      .from(schema.freightRate)
      .where(eq(schema.freightRate.organizationId, ctx.organizationId));

    const carriers = await db
      .select()
      .from(schema.carrier)
      .where(eq(schema.carrier.organizationId, ctx.organizationId));

    const quotes = [];
    for (const table of tables) {
      const tableRates = rates.filter((r) => r.tableId === table.id);
      const matched = matchRates(tableRates, {
        originState,
        destState,
        originZip,
        destZip,
        weightKg,
      });
      for (const rate of matched.slice(0, 1)) {
        const amount = calcRateAmount(rate, weightKg);
        const quote = {
          id: id("fqt"),
          organizationId: ctx.organizationId,
          carrierId: table.carrierId,
          tableId: table.id,
          rateId: rate.id,
          deliveryId,
          originState,
          destState,
          originZip,
          destZip,
          weightKg,
          amount,
          transitDays: rate.transitDays,
          status: "open",
          createdAt: new Date(),
        };
        await db.insert(schema.freightQuote).values(quote);
        quotes.push({
          ...quote,
          carrier: carriers.find((c) => c.id === table.carrierId) || null,
          tableName: table.name,
        });
      }
    }

    quotes.sort((a, b) => a.amount - b.amount);
    return json({ quotes, count: quotes.length });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
