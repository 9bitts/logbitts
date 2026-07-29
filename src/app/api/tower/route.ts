import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { haversineKm, todayISO } from "@/server/lib/ids";

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

    const shipments = await db
      .select()
      .from(schema.freightShipment)
      .where(eq(schema.freightShipment.organizationId, ctx.organizationId))
      .limit(300);

    const ctes = await db
      .select()
      .from(schema.cteDocument)
      .where(eq(schema.cteDocument.organizationId, ctx.organizationId))
      .limit(300);

    const payload = routes.map((r) => {
      const rs = stops.filter((s) => s.stop.routeId === r.id);
      const done = rs.filter((s) =>
        ["delivered", "failed"].includes(s.stop.status),
      ).length;
      const delivered = rs.filter((s) => s.stop.status === "delivered").length;
      const failed = rs.filter((s) => s.stop.status === "failed").length;
      const otif =
        rs.length === 0 ? null : Math.round((delivered / rs.length) * 100);

      // rough km: depot → stops sequence
      let km = 0;
      let prev = {
        lat: r.depotLat ?? -23.55,
        lng: r.depotLng ?? -46.63,
      };
      for (const s of rs) {
        if (s.customer.lat != null && s.customer.lng != null) {
          km += haversineKm(prev, {
            lat: s.customer.lat,
            lng: s.customer.lng,
          });
          prev = { lat: s.customer.lat, lng: s.customer.lng };
        }
      }

      const linkedShipments = shipments.filter((s) => s.routeId === r.id);
      const freightCost = linkedShipments.reduce(
        (sum, s) => sum + (s.expectedAmount || 0),
        0,
      );
      const costPerKm = km > 0.1 ? freightCost / km : null;

      return {
        ...r,
        driver: drivers.find((d) => d.id === r.driverId) || null,
        progress: { done, total: rs.length, delivered, failed },
        metrics: {
          otifPct: otif,
          km: Math.round(km * 10) / 10,
          freightCost,
          costPerKm: costPerKm != null ? Math.round(costPerKm * 100) / 100 : null,
          slaRisk: otif != null && otif < 90,
        },
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

    const allStops = payload.flatMap((r) => r.stops);
    const totalStops = allStops.length;
    const deliveredStops = allStops.filter((s) => s.status === "delivered").length;
    const globalOtif =
      totalStops === 0 ? null : Math.round((deliveredStops / totalStops) * 100);

    const mismatchCtes = ctes.filter((c) => c.status === "mismatch").length;
    const openShipments = shipments.filter((s) =>
      ["booked", "in_transit"].includes(s.status),
    ).length;
    const freightSpend = shipments.reduce(
      (s, x) => s + (x.expectedAmount || 0),
      0,
    );

    const emissions = await db
      .select()
      .from(schema.fiscalEmission)
      .where(eq(schema.fiscalEmission.organizationId, ctx.organizationId))
      .limit(300);
    const authorizedEmissions = emissions.filter(
      (e) => e.status === "authorized" || e.status === "homologacao_mock",
    ).length;
    const fiscalErrors = emissions.filter((e) =>
      ["error", "rejected"].includes(e.status),
    ).length;

    const docks = await db
      .select()
      .from(schema.dock)
      .where(eq(schema.dock.organizationId, ctx.organizationId));
    const apptsToday = await db
      .select()
      .from(schema.yardAppointment)
      .where(
        and(
          eq(schema.yardAppointment.organizationId, ctx.organizationId),
          eq(schema.yardAppointment.scheduledDate, date),
        ),
      );
    const onSiteVisits = await db
      .select()
      .from(schema.yardVisit)
      .where(
        and(
          eq(schema.yardVisit.organizationId, ctx.organizationId),
          inArray(schema.yardVisit.status, ["on_site", "at_dock"]),
        ),
      );
    const departedToday = await db
      .select()
      .from(schema.yardVisit)
      .where(
        and(
          eq(schema.yardVisit.organizationId, ctx.organizationId),
          eq(schema.yardVisit.status, "departed"),
        ),
      );
    const withWait = departedToday.filter((v) => v.waitMinutes != null);
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
      .where(eq(schema.integrationSyncRun.organizationId, ctx.organizationId))
      .limit(100);
    const erpDeliveriesToday = syncRuns
      .filter((r) => r.status === "success" || r.status === "partial")
      .reduce((s, r) => s + (r.createdDeliveries || 0), 0);
    const lastErpSync = syncRuns.sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    )[0];

    return json({
      date,
      routes: payload,
      kpis: {
        otifPct: globalOtif,
        routesCount: routes.length,
        stopsTotal: totalStops,
        stopsDelivered: deliveredStops,
        openShipments,
        mismatchCtes,
        freightSpend: Math.round(freightSpend * 100) / 100,
        authorizedEmissions,
        fiscalErrors,
        docksFree: docks.filter((d) => d.status === "free" && d.active).length,
        docksTotal: docks.filter((d) => d.active).length,
        yardAppointments: apptsToday.length,
        vehiclesOnSite: onSiteVisits.length,
        avgYardWaitMin: avgYardWait,
        erpDeliveriesImported: erpDeliveriesToday,
        lastErpSyncAt: lastErpSync?.startedAt?.toISOString() || null,
        lastErpSyncStatus: lastErpSync?.status || null,
        avgCostPerKm: (() => {
          const withCost = payload.filter(
            (r) => r.metrics.costPerKm != null && r.metrics.km > 0,
          );
          if (!withCost.length) return null;
          const avg =
            withCost.reduce((s, r) => s + (r.metrics.costPerKm || 0), 0) /
            withCost.length;
          return Math.round(avg * 100) / 100;
        })(),
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
