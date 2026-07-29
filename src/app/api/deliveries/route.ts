import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id, todayISO } from "@/server/lib/ids";
import { assertOwned, assertOwnedOptional } from "@/server/lib/tenant";
import { paginationFromUrl, parseBody } from "@/server/lib/validate";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const date = url.searchParams.get("date");
    const { page, limit, offset } = paginationFromUrl(url, {
      limit: 200,
      max: 500,
    });
    const db = await getDb();

    const conditions = [eq(schema.delivery.organizationId, ctx.organizationId)];
    if (status) conditions.push(eq(schema.delivery.status, status));
    if (date) conditions.push(eq(schema.delivery.scheduledDate, date));

    const rows = await db
      .select({
        delivery: schema.delivery,
        customer: schema.customer,
      })
      .from(schema.delivery)
      .innerJoin(
        schema.customer,
        eq(schema.delivery.customerId, schema.customer.id),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.delivery.createdAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      ...r.delivery,
      customer: r.customer,
    }));

    // Backward-compatible array; ?meta=1 returns paginated envelope
    if (url.searchParams.get("meta") === "1") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.delivery)
        .where(and(...conditions));
      return json({ items, page, limit, total: count });
    }
    return json(items);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const body = parseBody(
      z.object({
        customerId: z.string().min(1),
        externalCode: z.string().optional().nullable(),
        invoiceNumber: z.string().optional().nullable(),
        weightKg: z.coerce.number().optional().nullable(),
        volumeM3: z.coerce.number().optional().nullable(),
        packages: z.coerce.number().optional().nullable(),
        scheduledDate: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        clientId: z.string().optional().nullable(),
      }),
      await req.json(),
    );
    const db = await getDb();
    await assertOwned(
      schema.customer,
      body.customerId,
      ctx.organizationId,
      "Cliente",
    );
    await assertOwnedOptional(
      schema.tplClient,
      body.clientId,
      ctx.organizationId,
      "Cliente 3PL",
    );
    const row = {
      id: id("del"),
      organizationId: ctx.organizationId,
      customerId: body.customerId,
      externalCode: body.externalCode || null,
      invoiceNumber: body.invoiceNumber || null,
      status: "pending",
      weightKg: body.weightKg != null ? Number(body.weightKg) : 0,
      volumeM3: body.volumeM3 != null ? Number(body.volumeM3) : 0,
      packages: body.packages != null ? Number(body.packages) : 1,
      scheduledDate: body.scheduledDate || todayISO(),
      notes: body.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: "manual",
      erpKey: null,
      clientId: body.clientId || null,
    };
    await db.insert(schema.delivery).values(row);
    return json(row, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const body = await req.json();
    const ids: string[] = body.ids || [];
    if (!ids.length) return json({ error: "ids obrigatório" }, 400);
    const db = await getDb();
    await db
      .delete(schema.delivery)
      .where(
        and(
          eq(schema.delivery.organizationId, ctx.organizationId),
          inArray(schema.delivery.id, ids),
          eq(schema.delivery.status, "pending"),
        ),
      );
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
