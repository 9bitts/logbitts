import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { getOrCreateFiscalConfig } from "@/server/fiscal";

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const cfg = await getOrCreateFiscalConfig(ctx.organizationId);
    return json(cfg);
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
    const cfg = await getOrCreateFiscalConfig(ctx.organizationId);

    await db
      .update(schema.fiscalProviderConfig)
      .set({
        provider: body.provider || cfg.provider,
        environment: body.environment || cfg.environment,
        apiKey: body.apiKey !== undefined ? body.apiKey : cfg.apiKey,
        baseUrl: body.baseUrl !== undefined ? body.baseUrl : cfg.baseUrl,
        companyDocument:
          body.companyDocument !== undefined
            ? body.companyDocument
            : cfg.companyDocument,
        companyName:
          body.companyName !== undefined ? body.companyName : cfg.companyName,
        active: body.active !== undefined ? Boolean(body.active) : cfg.active,
      })
      .where(
        and(
          eq(schema.fiscalProviderConfig.id, cfg.id),
          eq(schema.fiscalProviderConfig.organizationId, ctx.organizationId),
        ),
      );

    const [updated] = await db
      .select()
      .from(schema.fiscalProviderConfig)
      .where(eq(schema.fiscalProviderConfig.id, cfg.id))
      .limit(1);
    return json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
