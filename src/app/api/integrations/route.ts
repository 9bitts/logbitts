import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { ensureConnectors } from "@/server/integrations/catalog";

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
          lastError: null,
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
      // backward-compatible: real sync for winthor/sap/rest
      const { runConnectorSync } = await import("@/server/integrations/sync");
      const keyOrId = body.key || body.id;
      const result = await runConnectorSync(
        ctx.organizationId,
        keyOrId,
        "pull",
      );
      return json({
        ok: true,
        message: result.run?.message || "Sync OK",
        ...result,
      });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
