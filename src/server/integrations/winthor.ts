import { todayISO } from "@/server/lib/ids";
import type { ErpOrder } from "./types";

/** Demo payload shaped like a Winthor/ERP order export. */
export function mockWinthorOrders(count = 3): ErpOrder[] {
  const date = todayISO();
  const base: ErpOrder[] = [
    {
      orderNumber: `WT-${date.replace(/-/g, "")}-1001`,
      invoiceNumber: `NF-${Date.now().toString().slice(-6)}`,
      scheduledDate: date,
      customer: {
        name: "Mercado Boa Vista Ltda",
        document: "11.222.333/0001-44",
        address: "Rua das Flores, 120",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zip: "01001-000",
        phone: "11988887777",
        lat: -23.5505,
        lng: -46.6333,
        erpKey: "WT-CLI-1001",
      },
      weightKg: 42,
      packages: 6,
      lines: [
        { sku: "SKU-ARROZ", name: "Arroz 5kg", qty: 10 },
        { sku: "SKU-FEIJAO", name: "Feijão 1kg", qty: 20 },
      ],
      notes: "Sync Winthor mock",
    },
    {
      orderNumber: `WT-${date.replace(/-/g, "")}-1002`,
      invoiceNumber: null,
      scheduledDate: date,
      customer: {
        name: "Padaria São Jorge",
        document: "22.333.444/0001-55",
        address: "Av. Paulista, 1500",
        city: "São Paulo",
        state: "SP",
        zip: "01310-200",
        lat: -23.5614,
        lng: -46.6558,
        erpKey: "WT-CLI-1002",
      },
      weightKg: 18,
      packages: 3,
      lines: [{ sku: "SKU-OLEO", name: "Óleo 900ml", qty: 24 }],
    },
    {
      orderNumber: `WT-${date.replace(/-/g, "")}-1003`,
      scheduledDate: date,
      customer: {
        name: "Restaurante Lago Azul",
        document: "33.444.555/0001-66",
        address: "Rua Augusta, 900",
        city: "São Paulo",
        state: "SP",
        zip: "01305-100",
        lat: -23.5532,
        lng: -46.6585,
        erpKey: "WT-CLI-1003",
      },
      weightKg: 55,
      packages: 8,
      lines: [
        { sku: "SKU-ARROZ", qty: 15 },
        { sku: "SKU-FEIJAO", qty: 30 },
      ],
    },
  ];
  return base.slice(0, count);
}

export async function fetchHttpOrders(cfg: {
  baseUrl: string;
  apiKey?: string;
}): Promise<ErpOrder[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const url = `${cfg.baseUrl.replace(/\/$/, "")}/orders`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`ERP HTTP ${res.status} em ${url}`);
  }
  const data = await res.json();
  const orders = Array.isArray(data)
    ? data
    : Array.isArray(data.orders)
      ? data.orders
      : Array.isArray(data.pedidos)
        ? data.pedidos
        : [];
  return orders as ErpOrder[];
}
