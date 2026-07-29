/** Runtime environment helpers for prod hardening. */

export function isProduction() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function allowDemoBootstrap() {
  if (process.env.ALLOW_DEMO_BOOTSTRAP === "1") return true;
  if (process.env.ALLOW_DEMO_BOOTSTRAP === "0") return false;
  return !isProduction();
}

export function requireAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction()) {
    throw new Error(
      "BETTER_AUTH_SECRET is required in production (min 32 chars)",
    );
  }
  return secret || "dev-secret-change-me-logbitts-32chars!!";
}

export function showDemoCredentials() {
  return allowDemoBootstrap();
}
