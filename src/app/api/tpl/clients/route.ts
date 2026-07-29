import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";
import { emitDomainEvent } from "@/server/events/emit";

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.tplClient)
      .where(eq(schema.tplClient.organizationId, ctx.organizationId))
      .orderBy(desc(schema.tplClient.createdAt));
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
      id: id("tpl"),
      organizationId: ctx.organizationId,
      name: String(body.name || "").trim(),
      code: body.code ? String(body.code).trim().toUpperCase() : null,
      document: body.document || null,
      email: body.email || null,
      active: body.active !== false,
      createdAt: new Date(),
    };
    if (!row.name) return json({ error: "Nome obrigatório" }, 400);
    await db.insert(schema.tplClient).values(row);
    await emitDomainEvent({
      organizationId: ctx.organizationId,
      eventType: "tpl.client.created",
      entityType: "tpl_client",
      entityId: row.id,
      clientId: row.id,
      payload: { name: row.name, code: row.code },
    });
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
      .update(schema.tplClient)
      .set({
        name: body.name,
        code: body.code,
        document: body.document,
        email: body.email,
        active: body.active,
      })
      .where(
        and(
          eq(schema.tplClient.id, body.id),
          eq(schema.tplClient.organizationId, ctx.organizationId),
        ),
      );
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
