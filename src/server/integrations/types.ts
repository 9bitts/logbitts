export type ErpOrderLine = {
  sku: string;
  name?: string;
  qty: number;
  weightKg?: number;
};

export type ErpOrder = {
  orderNumber: string;
  invoiceNumber?: string | null;
  scheduledDate?: string | null;
  customer: {
    name: string;
    document?: string | null;
    address: string;
    neighborhood?: string | null;
    city: string;
    state: string;
    zip: string;
    phone?: string | null;
    email?: string | null;
    lat?: number | null;
    lng?: number | null;
    erpKey?: string | null;
  };
  weightKg?: number | null;
  volumeM3?: number | null;
  packages?: number | null;
  lines?: ErpOrderLine[];
  notes?: string | null;
};

export type ConnectorConfig = {
  mode?: "mock" | "http";
  baseUrl?: string;
  apiKey?: string;
  webhookSecret?: string;
  companyCode?: string;
};

export type IngestResult = {
  createdCustomers: number;
  createdDeliveries: number;
  skipped: number;
  errors: string[];
};
