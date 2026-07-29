import { getDb, schema } from "@/server/db";
import { id } from "@/server/lib/ids";

export async function emitDomainEvent(input: {
  organizationId: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  warehouseId?: string | null;
  clientId?: string | null;
  payload?: unknown;
}) {
  const db = await getDb();
  const row = {
    id: id("evt"),
    organizationId: input.organizationId,
    eventType: input.eventType,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    warehouseId: input.warehouseId || null,
    clientId: input.clientId || null,
    payloadJson: input.payload != null ? JSON.stringify(input.payload) : null,
    createdAt: new Date(),
  };
  await db.insert(schema.domainEvent).values(row);
  return row;
}
