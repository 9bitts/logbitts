import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

/** Ensure a row id belongs to the caller's organization. */
export async function assertOwned(
  table:
    | typeof schema.customer
    | typeof schema.carrier
    | typeof schema.delivery
    | typeof schema.route
    | typeof schema.driver
    | typeof schema.vehicle
    | typeof schema.product
    | typeof schema.warehouse
    | typeof schema.freightQuote
    | typeof schema.freightShipment
    | typeof schema.loadOffer
    | typeof schema.tplClient,
  id: string,
  organizationId: string,
  label = "Registro",
) {
  const db = await getDb();
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.organizationId, organizationId)))
    .limit(1);
  if (!row) {
    throw new Response(JSON.stringify({ error: `${label} inválido` }), {
      status: 400,
    });
  }
  return row;
}

export async function assertOwnedOptional(
  table: Parameters<typeof assertOwned>[0],
  id: string | null | undefined,
  organizationId: string,
  label?: string,
) {
  if (!id) return;
  await assertOwned(table, id, organizationId, label);
}
