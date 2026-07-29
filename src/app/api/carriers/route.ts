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
      .from(schema.carrier)
      .where(eq(schema.carrier.organizationId, ctx.organizationId))
      .orderBy(desc(schema.carrier.createdAt));
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
      id: id("car"),
      organizationId: ctx.organizationId,
      name: String(body.name || "").trim(),
      document: body.document || null,
      rntrc: body.rntrc || null,
      email: body.email || null,
      phone: body.phone || null,
      active: body.active !== false,
      createdAt: new Date(),
    };
    if (!row.name) return json({ error: "Nome obrigatório" }, 400);
    await db.insert(schema.carrier).values(row);
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
      .update(schema.carrier)
      .set({
        name: body.name,
        document: body.document,
        rntrc: body.rntrc,
        email: body.email,
        phone: body.phone,
        active: body.active,
      })
      .where(
        and(
          eq(schema.carrier.id, body.id),
          eq(schema.carrier.organizationId, ctx.organizationId),
        ),
      );
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
