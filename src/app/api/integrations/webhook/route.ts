import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json } from "@/server/session";
import { ensureConnectors } from "@/server/integrations/catalog";
import { runConnectorSync } from "@/server/integrations/sync";
import type { ConnectorConfig, ErpOrder } from "@/server/integrations/types";

/**
 * Public webhook for ERP push (Winthor middleware / iPaaS).
 * Auth: X-Logbitts-Secret or Bearer matching connector webhookSecret.
 * Query: ?org=org_xxx&key=winthor
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId =
      url.searchParams.get("org") || req.headers.get("x-logbitts-org");
    if (!orgId) {
      return json(
        { error: "org obrigatório (?org= ou header x-logbitts-org)" },
        400,
      );
    }
    const key = url.searchParams.get("key") || "winthor";

    await ensureConnectors(orgId);
    const db = await getDb();
    const [target] = await db
      .select()
      .from(schema.integrationConnector)
      .where(
        and(
          eq(schema.integrationConnector.organizationId, orgId),
          eq(schema.integrationConnector.key, key),
        ),
      )
      .limit(1);
    if (!target) return json({ error: "Conector não encontrado" }, 404);

    let cfg: ConnectorConfig = { mode: "mock" };
    try {
      cfg = target.configJson
        ? (JSON.parse(target.configJson) as ConnectorConfig)
        : cfg;
    } catch {
      /* ignore */
    }

    const secret =
      req.headers.get("x-logbitts-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (!cfg.webhookSecret || secret !== cfg.webhookSecret) {
      return json({ error: "Secret inválido" }, 401);
    }

    const body = await req.json();
    const orders: ErpOrder[] = Array.isArray(body.orders)
      ? body.orders
      : Array.isArray(body.pedidos)
        ? body.pedidos
        : Array.isArray(body)
          ? body
          : body.order
            ? [body.order]
            : [];

    if (!orders.length) return json({ error: "Nenhum pedido no payload" }, 400);

    const result = await runConnectorSync(orgId, target.id, "webhook", orders);
    return json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
