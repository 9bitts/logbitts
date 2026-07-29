import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { id, todayISO } from "@/server/lib/ids";
import { createHttpStubProvider } from "./http-stub";
import { createMockProvider } from "./mock";
import type {
  FiscalDocType,
  FiscalEmitRequest,
  FiscalProvider,
  FiscalProviderKind,
} from "./types";

export async function getOrCreateFiscalConfig(organizationId: string) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(schema.fiscalProviderConfig)
    .where(
      and(
        eq(schema.fiscalProviderConfig.organizationId, organizationId),
        eq(schema.fiscalProviderConfig.active, true),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const envProvider = (process.env.FISCAL_PROVIDER || "mock") as FiscalProviderKind;
  const row = {
    id: id("fpc"),
    organizationId,
    provider: envProvider === "http_stub" ? "http_stub" : "mock",
    environment: process.env.FISCAL_ENVIRONMENT || "homologacao",
    apiKey: process.env.FISCAL_API_KEY || null,
    baseUrl: process.env.FISCAL_PARTNER_URL || null,
    companyDocument: process.env.FISCAL_COMPANY_CNPJ || "00.000.000/0001-91",
    companyName: process.env.FISCAL_COMPANY_NAME || "Distribuidora Demo Logbitts",
    active: true,
    createdAt: new Date(),
  };
  await db.insert(schema.fiscalProviderConfig).values(row);
  return row;
}

export function resolveProvider(cfg: {
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
}): FiscalProvider {
  if (cfg.provider === "http_stub" && cfg.baseUrl) {
    return createHttpStubProvider(cfg.baseUrl, cfg.apiKey);
  }
  return createMockProvider();
}

async function buildEmitRequest(
  organizationId: string,
  emission: typeof schema.fiscalEmission.$inferSelect,
  cfg: typeof schema.fiscalProviderConfig.$inferSelect,
): Promise<FiscalEmitRequest> {
  const db = await getDb();
  let carrierDocument: string | null = null;
  let carrierName: string | null = null;
  let shipmentCode: string | null = null;
  let routeCode: string | null = null;
  let driverName: string | null = null;
  let cteKeys: string[] = [];

  if (emission.carrierId) {
    const [car] = await db
      .select()
      .from(schema.carrier)
      .where(eq(schema.carrier.id, emission.carrierId))
      .limit(1);
    if (car) {
      carrierDocument = car.document;
      carrierName = car.name;
    }
  }
  if (emission.shipmentId) {
    const [sh] = await db
      .select()
      .from(schema.freightShipment)
      .where(eq(schema.freightShipment.id, emission.shipmentId))
      .limit(1);
    if (sh) shipmentCode = sh.externalCode;
  }
  if (emission.routeId) {
    const [rt] = await db
      .select()
      .from(schema.route)
      .where(eq(schema.route.id, emission.routeId))
      .limit(1);
    if (rt) {
      routeCode = rt.name || rt.id;
      if (rt.driverId) {
        const [dr] = await db
          .select()
          .from(schema.driver)
          .where(eq(schema.driver.id, rt.driverId))
          .limit(1);
        if (dr) driverName = dr.name;
      }
    }
    const ctes = await db
      .select()
      .from(schema.cteDocument)
      .where(
        and(
          eq(schema.cteDocument.organizationId, organizationId),
          eq(schema.cteDocument.status, "matched"),
        ),
      );
    // Prefer CT-es from shipments on this route
    const routeShipments = await db
      .select()
      .from(schema.freightShipment)
      .where(eq(schema.freightShipment.routeId, emission.routeId));
    const shIds = new Set(routeShipments.map((s) => s.id));
    cteKeys = ctes
      .filter((c) => c.shipmentId && shIds.has(c.shipmentId) && c.chave)
      .map((c) => c.chave!);
    if (!cteKeys.length) {
      cteKeys = ctes.filter((c) => c.chave).map((c) => c.chave!).slice(0, 5);
    }
  }

  return {
    emissionId: emission.id,
    docType: emission.docType as FiscalDocType,
    environment: cfg.environment,
    companyDocument: cfg.companyDocument || "",
    companyName: cfg.companyName || "",
    carrierDocument,
    carrierName,
    freightAmount: emission.freightAmount,
    weightKg: emission.weightKg,
    originCity: emission.originCity,
    destCity: emission.destCity,
    originState: emission.originState,
    destState: emission.destState,
    vehiclePlate: emission.vehiclePlate,
    driverDocument: emission.driverDocument,
    driverName,
    cteKeys,
    shipmentCode,
    routeCode,
  };
}

async function persistAuthorizedDocs(
  organizationId: string,
  emission: typeof schema.fiscalEmission.$inferSelect,
  result: {
    chave?: string;
    number?: string;
    series?: string;
    protocol?: string;
    ciotNumber?: string;
  },
) {
  const db = await getDb();
  const issueDate = todayISO();

  if (emission.docType === "cte") {
    const expected = emission.freightAmount;
    const freightAmount = emission.freightAmount;
    const variance = freightAmount - expected;
    await db.insert(schema.cteDocument).values({
      id: id("cte"),
      organizationId,
      shipmentId: emission.shipmentId,
      carrierId: emission.carrierId,
      chave: result.chave || null,
      number: result.number || null,
      series: result.series || "1",
      issueDate,
      carrierDocument: null,
      freightAmount,
      weightKg: emission.weightKg,
      originCity: emission.originCity,
      destCity: emission.destCity,
      status: "matched",
      source: "emitted",
      emissionId: emission.id,
      protocol: result.protocol || null,
      expectedAmount: expected,
      variance,
      notes: `Emissão fiscal ${emission.id}`,
      createdAt: new Date(),
    });
  }

  if (emission.docType === "mdfe") {
    const req = emission.requestJson ? JSON.parse(emission.requestJson) : {};
    await db.insert(schema.mdfeDocument).values({
      id: id("mdfe"),
      organizationId,
      emissionId: emission.id,
      routeId: emission.routeId,
      chave: result.chave || null,
      number: result.number || null,
      series: result.series || "1",
      protocol: result.protocol || null,
      status: "authorized",
      vehiclePlate: emission.vehiclePlate,
      driverName: req.driverName || null,
      cteKeysJson: JSON.stringify(req.cteKeys || []),
      issueDate,
      createdAt: new Date(),
    });
  }

  if (emission.docType === "ciot") {
    const cfg = await getOrCreateFiscalConfig(organizationId);
    let hiredDocument: string | null = emission.driverDocument;
    if (emission.carrierId) {
      const [car] = await db
        .select()
        .from(schema.carrier)
        .where(eq(schema.carrier.id, emission.carrierId))
        .limit(1);
      if (car) hiredDocument = car.document || hiredDocument;
    }
    await db.insert(schema.ciotDocument).values({
      id: id("ciot"),
      organizationId,
      emissionId: emission.id,
      shipmentId: emission.shipmentId,
      carrierId: emission.carrierId,
      ciotNumber: result.ciotNumber || result.number || null,
      protocol: result.protocol || null,
      contractorDocument: cfg.companyDocument,
      hiredDocument,
      freightAmount: emission.freightAmount,
      status: "authorized",
      vehiclePlate: emission.vehiclePlate,
      driverDocument: emission.driverDocument,
      issueDate,
      createdAt: new Date(),
    });
  }
}

export async function submitEmission(
  organizationId: string,
  emissionId: string,
) {
  const db = await getDb();
  const [emission] = await db
    .select()
    .from(schema.fiscalEmission)
    .where(
      and(
        eq(schema.fiscalEmission.id, emissionId),
        eq(schema.fiscalEmission.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!emission) throw new Response(JSON.stringify({ error: "Emissão não encontrada" }), { status: 404 });
  if (!["draft", "queued", "error", "rejected"].includes(emission.status)) {
    throw new Response(
      JSON.stringify({ error: `Status ${emission.status} não permite reenvio` }),
      { status: 400 },
    );
  }

  const cfg = await getOrCreateFiscalConfig(organizationId);
  const provider = resolveProvider(cfg);
  const payload = await buildEmitRequest(organizationId, emission, cfg);

  await db
    .update(schema.fiscalEmission)
    .set({
      status: "processing",
      provider: provider.kind,
      requestJson: JSON.stringify(payload),
      updatedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(schema.fiscalEmission.id, emissionId));

  const result = await provider.emit(payload);

  if (result.status === "authorized" && result.ok) {
    await db
      .update(schema.fiscalEmission)
      .set({
        status: "authorized",
        chave: result.chave || null,
        number: result.number || result.ciotNumber || null,
        series: result.series || "1",
        protocol: result.protocol || null,
        externalId: result.externalId || null,
        responseJson: JSON.stringify(result.raw || result),
        authorizedAt: new Date(),
        updatedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(schema.fiscalEmission.id, emissionId));

    const [fresh] = await db
      .select()
      .from(schema.fiscalEmission)
      .where(eq(schema.fiscalEmission.id, emissionId))
      .limit(1);
    if (fresh) await persistAuthorizedDocs(organizationId, fresh, result);
    return { ...fresh, result };
  }

  const failStatus = result.status === "rejected" ? "rejected" : "error";
  await db
    .update(schema.fiscalEmission)
    .set({
      status: failStatus,
      responseJson: JSON.stringify(result.raw || result),
      errorMessage: result.message || "Falha na autorização",
      updatedAt: new Date(),
    })
    .where(eq(schema.fiscalEmission.id, emissionId));

  const [failed] = await db
    .select()
    .from(schema.fiscalEmission)
    .where(eq(schema.fiscalEmission.id, emissionId))
    .limit(1);
  return { ...failed, result };
}

export async function cancelEmission(
  organizationId: string,
  emissionId: string,
  reason: string,
) {
  const db = await getDb();
  const [emission] = await db
    .select()
    .from(schema.fiscalEmission)
    .where(
      and(
        eq(schema.fiscalEmission.id, emissionId),
        eq(schema.fiscalEmission.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!emission) throw new Response(JSON.stringify({ error: "Emissão não encontrada" }), { status: 404 });
  if (emission.status !== "authorized") {
    throw new Response(
      JSON.stringify({ error: "Só é possível cancelar documento autorizado" }),
      { status: 400 },
    );
  }

  const cfg = await getOrCreateFiscalConfig(organizationId);
  const provider = resolveProvider(cfg);
  const result = await provider.cancel({
    emissionId: emission.id,
    docType: emission.docType as FiscalDocType,
    chave: emission.chave,
    protocol: emission.protocol,
    externalId: emission.externalId,
    environment: cfg.environment,
    companyDocument: cfg.companyDocument || "",
    reason: reason || "Cancelamento solicitado pelo embarcador",
  });

  if (!result.ok) {
    throw new Response(
      JSON.stringify({ error: result.message || "Falha no cancelamento" }),
      { status: 502 },
    );
  }

  await db
    .update(schema.fiscalEmission)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
      responseJson: JSON.stringify(result.raw || result),
    })
    .where(eq(schema.fiscalEmission.id, emissionId));

  if (emission.docType === "cte") {
    await db
      .update(schema.cteDocument)
      .set({ status: "cancelled", notes: `Cancelado: ${reason}` })
      .where(
        and(
          eq(schema.cteDocument.organizationId, organizationId),
          eq(schema.cteDocument.emissionId, emissionId),
        ),
      );
  }
  if (emission.docType === "mdfe") {
    await db
      .update(schema.mdfeDocument)
      .set({ status: "cancelled" })
      .where(eq(schema.mdfeDocument.emissionId, emissionId));
  }
  if (emission.docType === "ciot") {
    await db
      .update(schema.ciotDocument)
      .set({ status: "cancelled" })
      .where(eq(schema.ciotDocument.emissionId, emissionId));
  }

  return { ok: true, result };
}
