import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";

const CATALOG = [
  { key: "winthor", name: "TOTVS Winthor (ERP)" },
  { key: "sap", name: "SAP (pedido / NF)" },
  { key: "generic_rest", name: "REST genérico (webhook)" },
  { key: "focus_nfe", name: "Focus NFe / parceiro fiscal" },
  { key: "frete_marketplace", name: "Marketplace de frete" },
];

export async function ensureConnectors(organizationId: string) {
  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.integrationConnector)
    .where(eq(schema.integrationConnector.organizationId, organizationId));
  const have = new Set(existing.map((e) => e.key));
  for (const c of CATALOG) {
    if (have.has(c.key)) continue;
    await db.insert(schema.integrationConnector).values({
      id: id("icn"),
      organizationId,
      key: c.key,
      name: c.name,
      status: c.key === "focus_nfe" ? "configured" : "available",
      configJson: null,
      lastSyncAt: null,
      createdAt: new Date(),
    });
  }
}

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    await ensureConnectors(ctx.organizationId);
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.integrationConnector)
      .where(eq(schema.integrationConnector.organizationId, ctx.organizationId))
      .orderBy(asc(schema.integrationConnector.name));
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
    await ensureConnectors(ctx.organizationId);

    if (body.action === "configure") {
      await db
        .update(schema.integrationConnector)
        .set({
          status: body.status || "configured",
          configJson:
            body.config != null ? JSON.stringify(body.config) : undefined,
          lastSyncAt: body.markSync ? new Date() : undefined,
        })
        .where(
          and(
            eq(schema.integrationConnector.id, body.id),
            eq(schema.integrationConnector.organizationId, ctx.organizationId),
          ),
        );
      return json({ ok: true });
    }

    if (body.action === "sync_stub") {
      await db
        .update(schema.integrationConnector)
        .set({
          status: "connected",
          lastSyncAt: new Date(),
        })
        .where(
          and(
            eq(schema.integrationConnector.id, body.id),
            eq(schema.integrationConnector.organizationId, ctx.organizationId),
          ),
        );
      return json({
        ok: true,
        message: "Sync stub OK — conector marcado como connected",
      });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
