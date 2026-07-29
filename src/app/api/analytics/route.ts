import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { todayISO } from "@/server/lib/ids";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function eachDate(from: string, to: string) {
  const out: string[] = [];
  const cur = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const url = new URL(req.url);
    const to = url.searchParams.get("to") || todayISO();
    const from = url.searchParams.get("from") || daysAgo(6);
    const db = await getDb();
    const org = ctx.organizationId;

    const inRange = await db
      .select()
      .from(schema.delivery)
      .where(
        and(
          eq(schema.delivery.organizationId, org),
          gte(schema.delivery.scheduledDate, from),
          lte(schema.delivery.scheduledDate, to),
        ),
      );

    const routes = await db
      .select()
      .from(schema.route)
      .where(
        and(
          eq(schema.route.organizationId, org),
          gte(schema.route.routeDate, from),
          lte(schema.route.routeDate, to),
        ),
      );

    const routeIds = routes.map((r) => r.id);
    const stopsIn =
      routeIds.length === 0
        ? []
        : await db
            .select()
            .from(schema.stop)
            .where(
              and(
                eq(schema.stop.organizationId, org),
                inArray(schema.stop.routeId, routeIds),
              ),
            );

    const deliveredStops = stopsIn.filter((s) => s.status === "delivered").length;
    const failedStops = stopsIn.filter((s) => s.status === "failed").length;
    const totalStops = stopsIn.length;
    const otifPct =
      totalStops === 0 ? null : Math.round((deliveredStops / totalStops) * 100);

    const shipments = await db
      .select()
      .from(schema.freightShipment)
      .where(eq(schema.freightShipment.organizationId, org))
      .limit(500);
    const freightSpend = shipments.reduce(
      (s, x) => s + (x.expectedAmount || 0),
      0,
    );

    const visits = await db
      .select()
      .from(schema.yardVisit)
      .where(eq(schema.yardVisit.organizationId, org))
      .limit(500);
    const visitsInRange = visits.filter((v) => {
      const d = v.checkedInAt.toISOString().slice(0, 10);
      return d >= from && d <= to;
    });
    const withWait = visitsInRange.filter((v) => v.waitMinutes != null);
    const avgYardWait =
      withWait.length === 0
        ? null
        : Math.round(
            withWait.reduce((s, v) => s + (v.waitMinutes || 0), 0) /
              withWait.length,
          );

    const syncRuns = await db
      .select()
      .from(schema.integrationSyncRun)
      .where(eq(schema.integrationSyncRun.organizationId, org))
      .limit(200);
    const syncInRange = syncRuns.filter((r) => {
      const d = r.startedAt.toISOString().slice(0, 10);
      return d >= from && d <= to;
    });
    const erpImported = syncInRange.reduce(
      (s, r) => s + (r.createdDeliveries || 0),
      0,
    );

    const warehouses = await db
      .select()
      .from(schema.warehouse)
      .where(eq(schema.warehouse.organizationId, org));
    const docks = await db
      .select()
      .from(schema.dock)
      .where(eq(schema.dock.organizationId, org));
    const locations = await db
      .select()
      .from(schema.location)
      .where(eq(schema.location.organizationId, org));
    const stock = await db
      .select({
        stock: schema.stockLevel,
        location: schema.location,
      })
      .from(schema.stockLevel)
      .innerJoin(
        schema.location,
        eq(schema.stockLevel.locationId, schema.location.id),
      )
      .where(eq(schema.stockLevel.organizationId, org));

    const byWarehouse = warehouses.map((w) => {
      const whDocks = docks.filter((d) => d.warehouseId === w.id);
      const whLocs = locations.filter((l) => l.warehouseId === w.id);
      const whStock = stock.filter((s) => s.location.warehouseId === w.id);
      const skuQty = whStock.reduce((s, x) => s + (x.stock.qty || 0), 0);
      return {
        id: w.id,
        name: w.name,
        code: w.code,
        active: w.active,
        docksFree: whDocks.filter((d) => d.status === "free" && d.active).length,
        docksTotal: whDocks.filter((d) => d.active).length,
        locations: whLocs.length,
        stockLines: whStock.length,
        stockQty: Math.round(skuQty * 10) / 10,
      };
    });

    const daily = eachDate(from, to).map((date) => {
      const dayRoutes = routes.filter((r) => r.routeDate === date);
      const dayRouteIds = new Set(dayRoutes.map((r) => r.id));
      const dayStops = stopsIn.filter((s) => dayRouteIds.has(s.routeId));
      const del = dayStops.filter((s) => s.status === "delivered").length;
      const fail = dayStops.filter((s) => s.status === "failed").length;
      const tot = dayStops.length;
      const dayDeliv = inRange.filter((d) => d.scheduledDate === date);
      return {
        date,
        routes: dayRoutes.length,
        stops: tot,
        delivered: del,
        failed: fail,
        otifPct: tot === 0 ? null : Math.round((del / tot) * 100),
        deliveriesScheduled: dayDeliv.length,
      };
    });

    const statusFunnel = {
      pending: inRange.filter((d) => d.status === "pending").length,
      picking: inRange.filter((d) => d.status === "picking").length,
      ready_to_ship: inRange.filter((d) => d.status === "ready_to_ship").length,
      assigned: inRange.filter((d) => d.status === "assigned").length,
      in_transit: inRange.filter((d) => d.status === "in_transit").length,
      delivered: inRange.filter((d) => d.status === "delivered").length,
      failed: inRange.filter((d) => d.status === "failed").length,
    };

    return json({
      from,
      to,
      summary: {
        deliveriesScheduled: inRange.length,
        routes: routes.length,
        stops: totalStops,
        deliveredStops,
        failedStops,
        otifPct,
        freightSpend: Math.round(freightSpend * 100) / 100,
        yardVisits: visitsInRange.length,
        avgYardWaitMin: avgYardWait,
        erpImported,
        warehouses: warehouses.length,
      },
      statusFunnel,
      byWarehouse,
      daily,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
