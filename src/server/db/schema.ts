import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // owner | dispatcher | driver | warehouse
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("member_org_user").on(t.organizationId, t.userId)],
);

export const customer = pgTable("customer", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  document: text("document"),
  phone: text("phone"),
  email: text("email"),
  address: text("address").notNull(),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  windowStart: text("window_start"),
  windowEnd: text("window_end"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const driver = pgTable("driver", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  phone: text("phone"),
  document: text("document"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vehicle = pgTable("vehicle", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  plate: text("plate").notNull(),
  label: text("label"),
  capacityKg: doublePrecision("capacity_kg"),
  capacityM3: doublePrecision("capacity_m3"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const delivery = pgTable("delivery", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  customerId: text("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "restrict" }),
  externalCode: text("external_code"),
  invoiceNumber: text("invoice_number"),
  status: text("status").notNull().default("pending"),
  // pending | picking | ready_to_ship | assigned | in_transit | delivered | failed | cancelled
  weightKg: doublePrecision("weight_kg").default(0),
  volumeM3: doublePrecision("volume_m3").default(0),
  packages: integer("packages").default(1),
  scheduledDate: text("scheduled_date"), // YYYY-MM-DD
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const route = pgTable("route", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  routeDate: text("route_date").notNull(), // YYYY-MM-DD
  driverId: text("driver_id").references(() => driver.id, {
    onDelete: "set null",
  }),
  vehicleId: text("vehicle_id").references(() => vehicle.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("draft"),
  // draft | published | in_progress | completed
  depotLat: doublePrecision("depot_lat"),
  depotLng: doublePrecision("depot_lng"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stop = pgTable("stop", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  routeId: text("route_id")
    .notNull()
    .references(() => route.id, { onDelete: "cascade" }),
  deliveryId: text("delivery_id")
    .notNull()
    .references(() => delivery.id, { onDelete: "restrict" }),
  sequence: integer("sequence").notNull(),
  status: text("status").notNull().default("pending"),
  // pending | en_route | arrived | delivered | failed
  etaMinutes: integer("eta_minutes"),
  arrivedAt: timestamp("arrived_at"),
  completedAt: timestamp("completed_at"),
  failureReason: text("failure_reason"),
  occurrenceNotes: text("occurrence_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stopEvent = pgTable("stop_event", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  stopId: text("stop_id")
    .notNull()
    .references(() => stop.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  // started | arrived | delivered | failed | occurrence
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const proof = pgTable("proof", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  stopId: text("stop_id")
    .notNull()
    .references(() => stop.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url"),
  signatureUrl: text("signature_url"),
  recipientName: text("recipient_name"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  customers: many(customer),
  drivers: many(driver),
  vehicles: many(vehicle),
  deliveries: many(delivery),
  routes: many(route),
}));

export const routeRelations = relations(route, ({ one, many }) => ({
  driver: one(driver, { fields: [route.driverId], references: [driver.id] }),
  vehicle: one(vehicle, {
    fields: [route.vehicleId],
    references: [vehicle.id],
  }),
  stops: many(stop),
}));

export const stopRelations = relations(stop, ({ one, many }) => ({
  route: one(route, { fields: [stop.routeId], references: [route.id] }),
  delivery: one(delivery, {
    fields: [stop.deliveryId],
    references: [delivery.id],
  }),
  events: many(stopEvent),
  proofs: many(proof),
}));

export const deliveryRelations = relations(delivery, ({ one, many }) => ({
  customer: one(customer, {
    fields: [delivery.customerId],
    references: [customer.id],
  }),
  lines: many(deliveryLine),
}));

export const warehouse = pgTable("warehouse", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const product = pgTable(
  "product",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    barcode: text("barcode"),
    unit: text("unit").notNull().default("UN"),
    weightKg: doublePrecision("weight_kg").default(0),
    volumeM3: doublePrecision("volume_m3").default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("product_org_sku").on(t.organizationId, t.sku)],
);

export const location = pgTable(
  "location",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    type: text("type").notNull().default("storage"),
    // receiving | storage | picking | shipping
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("location_wh_code").on(t.warehouseId, t.code)],
);

export const stockLevel = pgTable(
  "stock_level",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    qty: doublePrecision("qty").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stock_product_location").on(t.productId, t.locationId)],
);

export const stockMovement = pgTable("stock_movement", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "restrict" }),
  locationId: text("location_id").references(() => location.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull(),
  // receipt | putaway | pick | adjust | cycle
  qty: doublePrecision("qty").notNull(),
  refType: text("ref_type"),
  refId: text("ref_id"),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const receipt = pgTable("receipt", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  code: text("code"),
  supplier: text("supplier"),
  status: text("status").notNull().default("open"),
  // open | receiving | closed
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const receiptLine = pgTable("receipt_line", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  receiptId: text("receipt_id")
    .notNull()
    .references(() => receipt.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "restrict" }),
  qtyExpected: doublePrecision("qty_expected").notNull().default(0),
  qtyReceived: doublePrecision("qty_received").notNull().default(0),
  putawayLocationId: text("putaway_location_id").references(() => location.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("pending"),
  // pending | received | putaway
});

export const deliveryLine = pgTable("delivery_line", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  deliveryId: text("delivery_id")
    .notNull()
    .references(() => delivery.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "restrict" }),
  qty: doublePrecision("qty").notNull().default(1),
  qtyPicked: doublePrecision("qty_picked").notNull().default(0),
});

export const pickWave = pgTable("pick_wave", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  waveDate: text("wave_date").notNull(),
  status: text("status").notNull().default("draft"),
  // draft | released | done
  createdAt: timestamp("created_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
  completedAt: timestamp("completed_at"),
});

export const pickTask = pgTable("pick_task", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  waveId: text("wave_id")
    .notNull()
    .references(() => pickWave.id, { onDelete: "cascade" }),
  deliveryId: text("delivery_id")
    .notNull()
    .references(() => delivery.id, { onDelete: "cascade" }),
  deliveryLineId: text("delivery_line_id").references(() => deliveryLine.id, {
    onDelete: "set null",
  }),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "restrict" }),
  fromLocationId: text("from_location_id").references(() => location.id, {
    onDelete: "set null",
  }),
  qty: doublePrecision("qty").notNull(),
  qtyPicked: doublePrecision("qty_picked").notNull().default(0),
  status: text("status").notNull().default("pending"),
  // pending | done | cancelled
  assignedUserId: text("assigned_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  completedAt: timestamp("completed_at"),
});

export const cycleCount = pgTable("cycle_count", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("open"),
  // open | done
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const cycleCountLine = pgTable("cycle_count_line", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  cycleCountId: text("cycle_count_id")
    .notNull()
    .references(() => cycleCount.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "restrict" }),
  locationId: text("location_id")
    .notNull()
    .references(() => location.id, { onDelete: "restrict" }),
  qtySystem: doublePrecision("qty_system").notNull().default(0),
  qtyCounted: doublePrecision("qty_counted"),
  status: text("status").notNull().default("pending"),
  // pending | counted
});

/** Phase 3 — TMS Embarcador */
export const carrier = pgTable("carrier", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  document: text("document"), // CNPJ
  rntrc: text("rntrc"),
  email: text("email"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const freightRateTable = pgTable("freight_rate_table", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  carrierId: text("carrier_id").references(() => carrier.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const freightRate = pgTable("freight_rate", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  tableId: text("table_id")
    .notNull()
    .references(() => freightRateTable.id, { onDelete: "cascade" }),
  originState: text("origin_state").notNull(),
  destState: text("dest_state").notNull(),
  originZipPrefix: text("origin_zip_prefix"),
  destZipPrefix: text("dest_zip_prefix"),
  minWeightKg: doublePrecision("min_weight_kg").notNull().default(0),
  maxWeightKg: doublePrecision("max_weight_kg").notNull().default(99999),
  pricePerKg: doublePrecision("price_per_kg").notNull().default(0),
  minimumPrice: doublePrecision("minimum_price").notNull().default(0),
  fixedPrice: doublePrecision("fixed_price"),
  transitDays: integer("transit_days").default(3),
});

export const freightQuote = pgTable("freight_quote", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  carrierId: text("carrier_id").references(() => carrier.id, {
    onDelete: "set null",
  }),
  tableId: text("table_id").references(() => freightRateTable.id, {
    onDelete: "set null",
  }),
  rateId: text("rate_id").references(() => freightRate.id, {
    onDelete: "set null",
  }),
  deliveryId: text("delivery_id").references(() => delivery.id, {
    onDelete: "set null",
  }),
  originState: text("origin_state").notNull(),
  destState: text("dest_state").notNull(),
  originZip: text("origin_zip"),
  destZip: text("dest_zip"),
  weightKg: doublePrecision("weight_kg").notNull().default(0),
  amount: doublePrecision("amount").notNull(),
  transitDays: integer("transit_days"),
  status: text("status").notNull().default("open"),
  // open | selected | expired
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const freightShipment = pgTable("freight_shipment", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  carrierId: text("carrier_id")
    .notNull()
    .references(() => carrier.id, { onDelete: "restrict" }),
  quoteId: text("quote_id").references(() => freightQuote.id, {
    onDelete: "set null",
  }),
  deliveryId: text("delivery_id").references(() => delivery.id, {
    onDelete: "set null",
  }),
  routeId: text("route_id").references(() => route.id, {
    onDelete: "set null",
  }),
  externalCode: text("external_code"),
  expectedAmount: doublePrecision("expected_amount").notNull().default(0),
  status: text("status").notNull().default("booked"),
  // booked | in_transit | delivered | cancelled
  trackingCode: text("tracking_code"),
  bookedAt: timestamp("booked_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  notes: text("notes"),
});

export const cteDocument = pgTable("cte_document", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  shipmentId: text("shipment_id").references(() => freightShipment.id, {
    onDelete: "set null",
  }),
  carrierId: text("carrier_id").references(() => carrier.id, {
    onDelete: "set null",
  }),
  chave: text("chave"),
  number: text("number"),
  series: text("series"),
  issueDate: text("issue_date"),
  carrierDocument: text("carrier_document"),
  freightAmount: doublePrecision("freight_amount").notNull().default(0),
  weightKg: doublePrecision("weight_kg"),
  originCity: text("origin_city"),
  destCity: text("dest_city"),
  status: text("status").notNull().default("imported"),
  // imported | matched | mismatch | reconciled | authorized | cancelled
  source: text("source").notNull().default("imported"),
  // imported | emitted
  emissionId: text("emission_id"),
  protocol: text("protocol"),
  expectedAmount: doublePrecision("expected_amount"),
  variance: doublePrecision("variance"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const freightInvoice = pgTable("freight_invoice", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  carrierId: text("carrier_id")
    .notNull()
    .references(() => carrier.id, { onDelete: "restrict" }),
  number: text("number").notNull(),
  issueDate: text("issue_date"),
  totalAmount: doublePrecision("total_amount").notNull().default(0),
  status: text("status").notNull().default("open"),
  // open | reconciled | disputed | paid
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reconciledAt: timestamp("reconciled_at"),
});

export const freightInvoiceLine = pgTable("freight_invoice_line", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => freightInvoice.id, { onDelete: "cascade" }),
  cteId: text("cte_id").references(() => cteDocument.id, {
    onDelete: "set null",
  }),
  shipmentId: text("shipment_id").references(() => freightShipment.id, {
    onDelete: "set null",
  }),
  description: text("description"),
  amount: doublePrecision("amount").notNull().default(0),
  expectedAmount: doublePrecision("expected_amount"),
  variance: doublePrecision("variance"),
  status: text("status").notNull().default("pending"),
  // pending | ok | mismatch
});

/** Phase 4 — emissão fiscal via parceiro (CT-e / MDF-e / CIOT) */
export const fiscalProviderConfig = pgTable("fiscal_provider_config", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("mock"),
  // mock | http_stub
  environment: text("environment").notNull().default("homologacao"),
  // homologacao | producao
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  companyDocument: text("company_document"),
  companyName: text("company_name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fiscalEmission = pgTable("fiscal_emission", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),
  // cte | mdfe | ciot
  status: text("status").notNull().default("draft"),
  // draft | queued | processing | authorized | rejected | cancelled | error
  provider: text("provider").notNull().default("mock"),
  shipmentId: text("shipment_id").references(() => freightShipment.id, {
    onDelete: "set null",
  }),
  routeId: text("route_id").references(() => route.id, {
    onDelete: "set null",
  }),
  carrierId: text("carrier_id").references(() => carrier.id, {
    onDelete: "set null",
  }),
  driverDocument: text("driver_document"),
  vehiclePlate: text("vehicle_plate"),
  chave: text("chave"),
  number: text("number"),
  series: text("series"),
  protocol: text("protocol"),
  externalId: text("external_id"),
  freightAmount: doublePrecision("freight_amount").notNull().default(0),
  weightKg: doublePrecision("weight_kg"),
  originCity: text("origin_city"),
  destCity: text("dest_city"),
  originState: text("origin_state"),
  destState: text("dest_state"),
  requestJson: text("request_json"),
  responseJson: text("response_json"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  authorizedAt: timestamp("authorized_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export const mdfeDocument = pgTable("mdfe_document", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  emissionId: text("emission_id").references(() => fiscalEmission.id, {
    onDelete: "set null",
  }),
  routeId: text("route_id").references(() => route.id, {
    onDelete: "set null",
  }),
  chave: text("chave"),
  number: text("number"),
  series: text("series"),
  protocol: text("protocol"),
  status: text("status").notNull().default("authorized"),
  vehiclePlate: text("vehicle_plate"),
  driverName: text("driver_name"),
  cteKeysJson: text("cte_keys_json"),
  issueDate: text("issue_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ciotDocument = pgTable("ciot_document", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  emissionId: text("emission_id").references(() => fiscalEmission.id, {
    onDelete: "set null",
  }),
  shipmentId: text("shipment_id").references(() => freightShipment.id, {
    onDelete: "set null",
  }),
  carrierId: text("carrier_id").references(() => carrier.id, {
    onDelete: "set null",
  }),
  ciotNumber: text("ciot_number"),
  protocol: text("protocol"),
  contractorDocument: text("contractor_document"),
  hiredDocument: text("hired_document"),
  freightAmount: doublePrecision("freight_amount").notNull().default(0),
  status: text("status").notNull().default("authorized"),
  vehiclePlate: text("vehicle_plate"),
  driverDocument: text("driver_document"),
  issueDate: text("issue_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Organization = typeof organization.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type Driver = typeof driver.$inferSelect;
export type Vehicle = typeof vehicle.$inferSelect;
export type Delivery = typeof delivery.$inferSelect;
export type Route = typeof route.$inferSelect;
export type Stop = typeof stop.$inferSelect;
export type Proof = typeof proof.$inferSelect;
export type Product = typeof product.$inferSelect;
export type Warehouse = typeof warehouse.$inferSelect;
export type Location = typeof location.$inferSelect;
export type Carrier = typeof carrier.$inferSelect;
export type FiscalEmission = typeof fiscalEmission.$inferSelect;
export type MemberRole = "owner" | "dispatcher" | "driver" | "warehouse";
