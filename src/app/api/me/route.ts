import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireSession } from "@/server/session";

export async function GET() {
  try {
    const ctx = await requireSession();
    const db = await getDb();
    const [org] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, ctx.organizationId))
      .limit(1);
    return json({
      user: ctx.user,
      role: ctx.role,
      organization: org,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
