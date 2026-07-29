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
CREATE TABLE IF NOT EXISTS warehouse (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  barcode text,
  unit text NOT NULL DEFAULT 'UN',
  weight_kg double precision DEFAULT 0,
  volume_m3 double precision DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_org_sku ON product(organization_id, sku);
CREATE TABLE IF NOT EXISTS location (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL DEFAULT 'storage',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS location_wh_code ON location(warehouse_id, code);
CREATE TABLE IF NOT EXISTS stock_level (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  location_id text NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  qty double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_product_location ON stock_level(product_id, location_id);
CREATE TABLE IF NOT EXISTS stock_movement (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  location_id text REFERENCES location(id) ON DELETE SET NULL,
  type text NOT NULL,
  qty double precision NOT NULL,
  ref_type text,
  ref_id text,
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS receipt (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  code text,
  supplier text,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS receipt_line (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  receipt_id text NOT NULL REFERENCES receipt(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  qty_expected double precision NOT NULL DEFAULT 0,
  qty_received double precision NOT NULL DEFAULT 0,
  putaway_location_id text REFERENCES location(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
);
CREATE TABLE IF NOT EXISTS delivery_line (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  delivery_id text NOT NULL REFERENCES delivery(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  qty double precision NOT NULL DEFAULT 1,
  qty_picked double precision NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pick_wave (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  name text NOT NULL,
  wave_date text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS pick_task (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  wave_id text NOT NULL REFERENCES pick_wave(id) ON DELETE CASCADE,
  delivery_id text NOT NULL REFERENCES delivery(id) ON DELETE CASCADE,
  delivery_line_id text REFERENCES delivery_line(id) ON DELETE SET NULL,
  product_id text NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  from_location_id text REFERENCES location(id) ON DELETE SET NULL,
  qty double precision NOT NULL,
  qty_picked double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  assigned_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS cycle_count (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS cycle_count_line (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  cycle_count_id text NOT NULL REFERENCES cycle_count(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  location_id text NOT NULL REFERENCES location(id) ON DELETE RESTRICT,
  qty_system double precision NOT NULL DEFAULT 0,
  qty_counted double precision,
  status text NOT NULL DEFAULT 'pending'
);
CREATE TABLE IF NOT EXISTS carrier (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  rntrc text,
  email text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS freight_rate_table (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  carrier_id text REFERENCES carrier(id) ON DELETE SET NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS freight_rate (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  table_id text NOT NULL REFERENCES freight_rate_table(id) ON DELETE CASCADE,
  origin_state text NOT NULL,
  dest_state text NOT NULL,
  origin_zip_prefix text,
  dest_zip_prefix text,
  min_weight_kg double precision NOT NULL DEFAULT 0,
  max_weight_kg double precision NOT NULL DEFAULT 99999,
  price_per_kg double precision NOT NULL DEFAULT 0,
  minimum_price double precision NOT NULL DEFAULT 0,
  fixed_price double precision,
  transit_days integer DEFAULT 3
);
CREATE TABLE IF NOT EXISTS freight_quote (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  carrier_id text REFERENCES carrier(id) ON DELETE SET NULL,
  table_id text REFERENCES freight_rate_table(id) ON DELETE SET NULL,
  rate_id text REFERENCES freight_rate(id) ON DELETE SET NULL,
  delivery_id text REFERENCES delivery(id) ON DELETE SET NULL,
  origin_state text NOT NULL,
  dest_state text NOT NULL,
  origin_zip text,
  dest_zip text,
  weight_kg double precision NOT NULL DEFAULT 0,
  amount double precision NOT NULL,
  transit_days integer,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS freight_shipment (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  carrier_id text NOT NULL REFERENCES carrier(id) ON DELETE RESTRICT,
  quote_id text REFERENCES freight_quote(id) ON DELETE SET NULL,
  delivery_id text REFERENCES delivery(id) ON DELETE SET NULL,
  route_id text REFERENCES route(id) ON DELETE SET NULL,
  external_code text,
  expected_amount double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'booked',
  tracking_code text,
  booked_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  notes text
);
CREATE TABLE IF NOT EXISTS cte_document (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  shipment_id text REFERENCES freight_shipment(id) ON DELETE SET NULL,
  carrier_id text REFERENCES carrier(id) ON DELETE SET NULL,
  chave text,
  number text,
  series text,
  issue_date text,
  carrier_document text,
  freight_amount double precision NOT NULL DEFAULT 0,
  weight_kg double precision,
  origin_city text,
  dest_city text,
  status text NOT NULL DEFAULT 'imported',
  expected_amount double precision,
  variance double precision,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS freight_invoice (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  carrier_id text NOT NULL REFERENCES carrier(id) ON DELETE RESTRICT,
  number text NOT NULL,
  issue_date text,
  total_amount double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz
);
CREATE TABLE IF NOT EXISTS freight_invoice_line (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES freight_invoice(id) ON DELETE CASCADE,
  cte_id text REFERENCES cte_document(id) ON DELETE SET NULL,
  shipment_id text REFERENCES freight_shipment(id) ON DELETE SET NULL,
  description text,
  amount double precision NOT NULL DEFAULT 0,
  expected_amount double precision,
  variance double precision,
  status text NOT NULL DEFAULT 'pending'
);
CREATE TABLE IF NOT EXISTS fiscal_provider_config (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock',
  environment text NOT NULL DEFAULT 'homologacao',
  api_key text,
  base_url text,
  company_document text,
  company_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fiscal_emission (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  provider text NOT NULL DEFAULT 'mock',
  shipment_id text REFERENCES freight_shipment(id) ON DELETE SET NULL,
  route_id text REFERENCES route(id) ON DELETE SET NULL,
  carrier_id text REFERENCES carrier(id) ON DELETE SET NULL,
  driver_document text,
  vehicle_plate text,
  chave text,
  number text,
  series text,
  protocol text,
  external_id text,
  freight_amount double precision NOT NULL DEFAULT 0,
  weight_kg double precision,
  origin_city text,
  dest_city text,
  origin_state text,
  dest_state text,
  request_json text,
  response_json text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz,
  cancelled_at timestamptz
);
CREATE TABLE IF NOT EXISTS mdfe_document (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  emission_id text REFERENCES fiscal_emission(id) ON DELETE SET NULL,
  route_id text REFERENCES route(id) ON DELETE SET NULL,
  chave text,
  number text,
  series text,
  protocol text,
  status text NOT NULL DEFAULT 'authorized',
  vehicle_plate text,
  driver_name text,
  cte_keys_json text,
  issue_date text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ciot_document (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  emission_id text REFERENCES fiscal_emission(id) ON DELETE SET NULL,
  shipment_id text REFERENCES freight_shipment(id) ON DELETE SET NULL,
  carrier_id text REFERENCES carrier(id) ON DELETE SET NULL,
  ciot_number text,
  protocol text,
  contractor_document text,
  hired_document text,
  freight_amount double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'authorized',
  vehicle_plate text,
  driver_document text,
  issue_date text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cte_document ADD COLUMN IF NOT EXISTS source text DEFAULT 'imported';
ALTER TABLE cte_document ADD COLUMN IF NOT EXISTS emission_id text;
ALTER TABLE cte_document ADD COLUMN IF NOT EXISTS protocol text;
CREATE TABLE IF NOT EXISTS dock (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'both',
  status text NOT NULL DEFAULT 'free',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS yard_appointment (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  dock_id text REFERENCES dock(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'inbound',
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_date text NOT NULL,
  window_start text NOT NULL DEFAULT '08:00',
  window_end text NOT NULL DEFAULT '09:00',
  carrier_id text REFERENCES carrier(id) ON DELETE SET NULL,
  vehicle_plate text,
  driver_name text,
  driver_document text,
  receipt_id text REFERENCES receipt(id) ON DELETE SET NULL,
  shipment_id text REFERENCES freight_shipment(id) ON DELETE SET NULL,
  route_id text REFERENCES route(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS yard_visit (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  appointment_id text REFERENCES yard_appointment(id) ON DELETE SET NULL,
  warehouse_id text NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  dock_id text REFERENCES dock(id) ON DELETE SET NULL,
  vehicle_plate text NOT NULL,
  driver_name text,
  status text NOT NULL DEFAULT 'on_site',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  dock_assigned_at timestamptz,
  checked_out_at timestamptz,
  wait_minutes integer,
  notes text
);
CREATE TABLE IF NOT EXISTS integration_connector (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  config_json text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS integration_sync_run (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  connector_id text NOT NULL REFERENCES integration_connector(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'pull',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_customers integer NOT NULL DEFAULT 0,
  created_deliveries integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  message text,
  detail_json text
);
ALTER TABLE integration_connector ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE delivery ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE delivery ADD COLUMN IF NOT EXISTS erp_key text;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS erp_key text;
ALTER TABLE warehouse ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE warehouse ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE delivery ADD COLUMN IF NOT EXISTS client_id text;
CREATE TABLE IF NOT EXISTS tpl_client (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  document text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS domain_event (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  warehouse_id text,
  client_id text,
  payload_json text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS load_offer (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  delivery_id text REFERENCES delivery(id) ON DELETE SET NULL,
  shipment_id text REFERENCES freight_shipment(id) ON DELETE SET NULL,
  origin_city text NOT NULL,
  origin_state text NOT NULL,
  dest_city text NOT NULL,
  dest_state text NOT NULL,
  weight_kg double precision NOT NULL DEFAULT 0,
  volume_m3 double precision DEFAULT 0,
  price_ask double precision,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE TABLE IF NOT EXISTS load_bid (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  offer_id text NOT NULL REFERENCES load_offer(id) ON DELETE CASCADE,
  carrier_id text NOT NULL REFERENCES carrier(id) ON DELETE RESTRICT,
  amount double precision NOT NULL,
  transit_days integer DEFAULT 2,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS slotting_rule (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  warehouse_id text REFERENCES warehouse(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  product_sku_prefix text,
  location_type text,
  prefer_picking boolean NOT NULL DEFAULT true,
  max_weight_kg double precision,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fiscal_certificate (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'A1',
  alias text NOT NULL,
  cnpj text,
  fingerprint text,
  storage_ref text,
  valid_from text,
  valid_to text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_user_idx ON member(user_id);
CREATE INDEX IF NOT EXISTS customer_org_idx ON customer(organization_id);
CREATE INDEX IF NOT EXISTS delivery_org_date_idx ON delivery(organization_id, scheduled_date);
CREATE INDEX IF NOT EXISTS delivery_org_status_idx ON delivery(organization_id, status);
CREATE INDEX IF NOT EXISTS route_org_date_idx ON route(organization_id, route_date);
CREATE INDEX IF NOT EXISTS stop_route_idx ON stop(route_id);
CREATE INDEX IF NOT EXISTS stop_org_idx ON stop(organization_id);
CREATE INDEX IF NOT EXISTS domain_event_org_created_idx ON domain_event(organization_id, created_at);
CREATE INDEX IF NOT EXISTS proof_org_stop_idx ON proof(organization_id, stop_id);
CREATE INDEX IF NOT EXISTS freight_shipment_org_idx ON freight_shipment(organization_id);
CREATE INDEX IF NOT EXISTS fiscal_emission_org_idx ON fiscal_emission(organization_id);
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
