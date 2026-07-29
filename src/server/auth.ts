import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "./db";
import { ensureDemoUsers } from "./bootstrap";

function appBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

function createAuth(db: Awaited<ReturnType<typeof getDb>>) {
  const baseURL = appBaseUrl();
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
    secret:
      process.env.BETTER_AUTH_SECRET ||
      "dev-secret-change-me-logbitts-32chars!!",
    trustedOrigins: [
      baseURL,
      process.env.NEXT_PUBLIC_APP_URL,
      "https://*.up.railway.app",
      "http://localhost:3000",
    ].filter(Boolean) as string[],
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
  if (!bootstrapped) {
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
