import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { todayISO } from "@/server/lib/ids";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Event lake lite — query domain_event stream + type histogram */
export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || daysAgo(6);
    const to = url.searchParams.get("to") || todayISO();
    const eventType = url.searchParams.get("type");
    const db = await getDb();

    let events = await db
      .select()
      .from(schema.domainEvent)
      .where(eq(schema.domainEvent.organizationId, ctx.organizationId))
      .orderBy(desc(schema.domainEvent.createdAt))
      .limit(500);

    events = events.filter((e) => {
      const d = e.createdAt.toISOString().slice(0, 10);
      return d >= from && d <= to;
    });
    if (eventType) {
      events = events.filter((e) => e.eventType === eventType);
    }

    const byType: Record<string, number> = {};
    for (const e of events) {
      byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    }

    const byDay: Record<string, number> = {};
    for (const e of events) {
      const d = e.createdAt.toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + 1;
    }

    return json({
      from,
      to,
      total: events.length,
      byType,
      byDay: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      events: events.slice(0, 100).map((e) => ({
        ...e,
        payload: e.payloadJson ? JSON.parse(e.payloadJson) : null,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
