import "dotenv/config";
process.env.USE_PGLITE = process.env.USE_PGLITE || "1";

import { eq } from "drizzle-orm";
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
    role: "owner" | "dispatcher" | "driver",
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

  const ownerId = await ensureUser(
    "despacho@logbitts.demo",
    "Ana Despacho",
    "demo1234",
    "owner",
  );
  const driverUserId = await ensureUser(
    "motorista@logbitts.demo",
    "Carlos Motorista",
    "demo1234",
    "driver",
  );

  void ownerId;

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
        createdAt: new Date(),
      });
      await db.insert(schema.delivery).values({
        id: id("del"),
        organizationId: orgId,
        customerId: cusId,
        externalCode: `PED-${1000 + i}`,
        invoiceNumber: `NF-${2000 + i}`,
        status: "pending",
        weightKg: 20 + i * 5,
        volumeM3: 0.2 + i * 0.05,
        packages: 1 + (i % 3),
        scheduledDate: date,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  console.log(`
Seed OK (PGlite em .data/pglite)

Despacho:  despacho@logbitts.demo / demo1234
Motorista: motorista@logbitts.demo / demo1234

Abra http://localhost:3000
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
