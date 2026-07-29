import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.customer)
      .where(eq(schema.customer.organizationId, ctx.organizationId))
      .orderBy(desc(schema.customer.createdAt));
    return json(rows);
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
      id: id("cus"),
      organizationId: ctx.organizationId,
      name: String(body.name || "").trim(),
      document: body.document || null,
      phone: body.phone || null,
      email: body.email || null,
      address: String(body.address || "").trim(),
      neighborhood: body.neighborhood || null,
      city: String(body.city || "").trim(),
      state: String(body.state || "").trim().toUpperCase().slice(0, 2),
      zip: String(body.zip || "").trim(),
      lat: body.lat != null ? Number(body.lat) : null,
      lng: body.lng != null ? Number(body.lng) : null,
      windowStart: body.windowStart || null,
      windowEnd: body.windowEnd || null,
      notes: body.notes || null,
      erpKey: body.erpKey || null,
      createdAt: new Date(),
    };
    if (!row.name || !row.address || !row.city || !row.state || !row.zip) {
      return json({ error: "Campos obrigatórios faltando" }, 400);
    }
    await db.insert(schema.customer).values(row);
    return json(row, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const body = await req.json();
    if (!body.id) return json({ error: "id obrigatório" }, 400);
    const db = await getDb();
    await db
      .update(schema.customer)
      .set({
        name: body.name,
        document: body.document,
        phone: body.phone,
        email: body.email,
        address: body.address,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        zip: body.zip,
        lat: body.lat != null ? Number(body.lat) : undefined,
        lng: body.lng != null ? Number(body.lng) : undefined,
        windowStart: body.windowStart,
        windowEnd: body.windowEnd,
        notes: body.notes,
      })
      .where(
        and(
          eq(schema.customer.id, body.id),
          eq(schema.customer.organizationId, ctx.organizationId),
        ),
      );
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
