import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const db = await getDb();
    const rows = await db
      .select({
        mdfe: schema.mdfeDocument,
        route: schema.route,
        emission: schema.fiscalEmission,
      })
      .from(schema.mdfeDocument)
      .leftJoin(schema.route, eq(schema.mdfeDocument.routeId, schema.route.id))
      .leftJoin(
        schema.fiscalEmission,
        eq(schema.mdfeDocument.emissionId, schema.fiscalEmission.id),
      )
      .where(eq(schema.mdfeDocument.organizationId, ctx.organizationId))
      .orderBy(desc(schema.mdfeDocument.createdAt));

    return json(
      rows.map((r) => ({
        ...r.mdfe,
        route: r.route,
        emission: r.emission,
      })),
    );
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
