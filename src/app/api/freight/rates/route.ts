import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const tableId = url.searchParams.get("tableId");
    const db = await getDb();

    if (tableId) {
      const rates = await db
        .select()
        .from(schema.freightRate)
        .where(
          and(
            eq(schema.freightRate.organizationId, ctx.organizationId),
            eq(schema.freightRate.tableId, tableId),
          ),
        );
      return json(rates);
    }

    const tables = await db
      .select({
        table: schema.freightRateTable,
        carrier: schema.carrier,
      })
      .from(schema.freightRateTable)
      .leftJoin(
        schema.carrier,
        eq(schema.freightRateTable.carrierId, schema.carrier.id),
      )
      .where(eq(schema.freightRateTable.organizationId, ctx.organizationId))
      .orderBy(desc(schema.freightRateTable.createdAt));

    return json(
      tables.map((t) => ({
        ...t.table,
        carrier: t.carrier,
      })),
    );
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
    const action = body.action as string | undefined;

    if (!action || action === "create_table") {
      const row = {
        id: id("frt"),
        organizationId: ctx.organizationId,
        carrierId: body.carrierId || null,
        name: String(body.name || "").trim(),
        active: true,
        createdAt: new Date(),
      };
      if (!row.name) return json({ error: "Nome obrigatório" }, 400);
      await db.insert(schema.freightRateTable).values(row);
      return json(row, 201);
    }

    if (action === "add_rate") {
      const row = {
        id: id("frr"),
        organizationId: ctx.organizationId,
        tableId: String(body.tableId),
        originState: String(body.originState || "SP").toUpperCase().slice(0, 2),
        destState: String(body.destState || "SP").toUpperCase().slice(0, 2),
        originZipPrefix: body.originZipPrefix || null,
        destZipPrefix: body.destZipPrefix || null,
        minWeightKg: Number(body.minWeightKg ?? 0),
        maxWeightKg: Number(body.maxWeightKg ?? 99999),
        pricePerKg: Number(body.pricePerKg ?? 0),
        minimumPrice: Number(body.minimumPrice ?? 0),
        fixedPrice: body.fixedPrice != null ? Number(body.fixedPrice) : null,
        transitDays: body.transitDays != null ? Number(body.transitDays) : 3,
      };
      await db.insert(schema.freightRate).values(row);
      return json(row, 201);
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
