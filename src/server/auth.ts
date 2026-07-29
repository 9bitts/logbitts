import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "./db";
import { ensureDemoUsers } from "./bootstrap";
import { allowDemoBootstrap, requireAuthSecret } from "./env";

function appBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

function createAuth(db: Awaited<ReturnType<typeof getDb>>) {
  const baseURL = appBaseUrl();
  const origins = new Set<string>([
    baseURL,
    process.env.NEXT_PUBLIC_APP_URL || "",
    "http://localhost:3000",
  ]);
  // Explicit Railway public URL only (no wildcard — better-auth doesn't expand globs)
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    origins.add(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
    },
    plugins: [nextCookies()],
    baseURL,
    secret: requireAuthSecret(),
    trustedOrigins: [...origins].filter(Boolean),
  });
}

type AuthInstance = ReturnType<typeof createAuth>;

let authInstance: AuthInstance | undefined;
let bootstrapped = false;

export async function getAuth(): Promise<AuthInstance> {
  if (!authInstance) {
    const db = await getDb();
    authInstance = createAuth(db);
  }
  if (!bootstrapped && allowDemoBootstrap()) {
    bootstrapped = true;
    try {
      await ensureDemoUsers(authInstance);
    } catch (err) {
      console.error("[bootstrap] demo users failed", err);
      bootstrapped = false;
    }
  }
  return authInstance;
}
