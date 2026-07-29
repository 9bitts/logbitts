import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id, todayISO } from "@/server/lib/ids";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const date = url.searchParams.get("date");
    const db = await getDb();

    let rows = await db
      .select({
        delivery: schema.delivery,
        customer: schema.customer,
      })
      .from(schema.delivery)
      .innerJoin(
        schema.customer,
        eq(schema.delivery.customerId, schema.customer.id),
      )
      .where(eq(schema.delivery.organizationId, ctx.organizationId))
      .orderBy(desc(schema.delivery.createdAt));

    if (status) {
      rows = rows.filter((r) => r.delivery.status === status);
    }
    if (date) {
      rows = rows.filter((r) => r.delivery.scheduledDate === date);
    }

    return json(
      rows.map((r) => ({
        ...r.delivery,
        customer: r.customer,
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
    const row = {
      id: id("del"),
      organizationId: ctx.organizationId,
      customerId: String(body.customerId),
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
    };
    if (!row.customerId) return json({ error: "customerId obrigatório" }, 400);
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
