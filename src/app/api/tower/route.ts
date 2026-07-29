import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { todayISO } from "@/server/lib/ids";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || todayISO();
    const db = await getDb();

    const routes = await db
      .select()
      .from(schema.route)
      .where(
        and(
          eq(schema.route.organizationId, ctx.organizationId),
          eq(schema.route.routeDate, date),
        ),
      );

    const drivers = await db
      .select()
      .from(schema.driver)
      .where(eq(schema.driver.organizationId, ctx.organizationId));

    const routeIds = routes.map((r) => r.id);
    const stops =
      routeIds.length === 0
        ? []
        : await db
            .select({
              stop: schema.stop,
              delivery: schema.delivery,
              customer: schema.customer,
            })
            .from(schema.stop)
            .innerJoin(
              schema.delivery,
              eq(schema.stop.deliveryId, schema.delivery.id),
            )
            .innerJoin(
              schema.customer,
              eq(schema.delivery.customerId, schema.customer.id),
            )
            .where(inArray(schema.stop.routeId, routeIds))
            .orderBy(asc(schema.stop.sequence));

    const payload = routes.map((r) => {
      const rs = stops.filter((s) => s.stop.routeId === r.id);
      const done = rs.filter((s) =>
        ["delivered", "failed"].includes(s.stop.status),
      ).length;
      return {
        ...r,
        driver: drivers.find((d) => d.id === r.driverId) || null,
        progress: { done, total: rs.length },
        stops: rs.map((s) => ({
          id: s.stop.id,
          sequence: s.stop.sequence,
          status: s.stop.status,
          lat: s.customer.lat,
          lng: s.customer.lng,
          customerName: s.customer.name,
          address: s.customer.address,
          city: s.customer.city,
        })),
      };
    });

    return json({ date, routes: payload });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
