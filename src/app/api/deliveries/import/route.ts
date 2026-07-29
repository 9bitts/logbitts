import Papa from "papaparse";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { json, requireDispatcher } from "@/server/session";
import { id, todayISO } from "@/server/lib/ids";

type CsvRow = Record<string, string>;

function pick(row: CsvRow, keys: string[]) {
  for (const k of keys) {
    const found = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase() === k.toLowerCase(),
    );
    if (found && row[found]?.trim()) return row[found].trim();
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const ctx = await requireDispatcher();
    const contentType = req.headers.get("content-type") || "";

    let rows: CsvRow[] = [];

    if (contentType.includes("application/json")) {
      const body = await req.json();
      rows = Array.isArray(body.deliveries) ? body.deliveries : body;
    } else {
      const text = await req.text();
      const parsed = Papa.parse<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
      });
      rows = parsed.data;
    }

    if (!rows.length) return json({ error: "Nenhuma linha para importar" }, 400);

    const db = await getDb();
    const customers = await db
      .select()
      .from(schema.customer)
      .where(eq(schema.customer.organizationId, ctx.organizationId));

    const byDoc = new Map(
      customers.filter((c) => c.document).map((c) => [c.document!, c]),
    );
    const byName = new Map(customers.map((c) => [c.name.toLowerCase(), c]));

    let createdCustomers = 0;
    let createdDeliveries = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = pick(row, ["customer_name", "cliente", "name", "nome"]);
        const document = pick(row, ["document", "documento", "cnpj", "cpf"]);
        const address = pick(row, ["address", "endereco", "endereço"]);
        const city = pick(row, ["city", "cidade"]);
        const state = pick(row, ["state", "uf", "estado"]);
        const zip = pick(row, ["zip", "cep"]);
        const lat = pick(row, ["lat", "latitude"]);
        const lng = pick(row, ["lng", "lon", "longitude"]);
        const externalCode = pick(row, [
          "external_code",
          "pedido",
          "order",
          "codigo",
        ]);
        const invoiceNumber = pick(row, ["invoice", "nf", "nota"]);
        const weightKg = pick(row, ["weight_kg", "peso", "peso_kg"]);
        const volumeM3 = pick(row, ["volume_m3", "volume"]);
        const packages = pick(row, ["packages", "volumes", "qtd"]);
        const scheduledDate =
          pick(row, ["scheduled_date", "data", "date"]) || todayISO();
        const notes = pick(row, ["notes", "obs", "observacao"]);

        let customer =
          (document && byDoc.get(document)) ||
          (name && byName.get(name.toLowerCase()));

        if (!customer) {
          if (!name || !address || !city || !state || !zip) {
            errors.push(`Linha ${i + 2}: cliente incompleto`);
            continue;
          }
          customer = {
            id: id("cus"),
            organizationId: ctx.organizationId,
            name,
            document: document || null,
            phone: pick(row, ["phone", "telefone"]) || null,
            email: pick(row, ["email"]) || null,
            address,
            neighborhood: pick(row, ["neighborhood", "bairro"]) || null,
            city,
            state: state.toUpperCase().slice(0, 2),
            zip,
            lat: lat ? Number(lat) : null,
            lng: lng ? Number(lng) : null,
            windowStart: pick(row, ["window_start"]) || null,
            windowEnd: pick(row, ["window_end"]) || null,
            notes: null,
            erpKey: null,
            createdAt: new Date(),
          };
          await db.insert(schema.customer).values(customer);
          byName.set(customer.name.toLowerCase(), customer);
          if (customer.document) byDoc.set(customer.document, customer);
          createdCustomers++;
        }

        const delId = id("del");
        await db.insert(schema.delivery).values({
          id: delId,
          organizationId: ctx.organizationId,
          customerId: customer.id,
          externalCode: externalCode || null,
          invoiceNumber: invoiceNumber || null,
          status: "pending",
          weightKg: weightKg ? Number(weightKg) : 0,
          volumeM3: volumeM3 ? Number(volumeM3) : 0,
          packages: packages ? Number(packages) : 1,
          scheduledDate,
          notes: notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          source: "csv",
          erpKey: externalCode || null,
        });

        const sku = pick(row, ["sku", "produto_sku"]);
        const lineQty = pick(row, ["qty", "quantidade", "qtde"]);
        if (sku) {
          const [prd] = await db
            .select()
            .from(schema.product)
            .where(
              and(
                eq(schema.product.organizationId, ctx.organizationId),
                eq(schema.product.sku, sku.toUpperCase()),
              ),
            )
            .limit(1);
          if (prd) {
            await db.insert(schema.deliveryLine).values({
              id: id("dln"),
              organizationId: ctx.organizationId,
              deliveryId: delId,
              productId: prd.id,
              qty: lineQty ? Number(lineQty) : 1,
              qtyPicked: 0,
            });
          }
        }

        createdDeliveries++;
      } catch (err) {
        errors.push(`Linha ${i + 2}: ${(err as Error).message}`);
      }
    }

    return json({
      createdCustomers,
      createdDeliveries,
      errors,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
