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
    role: text("role").notNull(), // owner | dispatcher | driver
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
  // pending | assigned | in_transit | delivered | failed | cancelled
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

export const deliveryRelations = relations(delivery, ({ one }) => ({
  customer: one(customer, {
    fields: [delivery.customerId],
    references: [customer.id],
  }),
}));

export type Organization = typeof organization.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type Driver = typeof driver.$inferSelect;
export type Vehicle = typeof vehicle.$inferSelect;
export type Delivery = typeof delivery.$inferSelect;
export type Route = typeof route.$inferSelect;
export type Stop = typeof stop.$inferSelect;
export type Proof = typeof proof.$inferSelect;
export type MemberRole = "owner" | "dispatcher" | "driver";
