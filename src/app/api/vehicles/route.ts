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
      .from(schema.vehicle)
      .where(eq(schema.vehicle.organizationId, ctx.organizationId))
      .orderBy(desc(schema.vehicle.createdAt));
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
      id: id("veh"),
      organizationId: ctx.organizationId,
      plate: String(body.plate || "").trim().toUpperCase(),
      label: body.label || null,
      capacityKg: body.capacityKg != null ? Number(body.capacityKg) : null,
      capacityM3: body.capacityM3 != null ? Number(body.capacityM3) : null,
      active: body.active !== false,
      createdAt: new Date(),
    };
    if (!row.plate) return json({ error: "Placa obrigatória" }, 400);
    await db.insert(schema.vehicle).values(row);
    return json(row, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
