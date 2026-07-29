import { requireDispatcher, json } from "@/server/session";
import { ensureConnectors } from "@/server/integrations/catalog";
import { listSyncRuns, runConnectorSync } from "@/server/integrations/sync";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const key = new URL(req.url).searchParams.get("key");
    const runs = await listSyncRuns(ctx.organizationId, 30);
    const filtered = key
      ? runs.filter((r) => r.connector.key === key)
      : runs;
    return json(
      filtered.map((r) => ({
        ...r.run,
        connectorKey: r.connector.key,
        connectorName: r.connector.name,
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
    await ensureConnectors(ctx.organizationId);
    const body = await req.json();
    const keyOrId = body.key || body.connectorId || "winthor";
    const result = await runConnectorSync(ctx.organizationId, keyOrId, "pull");
    return json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
