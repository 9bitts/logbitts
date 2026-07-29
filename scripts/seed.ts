import "dotenv/config";
process.env.USE_PGLITE = process.env.USE_PGLITE || "1";

import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../src/server/db";
import { getAuth } from "../src/server/auth";
import { id, todayISO } from "../src/server/lib/ids";

async function main() {
  const db = await getDb();
  const auth = await getAuth();

  const orgId = "org_demo_logbitts";
  const [existingOrg] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1);

  if (!existingOrg) {
    await db.insert(schema.organization).values({
      id: orgId,
      name: "Distribuidora Demo Logbitts",
      slug: "demo-logbitts",
      createdAt: new Date(),
    });
  }

  async function ensureUser(
    email: string,
    name: string,
    password: string,
    role: "owner" | "dispatcher" | "driver" | "warehouse",
  ) {
    const [existing] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    let userId = existing?.id;
    if (!userId) {
      const res = await auth.api.signUpEmail({
        body: { email, password, name },
      });
      userId = res.user.id;
    }

    const [mem] = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.userId, userId!))
      .limit(1);
    if (!mem) {
      await db.insert(schema.member).values({
        id: id("mem"),
        organizationId: orgId,
        userId: userId!,
        role,
        createdAt: new Date(),
      });
    }
    return userId!;
  }

  await ensureUser("despacho@logbitts.demo", "Ana Despacho", "demo1234", "owner");
  const driverUserId = await ensureUser(
    "motorista@logbitts.demo",
    "Carlos Motorista",
    "demo1234",
    "driver",
  );
  await ensureUser(
    "armazem@logbitts.demo",
    "Bruno Armazém",
    "demo1234",
    "warehouse",
  );

  let [drv] = await db
    .select()
    .from(schema.driver)
    .where(eq(schema.driver.userId, driverUserId))
    .limit(1);
  if (!drv) {
    drv = {
      id: id("drv"),
      organizationId: orgId,
      userId: driverUserId,
      name: "Carlos Motorista",
      phone: "11999990001",
      document: "11122233344",
      active: true,
      createdAt: new Date(),
    };
    await db.insert(schema.driver).values(drv);
  }

  const [vehCount] = await db.select().from(schema.vehicle).limit(1);
  if (!vehCount) {
    await db.insert(schema.vehicle).values({
      id: id("veh"),
      organizationId: orgId,
      plate: "ABC1D23",
      label: "HR Bau 01",
      capacityKg: 1500,
      capacityM3: 12,
      active: true,
      createdAt: new Date(),
    });
  }

  // --- WMS ---
  let [wh] = await db
    .select()
    .from(schema.warehouse)
    .where(eq(schema.warehouse.organizationId, orgId))
    .limit(1);
  if (!wh) {
    wh = {
      id: id("wh"),
      organizationId: orgId,
      name: "CD São Paulo",
      code: "CD-SP",
      address: "Av. do Estado, 1000 — São Paulo/SP",
      lat: -23.5505,
      lng: -46.6333,
      active: true,
      createdAt: new Date(),
    };
    await db.insert(schema.warehouse).values(wh);
  } else if (!wh.code) {
    await db
      .update(schema.warehouse)
      .set({ code: "CD-SP", active: true })
      .where(eq(schema.warehouse.id, wh.id));
    wh = { ...wh, code: "CD-SP", active: true };
  }

  let [wh2] = await db
    .select()
    .from(schema.warehouse)
    .where(
      and(
        eq(schema.warehouse.organizationId, orgId),
        eq(schema.warehouse.code, "CD-CP"),
      ),
    )
    .limit(1);
  if (!wh2) {
    const allWh = await db
      .select()
      .from(schema.warehouse)
      .where(eq(schema.warehouse.organizationId, orgId));
    if (allWh.length < 2) {
      wh2 = {
        id: id("wh"),
        organizationId: orgId,
        name: "CD Campinas",
        code: "CD-CP",
        address: "Rod. Anhanguera, km 90 — Campinas/SP",
        lat: -22.9099,
        lng: -47.0626,
        active: true,
        createdAt: new Date(),
      };
      await db.insert(schema.warehouse).values(wh2);
      for (const d of [
        { code: "REC-01", type: "receiving" },
        { code: "SHIP-01", type: "shipping" },
        { code: "A-01-01", type: "storage" },
        { code: "P-01-01", type: "picking" },
      ]) {
        await db.insert(schema.location).values({
          id: id("loc"),
          organizationId: orgId,
          warehouseId: wh2.id,
          code: d.code,
          type: d.type,
          createdAt: new Date(),
        });
      }
      for (const d of [
        { code: "C01", name: "Dock C1 — Recebimento", type: "inbound" },
        { code: "C02", name: "Dock C2 — Expedição", type: "outbound" },
      ]) {
        await db.insert(schema.dock).values({
          id: id("dock"),
          organizationId: orgId,
          warehouseId: wh2.id,
          code: d.code,
          name: d.name,
          type: d.type,
          status: "free",
          active: true,
          createdAt: new Date(),
        });
      }
    }
  }

  const [locCount] = await db
    .select()
    .from(schema.location)
    .where(eq(schema.location.warehouseId, wh.id))
    .limit(1);

  const locationIds: Record<string, string> = {};
  if (!locCount) {
    const defs = [
      { code: "REC-01", type: "receiving" },
      { code: "SHIP-01", type: "shipping" },
      { code: "P-01-01", type: "picking" },
      { code: "P-01-02", type: "picking" },
      { code: "A-01-01", type: "storage" },
      { code: "A-01-02", type: "storage" },
      { code: "A-02-01", type: "storage" },
      { code: "A-02-02", type: "storage" },
      { code: "B-01-01", type: "storage" },
      { code: "B-01-02", type: "storage" },
      { code: "B-02-01", type: "storage" },
      { code: "B-02-02", type: "storage" },
    ];
    for (const d of defs) {
      const locId = id("loc");
      locationIds[d.code] = locId;
      await db.insert(schema.location).values({
        id: locId,
        organizationId: orgId,
        warehouseId: wh.id,
        code: d.code,
        type: d.type,
        createdAt: new Date(),
      });
    }
  } else {
    const locs = await db
      .select()
      .from(schema.location)
      .where(eq(schema.location.warehouseId, wh.id));
    for (const l of locs) locationIds[l.code] = l.id;
  }

  const productDefs = [
    { sku: "ARZ-5KG", name: "Arroz Tipo 1 5kg", weightKg: 5 },
    { sku: "FEJ-1KG", name: "Feijão Carioca 1kg", weightKg: 1 },
    { sku: "OLE-900", name: "Óleo de Soja 900ml", weightKg: 0.9 },
    { sku: "ACU-1KG", name: "Açúcar Cristal 1kg", weightKg: 1 },
    { sku: "CAF-500", name: "Café Torrado 500g", weightKg: 0.5 },
    { sku: "MAC-500", name: "Macarrão Espaguete 500g", weightKg: 0.5 },
    { sku: "LEI-1L", name: "Leite UHT 1L", weightKg: 1 },
    { sku: "BIS-140", name: "Biscoito Recheado 140g", weightKg: 0.14 },
  ];

  const productIds: string[] = [];
  for (const p of productDefs) {
    const [ex] = await db
      .select()
      .from(schema.product)
      .where(eq(schema.product.sku, p.sku))
      .limit(1);
    if (ex) {
      productIds.push(ex.id);
      continue;
    }
    const pid = id("prd");
    productIds.push(pid);
    await db.insert(schema.product).values({
      id: pid,
      organizationId: orgId,
      sku: p.sku,
      name: p.name,
      barcode: `789${Math.floor(Math.random() * 1e10)}`,
      unit: "UN",
      weightKg: p.weightKg,
      volumeM3: 0.01,
      active: true,
      createdAt: new Date(),
    });
  }

  const [stockCount] = await db
    .select()
    .from(schema.stockLevel)
    .where(eq(schema.stockLevel.organizationId, orgId))
    .limit(1);
  if (!stockCount) {
    const pickLocs = ["P-01-01", "P-01-02", "A-01-01", "A-01-02", "A-02-01"];
    for (let i = 0; i < productIds.length; i++) {
      const code = pickLocs[i % pickLocs.length];
      const locId = locationIds[code];
      if (!locId) continue;
      await db.insert(schema.stockLevel).values({
        id: id("stk"),
        organizationId: orgId,
        productId: productIds[i],
        locationId: locId,
        qty: 80 + i * 15,
        updatedAt: new Date(),
      });
    }
  }

  const [custCount] = await db.select().from(schema.customer).limit(1);
  if (!custCount) {
    const points = [
      {
        name: "Mercado Aurora",
        address: "Rua Augusta, 1500",
        neighborhood: "Consolação",
        city: "São Paulo",
        state: "SP",
        zip: "01304-001",
        lat: -23.5558,
        lng: -46.6612,
      },
      {
        name: "Padaria Dom João",
        address: "Av. Paulista, 900",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        zip: "01310-100",
        lat: -23.5651,
        lng: -46.6512,
      },
      {
        name: "Hortifruti Vila Madalena",
        address: "Rua Harmonia, 200",
        neighborhood: "Vila Madalena",
        city: "São Paulo",
        state: "SP",
        zip: "05435-000",
        lat: -23.5512,
        lng: -46.6915,
      },
      {
        name: "Empório Moema",
        address: "Av. Ibirapuera, 3100",
        neighborhood: "Moema",
        city: "São Paulo",
        state: "SP",
        zip: "04029-200",
        lat: -23.6045,
        lng: -46.6658,
      },
      {
        name: "Mini Market Pinheiros",
        address: "Rua dos Pinheiros, 800",
        neighborhood: "Pinheiros",
        city: "São Paulo",
        state: "SP",
        zip: "05422-001",
        lat: -23.5674,
        lng: -46.6911,
      },
      {
        name: "Café Liberdade",
        address: "Rua da Glória, 120",
        neighborhood: "Liberdade",
        city: "São Paulo",
        state: "SP",
        zip: "01510-000",
        lat: -23.5587,
        lng: -46.6347,
      },
      {
        name: "Distribuidora Saúde",
        address: "Rua Domingos de Morais, 2100",
        neighborhood: "Vila Mariana",
        city: "São Paulo",
        state: "SP",
        zip: "04036-100",
        lat: -23.5952,
        lng: -46.6358,
      },
      {
        name: "Mercadinho Tatuapé",
        address: "Rua Serra de Bragança, 500",
        neighborhood: "Tatuapé",
        city: "São Paulo",
        state: "SP",
        zip: "03318-000",
        lat: -23.5405,
        lng: -46.5768,
      },
    ];

    const date = todayISO();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const cusId = id("cus");
      await db.insert(schema.customer).values({
        id: cusId,
        organizationId: orgId,
        name: p.name,
        document: null,
        phone: null,
        email: null,
        address: p.address,
        neighborhood: p.neighborhood,
        city: p.city,
        state: p.state,
        zip: p.zip,
        lat: p.lat,
        lng: p.lng,
        windowStart: "08:00",
        windowEnd: "18:00",
        notes: null,
        erpKey: null,
        createdAt: new Date(),
      });
      const delId = id("del");
      const ready = i < 4;
      await db.insert(schema.delivery).values({
        id: delId,
        organizationId: orgId,
        customerId: cusId,
        externalCode: `PED-${1000 + i}`,
        invoiceNumber: `NF-${2000 + i}`,
        status: ready ? "ready_to_ship" : "pending",
        weightKg: 20 + i * 5,
        volumeM3: 0.2 + i * 0.05,
        packages: 1 + (i % 3),
        scheduledDate: date,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "manual",
        erpKey: null,
        clientId: null,
      });
      await db.insert(schema.deliveryLine).values({
        id: id("dln"),
        organizationId: orgId,
        deliveryId: delId,
        productId: productIds[i % productIds.length],
        qty: 2 + (i % 3),
        qtyPicked: ready ? 2 + (i % 3) : 0,
      });
    }
  } else {
    // Existing Phase 1 deliveries: attach lines + promote some to ready_to_ship
    const deliveries = await db
      .select()
      .from(schema.delivery)
      .where(eq(schema.delivery.organizationId, orgId));
    let idx = 0;
    for (const d of deliveries) {
      const [line] = await db
        .select()
        .from(schema.deliveryLine)
        .where(eq(schema.deliveryLine.deliveryId, d.id))
        .limit(1);
      if (!line && productIds.length) {
        await db.insert(schema.deliveryLine).values({
          id: id("dln"),
          organizationId: orgId,
          deliveryId: d.id,
          productId: productIds[idx % productIds.length],
          qty: 2,
          qtyPicked: d.status === "pending" && idx < 4 ? 2 : 0,
        });
      }
      if (d.status === "pending" && idx < 4) {
        await db
          .update(schema.delivery)
          .set({ status: "ready_to_ship", updatedAt: new Date() })
          .where(eq(schema.delivery.id, d.id));
      }
      idx++;
    }
  }

  // --- Fase 3 TMS Embarcador ---
  let [carrierA] = await db
    .select()
    .from(schema.carrier)
    .where(eq(schema.carrier.organizationId, orgId))
    .limit(1);
  if (!carrierA) {
    const carId = id("car");
    carrierA = {
      id: carId,
      organizationId: orgId,
      name: "TransBrasil Express",
      document: "12.345.678/0001-90",
      rntrc: "12345678",
      email: "ops@transbrasil.demo",
      phone: "1133334444",
      active: true,
      createdAt: new Date(),
    };
    await db.insert(schema.carrier).values(carrierA);
    await db.insert(schema.carrier).values({
      id: id("car"),
      organizationId: orgId,
      name: "RodoSul Logística",
      document: "98.765.432/0001-10",
      rntrc: "87654321",
      email: "frete@rodosul.demo",
      phone: "1144445555",
      active: true,
      createdAt: new Date(),
    });

    const tableId = id("frt");
    await db.insert(schema.freightRateTable).values({
      id: tableId,
      organizationId: orgId,
      carrierId: carId,
      name: "Tabela SP Capital",
      active: true,
      createdAt: new Date(),
    });
    await db.insert(schema.freightRate).values({
      id: id("frr"),
      organizationId: orgId,
      tableId,
      originState: "SP",
      destState: "SP",
      originZipPrefix: null,
      destZipPrefix: null,
      minWeightKg: 0,
      maxWeightKg: 50,
      pricePerKg: 3.2,
      minimumPrice: 28,
      fixedPrice: null,
      transitDays: 1,
    });
    await db.insert(schema.freightRate).values({
      id: id("frr"),
      organizationId: orgId,
      tableId,
      originState: "SP",
      destState: "SP",
      originZipPrefix: null,
      destZipPrefix: null,
      minWeightKg: 50,
      maxWeightKg: 99999,
      pricePerKg: 2.1,
      minimumPrice: 55,
      fixedPrice: null,
      transitDays: 2,
    });

    const [carrierB] = await db
      .select()
      .from(schema.carrier)
      .where(eq(schema.carrier.document, "98.765.432/0001-10"))
      .limit(1);
    if (carrierB) {
      const table2 = id("frt");
      await db.insert(schema.freightRateTable).values({
        id: table2,
        organizationId: orgId,
        carrierId: carrierB.id,
        name: "Tabela RodoSul Interior",
        active: true,
        createdAt: new Date(),
      });
      await db.insert(schema.freightRate).values({
        id: id("frr"),
        organizationId: orgId,
        tableId: table2,
        originState: "SP",
        destState: "SP",
        originZipPrefix: null,
        destZipPrefix: null,
        minWeightKg: 0,
        maxWeightKg: 99999,
        pricePerKg: 2.8,
        minimumPrice: 40,
        fixedPrice: null,
        transitDays: 2,
      });
    }
  }

  // --- Fase 4 fiscal config ---
  const [fiscalCfg] = await db
    .select()
    .from(schema.fiscalProviderConfig)
    .where(eq(schema.fiscalProviderConfig.organizationId, orgId))
    .limit(1);
  if (!fiscalCfg) {
    await db.insert(schema.fiscalProviderConfig).values({
      id: id("fpc"),
      organizationId: orgId,
      provider: "mock",
      environment: "homologacao",
      apiKey: null,
      baseUrl: null,
      companyDocument: "00.000.000/0001-91",
      companyName: "Distribuidora Demo Logbitts",
      active: true,
      createdAt: new Date(),
    });
  }

  // --- Fase 5 YMS ---
  const existingDocks = await db
    .select()
    .from(schema.dock)
    .where(eq(schema.dock.organizationId, orgId));
  if (!existingDocks.length) {
    const dockDefs = [
      { code: "D01", name: "Dock 1 — Recebimento", type: "inbound" },
      { code: "D02", name: "Dock 2 — Misto", type: "both" },
      { code: "D03", name: "Dock 3 — Expedição", type: "outbound" },
    ];
    for (const d of dockDefs) {
      await db.insert(schema.dock).values({
        id: id("dock"),
        organizationId: orgId,
        warehouseId: wh.id,
        code: d.code,
        name: d.name,
        type: d.type,
        status: "free",
        active: true,
        createdAt: new Date(),
      });
    }
  }

  const [apptToday] = await db
    .select()
    .from(schema.yardAppointment)
    .where(
      and(
        eq(schema.yardAppointment.organizationId, orgId),
        eq(schema.yardAppointment.scheduledDate, todayISO()),
      ),
    )
    .limit(1);
  if (!apptToday) {
    const [d01] = await db
      .select()
      .from(schema.dock)
      .where(
        and(
          eq(schema.dock.organizationId, orgId),
          eq(schema.dock.code, "D01"),
        ),
      )
      .limit(1);
    const [car] = await db
      .select()
      .from(schema.carrier)
      .where(eq(schema.carrier.organizationId, orgId))
      .limit(1);
    await db.insert(schema.yardAppointment).values({
      id: id("yap"),
      organizationId: orgId,
      warehouseId: wh.id,
      dockId: d01?.id || null,
      type: "inbound",
      status: "scheduled",
      scheduledDate: todayISO(),
      windowStart: "09:00",
      windowEnd: "10:00",
      carrierId: car?.id || null,
      vehiclePlate: "XYZ1A23",
      driverName: "José Gate",
      driverDocument: null,
      receiptId: null,
      shipmentId: null,
      routeId: null,
      notes: "Demo seed — recebimento",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const existingConnectors = await db
    .select()
    .from(schema.integrationConnector)
    .where(eq(schema.integrationConnector.organizationId, orgId))
    .limit(1);
  if (!existingConnectors.length) {
    const catalog = [
      {
        key: "winthor",
        name: "TOTVS Winthor (ERP)",
        status: "configured",
        configJson: JSON.stringify({
          mode: "mock",
          webhookSecret: "logbitts-demo-webhook",
          companyCode: "DEMO",
        }),
      },
      { key: "sap", name: "SAP (pedido / NF)", status: "available", configJson: null },
      {
        key: "generic_rest",
        name: "REST genérico (webhook)",
        status: "available",
        configJson: null,
      },
      {
        key: "focus_nfe",
        name: "Focus NFe / parceiro fiscal",
        status: "configured",
        configJson: null,
      },
      {
        key: "frete_marketplace",
        name: "Marketplace de frete",
        status: "available",
        configJson: null,
      },
    ];
    for (const c of catalog) {
      await db.insert(schema.integrationConnector).values({
        id: id("icn"),
        organizationId: orgId,
        key: c.key,
        name: c.name,
        status: c.status,
        configJson: c.configJson,
        lastSyncAt: null,
        lastError: null,
        createdAt: new Date(),
      });
    }
  }

  // --- Phase 8+ seed: 3PL, slotting, cert ---
  const [tpl] = await db
    .select()
    .from(schema.tplClient)
    .where(eq(schema.tplClient.organizationId, orgId))
    .limit(1);
  if (!tpl) {
    await db.insert(schema.tplClient).values([
      {
        id: id("tpl"),
        organizationId: orgId,
        name: "Cliente 3PL Alpha Alimentos",
        code: "ALPHA",
        document: "55.666.777/0001-88",
        email: "ops@alpha.demo",
        active: true,
        createdAt: new Date(),
      },
      {
        id: id("tpl"),
        organizationId: orgId,
        name: "Cliente 3PL Beta Bebidas",
        code: "BETA",
        document: "66.777.888/0001-99",
        email: "logistica@beta.demo",
        active: true,
        createdAt: new Date(),
      },
    ]);
  }

  const [slotRule] = await db
    .select()
    .from(schema.slottingRule)
    .where(eq(schema.slottingRule.organizationId, orgId))
    .limit(1);
  if (!slotRule) {
    await db.insert(schema.slottingRule).values({
      id: id("slr"),
      organizationId: orgId,
      warehouseId: wh.id,
      name: "SKU → picking preferencial",
      priority: 40,
      productSkuPrefix: "SKU-",
      locationType: "picking",
      preferPicking: true,
      maxWeightKg: 500,
      active: true,
      createdAt: new Date(),
    });
  }

  const [cert] = await db
    .select()
    .from(schema.fiscalCertificate)
    .where(eq(schema.fiscalCertificate.organizationId, orgId))
    .limit(1);
  if (!cert) {
    await db.insert(schema.fiscalCertificate).values({
      id: id("crt"),
      organizationId: orgId,
      type: "A1",
      alias: "Demo A1 Homologação",
      cnpj: "00.000.000/0001-91",
      fingerprint: "ab:cd:ef:12:34:56:78:90:ab:cd:ef:12:34:56:78:90:ab:cd:ef:12",
      storageRef: "demo://cert/seed",
      validFrom: todayISO(),
      validTo: "2027-12-31",
      status: "pending",
      createdAt: new Date(),
    });
  }

  console.log(`
Seed OK (plataforma completa — fases 1–8+)

Despacho:  despacho@logbitts.demo / demo1234
Armazém:   armazem@logbitts.demo / demo1234
Motorista: motorista@logbitts.demo / demo1234

3PL / Slotting / Marketplace / Cert A1 / Event lake disponíveis
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
