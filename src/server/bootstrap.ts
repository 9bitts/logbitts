import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { id } from "./lib/ids";

type AuthLike = {
  api: {
    signUpEmail: (opts: {
      body: { email: string; password: string; name: string };
    }) => Promise<{ user: { id: string } }>;
  };
};

/**
 * Ensures demo org + login users exist (Railway/Postgres cold start).
 * Idempotent — skips when despacho@ already exists.
 */
export async function ensureDemoUsers(auth: AuthLike) {
  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, "despacho@logbitts.demo"))
    .limit(1);
  if (existing) return;

  const orgId = "org_demo_logbitts";
  const [org] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1);
  if (!org) {
    await db.insert(schema.organization).values({
      id: orgId,
      name: "Distribuidora Demo Logbitts",
      slug: "demo-logbitts",
      createdAt: new Date(),
    });
  }

  async function ensureUser(
    email: string,
    name: string,
    password: string,
    role: "owner" | "dispatcher" | "driver" | "warehouse",
  ) {
    const [u] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);
    let userId = u?.id;
    if (!userId) {
      const res = await auth.api.signUpEmail({
        body: { email, password, name },
      });
      userId = res.user.id;
    }
    const [mem] = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, userId!))
      .limit(1);
    if (!mem) {
      await db.insert(schema.member).values({
        id: id("mem"),
        organizationId: orgId,
        userId: userId!,
        role,
        createdAt: new Date(),
      });
    }
  }

  await ensureUser("despacho@logbitts.demo", "Ana Despacho", "demo1234", "owner");
  await ensureUser(
    "motorista@logbitts.demo",
    "Carlos Motorista",
    "demo1234",
    "driver",
  );
  await ensureUser(
    "armazem@logbitts.demo",
    "Bruno Armazém",
    "demo1234",
    "warehouse",
  );
  console.log("[bootstrap] demo users ready");
}
