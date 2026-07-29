import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

type Db =
  | ReturnType<typeof drizzlePglite<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __logbittsDb?: Db;
  __logbittsPglite?: PGlite;
  __logbittsPgClient?: ReturnType<typeof postgres>;
  __logbittsMigrated?: boolean;
};

function usePostgres() {
  const url = process.env.DATABASE_URL;
  return Boolean(url && url.startsWith("postgres") && process.env.USE_PGLITE !== "1");
}

async function createDb(): Promise<Db> {
  if (usePostgres()) {
    const client =
      globalForDb.__logbittsPgClient ??
      postgres(process.env.DATABASE_URL!, { max: 10 });
    globalForDb.__logbittsPgClient = client;
    return drizzlePostgres(client, { schema });
  }

  const dataDir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const pglite =
    globalForDb.__logbittsPglite ??
    new PGlite(dataDir);
  globalForDb.__logbittsPglite = pglite;
  return drizzlePglite(pglite, { schema });
}

export async function getDb(): Promise<Db> {
  if (!globalForDb.__logbittsDb) {
    globalForDb.__logbittsDb = await createDb();
  }
  if (!globalForDb.__logbittsMigrated) {
    await ensureSchema(globalForDb.__logbittsDb);
    globalForDb.__logbittsMigrated = true;
  }
  return globalForDb.__logbittsDb;
}

/** Auto-migrate for PGlite / quick pilot. Prefer drizzle-kit for Neon prod. */
async function ensureSchema(db: Db) {
  const sql = `
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  active_organization_id text
);
CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS member (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS member_org_user ON member(organization_id, user_id);
CREATE TABLE IF NOT EXISTS customer (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  phone text,
  email text,
  address text NOT NULL,
  neighborhood text,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  lat double precision,
  lng double precision,
  window_start text,
  window_end text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS driver (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  document text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vehicle (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  plate text NOT NULL,
  label text,
  capacity_kg double precision,
  capacity_m3 double precision,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS delivery (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  external_code text,
  invoice_number text,
  status text NOT NULL DEFAULT 'pending',
  weight_kg double precision DEFAULT 0,
  volume_m3 double precision DEFAULT 0,
  packages integer DEFAULT 1,
  scheduled_date text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS route (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name text NOT NULL,
  route_date text NOT NULL,
  driver_id text REFERENCES driver(id) ON DELETE SET NULL,
  vehicle_id text REFERENCES vehicle(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  depot_lat double precision,
  depot_lng double precision,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stop (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  route_id text NOT NULL REFERENCES route(id) ON DELETE CASCADE,
  delivery_id text NOT NULL REFERENCES delivery(id) ON DELETE RESTRICT,
  sequence integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  eta_minutes integer,
  arrived_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  occurrence_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stop_event (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  stop_id text NOT NULL REFERENCES stop(id) ON DELETE CASCADE,
  type text NOT NULL,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS proof (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  stop_id text NOT NULL REFERENCES stop(id) ON DELETE CASCADE,
  photo_url text,
  signature_url text,
  recipient_name text,
  lat double precision,
  lng double precision,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  if (typeof anyDb.session?.client?.exec === "function") {
    await anyDb.session.client.exec(sql);
    return;
  }
  if (globalForDb.__logbittsPglite) {
    await globalForDb.__logbittsPglite.exec(sql);
    return;
  }
  // postgres-js path
  if (globalForDb.__logbittsPgClient) {
    await globalForDb.__logbittsPgClient.unsafe(sql);
  }
}

export { schema };
