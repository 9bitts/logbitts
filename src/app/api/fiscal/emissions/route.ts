import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id } from "@/server/lib/ids";
import {
  cancelEmission,
  getOrCreateFiscalConfig,
  submitEmission,
} from "@/server/fiscal";

export async function GET(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const docType = new URL(req.url).searchParams.get("type");
    const db = await getDb();
    const rows = await db
      .select({
        emission: schema.fiscalEmission,
        carrier: schema.carrier,
        shipment: schema.freightShipment,
      })
      .from(schema.fiscalEmission)
      .leftJoin(
        schema.carrier,
        eq(schema.fiscalEmission.carrierId, schema.carrier.id),
      )
      .leftJoin(
        schema.freightShipment,
        eq(schema.fiscalEmission.shipmentId, schema.freightShipment.id),
      )
      .where(
        docType
          ? and(
              eq(schema.fiscalEmission.organizationId, ctx.organizationId),
              eq(schema.fiscalEmission.docType, docType),
            )
          : eq(schema.fiscalEmission.organizationId, ctx.organizationId),
      )
      .orderBy(desc(schema.fiscalEmission.createdAt));

    return json(
      rows.map((r) => ({
        ...r.emission,
        carrier: r.carrier,
        shipment: r.shipment,
      })),
    );
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const body = await req.json();
    const db = await getDb();
    const action = body.action as string | undefined;

    if (!action || action === "create") {
      const docType = body.docType as string;
      if (!["cte", "mdfe", "ciot"].includes(docType)) {
        return json({ error: "docType inválido (cte|mdfe|ciot)" }, 400);
      }

      const cfg = await getOrCreateFiscalConfig(ctx.organizationId);
      let carrierId = body.carrierId || null;
      let freightAmount = Number(body.freightAmount || 0);
      let weightKg = body.weightKg != null ? Number(body.weightKg) : null;
      let originCity = body.originCity || null;
      let destCity = body.destCity || null;
      let originState = body.originState || "SP";
      let destState = body.destState || "SP";
      let shipmentId = body.shipmentId || null;
      let routeId = body.routeId || null;
      let vehiclePlate = body.vehiclePlate || null;
      let driverDocument = body.driverDocument || null;

      if (shipmentId) {
        const [sh] = await db
          .select({
            shipment: schema.freightShipment,
            delivery: schema.delivery,
            customer: schema.customer,
          })
          .from(schema.freightShipment)
          .leftJoin(
            schema.delivery,
            eq(schema.freightShipment.deliveryId, schema.delivery.id),
          )
          .leftJoin(
            schema.customer,
            eq(schema.delivery.customerId, schema.customer.id),
          )
          .where(
            and(
              eq(schema.freightShipment.id, shipmentId),
              eq(schema.freightShipment.organizationId, ctx.organizationId),
            ),
          )
          .limit(1);
        if (!sh) return json({ error: "Embarque não encontrado" }, 404);
        carrierId = sh.shipment.carrierId;
        freightAmount = sh.shipment.expectedAmount;
        weightKg = sh.delivery?.weightKg ?? weightKg;
        routeId = sh.shipment.routeId || routeId;
        if (sh.customer) {
          destCity = sh.customer.city;
          destState = sh.customer.state;
        }
        originCity = originCity || "São Paulo";
        originState = originState || "SP";
      }

      if (docType === "mdfe" && routeId) {
        const [rt] = await db
          .select({
            route: schema.route,
            vehicle: schema.vehicle,
            driver: schema.driver,
          })
          .from(schema.route)
          .leftJoin(
            schema.vehicle,
            eq(schema.route.vehicleId, schema.vehicle.id),
          )
          .leftJoin(schema.driver, eq(schema.route.driverId, schema.driver.id))
          .where(
            and(
              eq(schema.route.id, routeId),
              eq(schema.route.organizationId, ctx.organizationId),
            ),
          )
          .limit(1);
        if (!rt) return json({ error: "Rota não encontrada" }, 404);
        vehiclePlate = vehiclePlate || rt.vehicle?.plate || null;
        driverDocument = driverDocument || rt.driver?.document || null;
        originCity = originCity || "São Paulo";
        destCity = destCity || "São Paulo";
      }

      const row = {
        id: id("fem"),
        organizationId: ctx.organizationId,
        docType,
        status: "draft",
        provider: cfg.provider,
        shipmentId,
        routeId,
        carrierId,
        driverDocument,
        vehiclePlate,
        chave: null,
        number: null,
        series: null,
        protocol: null,
        externalId: null,
        freightAmount,
        weightKg,
        originCity,
        destCity,
        originState,
        destState,
        requestJson: null,
        responseJson: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        authorizedAt: null,
        cancelledAt: null,
      };
      await db.insert(schema.fiscalEmission).values(row);

      if (body.submit) {
        const submitted = await submitEmission(ctx.organizationId, row.id);
        return json(submitted, 201);
      }
      return json(row, 201);
    }

    if (action === "submit") {
      const submitted = await submitEmission(ctx.organizationId, body.id);
      return json(submitted);
    }

    if (action === "cancel") {
      const cancelled = await cancelEmission(
        ctx.organizationId,
        body.id,
        body.reason || "Cancelamento embarcador",
      );
      return json(cancelled);
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
