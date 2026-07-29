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
      .from(schema.driver)
      .where(eq(schema.driver.organizationId, ctx.organizationId))
      .orderBy(desc(schema.driver.createdAt));
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
      id: id("drv"),
      organizationId: ctx.organizationId,
      userId: body.userId || null,
      name: String(body.name || "").trim(),
      phone: body.phone || null,
      document: body.document || null,
      active: body.active !== false,
      createdAt: new Date(),
    };
    if (!row.name) return json({ error: "Nome obrigatório" }, 400);
    await db.insert(schema.driver).values(row);
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
      .update(schema.driver)
      .set({
        name: body.name,
        phone: body.phone,
        document: body.document,
        active: body.active,
        userId: body.userId,
      })
      .where(
        and(
          eq(schema.driver.id, body.id),
          eq(schema.driver.organizationId, ctx.organizationId),
        ),
      );
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
