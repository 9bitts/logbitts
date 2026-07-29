import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { id } from "@/server/lib/ids";

export const CATALOG = [
  { key: "winthor", name: "TOTVS Winthor (ERP)" },
  { key: "sap", name: "SAP (pedido / NF)" },
  { key: "generic_rest", name: "REST genérico (webhook)" },
  { key: "focus_nfe", name: "Focus NFe / parceiro fiscal" },
  { key: "frete_marketplace", name: "Marketplace de frete" },
] as const;

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
      status:
        c.key === "focus_nfe" || c.key === "winthor" ? "configured" : "available",
      configJson:
        c.key === "winthor"
          ? JSON.stringify({
              mode: "mock",
              webhookSecret: "logbitts-demo-webhook",
              companyCode: "DEMO",
            })
          : null,
      lastSyncAt: null,
      lastError: null,
      createdAt: new Date(),
    });
  }
}
