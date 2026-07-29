import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { id, todayISO } from "@/server/lib/ids";
import type { ErpOrder, IngestResult } from "./types";

export async function ingestErpOrders(
  organizationId: string,
  orders: ErpOrder[],
  source = "erp",
): Promise<IngestResult> {
  const db = await getDb();
  const result: IngestResult = {
    createdCustomers: 0,
    createdDeliveries: 0,
    skipped: 0,
    errors: [],
  };

  const customers = await db
    .select()
    .from(schema.customer)
    .where(eq(schema.customer.organizationId, organizationId));
  const byDoc = new Map(
    customers.filter((c) => c.document).map((c) => [c.document!, c]),
  );
  const byErp = new Map(
    customers.filter((c) => c.erpKey).map((c) => [c.erpKey!, c]),
  );
  const byName = new Map(customers.map((c) => [c.name.toLowerCase(), c]));

  const existingDeliveries = await db
    .select({
      id: schema.delivery.id,
      externalCode: schema.delivery.externalCode,
      erpKey: schema.delivery.erpKey,
    })
    .from(schema.delivery)
    .where(eq(schema.delivery.organizationId, organizationId));
  const delByCode = new Set(
    existingDeliveries
      .map((d) => d.externalCode || d.erpKey)
      .filter(Boolean) as string[],
  );

  for (const order of orders) {
    try {
      const orderNumber = String(order.orderNumber || "").trim();
      if (!orderNumber) {
        result.errors.push("Pedido sem orderNumber");
        continue;
      }
      if (delByCode.has(orderNumber)) {
        result.skipped++;
        continue;
      }

      const c = order.customer;
      if (!c?.name || !c.address || !c.city || !c.state || !c.zip) {
        result.errors.push(`${orderNumber}: cliente incompleto`);
        continue;
      }

      let customer =
        (c.erpKey && byErp.get(c.erpKey)) ||
        (c.document && byDoc.get(c.document)) ||
        byName.get(c.name.toLowerCase());

      if (!customer) {
        customer = {
          id: id("cus"),
          organizationId,
          name: c.name,
          document: c.document || null,
          phone: c.phone || null,
          email: c.email || null,
          address: c.address,
          neighborhood: c.neighborhood || null,
          city: c.city,
          state: c.state.toUpperCase().slice(0, 2),
          zip: c.zip,
          lat: c.lat ?? null,
          lng: c.lng ?? null,
          windowStart: null,
          windowEnd: null,
          notes: null,
          erpKey: c.erpKey || null,
          createdAt: new Date(),
        };
        await db.insert(schema.customer).values(customer);
        byName.set(customer.name.toLowerCase(), customer);
        if (customer.document) byDoc.set(customer.document, customer);
        if (customer.erpKey) byErp.set(customer.erpKey, customer);
        result.createdCustomers++;
      } else if (c.erpKey && !customer.erpKey) {
        await db
          .update(schema.customer)
          .set({ erpKey: c.erpKey })
          .where(eq(schema.customer.id, customer.id));
        customer = { ...customer, erpKey: c.erpKey };
        byErp.set(c.erpKey, customer);
      }

      const delId = id("del");
      await db.insert(schema.delivery).values({
        id: delId,
        organizationId,
        customerId: customer.id,
        externalCode: orderNumber,
        invoiceNumber: order.invoiceNumber || null,
        status: "pending",
        weightKg: order.weightKg ?? 0,
        volumeM3: order.volumeM3 ?? 0,
        packages: order.packages ?? 1,
        scheduledDate: order.scheduledDate || todayISO(),
        notes: order.notes || `ERP ${source}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        source,
        erpKey: orderNumber,
        clientId: null,
      });
      delByCode.add(orderNumber);
      result.createdDeliveries++;

      for (const line of order.lines || []) {
        const sku = String(line.sku || "").trim().toUpperCase();
        if (!sku) continue;
        let [prd] = await db
          .select()
          .from(schema.product)
          .where(
            and(
              eq(schema.product.organizationId, organizationId),
              eq(schema.product.sku, sku),
            ),
          )
          .limit(1);
        if (!prd) {
          prd = {
            id: id("prd"),
            organizationId,
            sku,
            name: line.name || sku,
            barcode: null,
            unit: "UN",
            weightKg: line.weightKg ?? 0,
            volumeM3: 0,
            active: true,
            createdAt: new Date(),
          };
          await db.insert(schema.product).values(prd);
        }
        await db.insert(schema.deliveryLine).values({
          id: id("dln"),
          organizationId,
          deliveryId: delId,
          productId: prd.id,
          qty: line.qty || 1,
          qtyPicked: 0,
        });
      }
    } catch (err) {
      result.errors.push(
        `${order.orderNumber || "?"}: ${err instanceof Error ? err.message : "erro"}`,
      );
    }
  }

  return result;
}
