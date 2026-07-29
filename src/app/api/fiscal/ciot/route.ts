import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";

export async function GET() {
  try {
    const ctx = await requireDispatcher();
    const db = await getDb();
    const rows = await db
      .select({
        ciot: schema.ciotDocument,
        carrier: schema.carrier,
        shipment: schema.freightShipment,
        emission: schema.fiscalEmission,
      })
      .from(schema.ciotDocument)
      .leftJoin(
        schema.carrier,
        eq(schema.ciotDocument.carrierId, schema.carrier.id),
      )
      .leftJoin(
        schema.freightShipment,
        eq(schema.ciotDocument.shipmentId, schema.freightShipment.id),
      )
      .leftJoin(
        schema.fiscalEmission,
        eq(schema.ciotDocument.emissionId, schema.fiscalEmission.id),
      )
      .where(eq(schema.ciotDocument.organizationId, ctx.organizationId))
      .orderBy(desc(schema.ciotDocument.createdAt));

    return json(
      rows.map((r) => ({
        ...r.ciot,
        carrier: r.carrier,
        shipment: r.shipment,
        emission: r.emission,
      })),
    );
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
