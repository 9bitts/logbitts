import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { id } from "@/server/lib/ids";
import { ingestErpOrders } from "./ingest";
import type { ConnectorConfig, ErpOrder } from "./types";
import { fetchHttpOrders, mockWinthorOrders } from "./winthor";

export async function getConnector(
  organizationId: string,
  keyOrId: string,
) {
  const db = await getDb();
  const [byId] = await db
    .select()
    .from(schema.integrationConnector)
    .where(
      and(
        eq(schema.integrationConnector.organizationId, organizationId),
        eq(schema.integrationConnector.id, keyOrId),
      ),
    )
    .limit(1);
  if (byId) return byId;
  const [byKey] = await db
    .select()
    .from(schema.integrationConnector)
    .where(
      and(
        eq(schema.integrationConnector.organizationId, organizationId),
        eq(schema.integrationConnector.key, keyOrId),
      ),
    )
    .limit(1);
  return byKey || null;
}

function parseConfig(raw: string | null): ConnectorConfig {
  if (!raw) return { mode: "mock" };
  try {
    return JSON.parse(raw) as ConnectorConfig;
  } catch {
    return { mode: "mock" };
  }
}

export async function pullOrdersForConnector(
  connector: typeof schema.integrationConnector.$inferSelect,
): Promise<ErpOrder[]> {
  const cfg = parseConfig(connector.configJson);
  const mode = cfg.mode || (cfg.baseUrl ? "http" : "mock");

  if (connector.key === "winthor" || connector.key === "generic_rest" || connector.key === "sap") {
    if (mode === "http" && cfg.baseUrl) {
      return fetchHttpOrders({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
    }
    return mockWinthorOrders(3);
  }
  return mockWinthorOrders(2);
}

export async function runConnectorSync(
  organizationId: string,
  keyOrId: string,
  direction: "pull" | "webhook" = "pull",
  inboundOrders?: ErpOrder[],
) {
  const db = await getDb();
  const connector = await getConnector(organizationId, keyOrId);
  if (!connector) {
    throw new Response(JSON.stringify({ error: "Conector não encontrado" }), {
      status: 404,
    });
  }

  const runId = id("isr");
  await db.insert(schema.integrationSyncRun).values({
    id: runId,
    organizationId,
    connectorId: connector.id,
    direction,
    status: "running",
    startedAt: new Date(),
    finishedAt: null,
    createdCustomers: 0,
    createdDeliveries: 0,
    skipped: 0,
    errors: 0,
    message: null,
    detailJson: null,
  });

  try {
    const orders =
      inboundOrders || (await pullOrdersForConnector(connector));
    const result = await ingestErpOrders(
      organizationId,
      orders,
      `erp:${connector.key}`,
    );

    const status =
      result.errors.length === 0
        ? "success"
        : result.createdDeliveries > 0
          ? "partial"
          : "error";
    const message = `+${result.createdDeliveries} entregas, +${result.createdCustomers} clientes, ${result.skipped} ignorados, ${result.errors.length} erros`;

    await db
      .update(schema.integrationSyncRun)
      .set({
        status,
        finishedAt: new Date(),
        createdCustomers: result.createdCustomers,
        createdDeliveries: result.createdDeliveries,
        skipped: result.skipped,
        errors: result.errors.length,
        message,
        detailJson: JSON.stringify({ errors: result.errors, orderCount: orders.length }),
      })
      .where(eq(schema.integrationSyncRun.id, runId));

    await db
      .update(schema.integrationConnector)
      .set({
        status: status === "error" ? "error" : "connected",
        lastSyncAt: new Date(),
        lastError: result.errors.length ? result.errors.slice(0, 3).join("; ") : null,
      })
      .where(eq(schema.integrationConnector.id, connector.id));

    const [run] = await db
      .select()
      .from(schema.integrationSyncRun)
      .where(eq(schema.integrationSyncRun.id, runId))
      .limit(1);

    return { run, result, orders: orders.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha no sync";
    await db
      .update(schema.integrationSyncRun)
      .set({
        status: "error",
        finishedAt: new Date(),
        message: msg,
        errors: 1,
        detailJson: JSON.stringify({ error: msg }),
      })
      .where(eq(schema.integrationSyncRun.id, runId));
    await db
      .update(schema.integrationConnector)
      .set({ status: "error", lastError: msg })
      .where(eq(schema.integrationConnector.id, connector.id));
    throw err instanceof Response
      ? err
      : new Response(JSON.stringify({ error: msg }), { status: 502 });
  }
}

export async function listSyncRuns(organizationId: string, limit = 20) {
  const db = await getDb();
  return db
    .select({
      run: schema.integrationSyncRun,
      connector: schema.integrationConnector,
    })
    .from(schema.integrationSyncRun)
    .innerJoin(
      schema.integrationConnector,
      eq(schema.integrationSyncRun.connectorId, schema.integrationConnector.id),
    )
    .where(eq(schema.integrationSyncRun.organizationId, organizationId))
    .orderBy(desc(schema.integrationSyncRun.startedAt))
    .limit(limit);
}
