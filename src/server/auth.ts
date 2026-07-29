import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "./db";

function createAuth(db: Awaited<ReturnType<typeof getDb>>) {
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
    baseURL:
      process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000",
    secret:
      process.env.BETTER_AUTH_SECRET ||
      "dev-secret-change-me-logbitts-32chars!!",
  });
}

type AuthInstance = ReturnType<typeof createAuth>;

let authInstance: AuthInstance | undefined;

export async function getAuth(): Promise<AuthInstance> {
  if (authInstance) return authInstance;
  const db = await getDb();
  authInstance = createAuth(db);
  return authInstance;
}
