export type FiscalDocType = "cte" | "mdfe" | "ciot";
export type FiscalProviderKind = "mock" | "http_stub" | "sefaz_direct";

export type FiscalEmitRequest = {
  emissionId: string;
  docType: FiscalDocType;
  environment: string;
  companyDocument: string;
  companyName: string;
  carrierDocument?: string | null;
  carrierName?: string | null;
  freightAmount: number;
  weightKg?: number | null;
  originCity?: string | null;
  destCity?: string | null;
  originState?: string | null;
  destState?: string | null;
  vehiclePlate?: string | null;
  driverDocument?: string | null;
  driverName?: string | null;
  cteKeys?: string[];
  shipmentCode?: string | null;
  routeCode?: string | null;
};

export type FiscalEmitResult = {
  ok: boolean;
  status: "authorized" | "rejected" | "processing" | "error";
  externalId?: string;
  chave?: string;
  number?: string;
  series?: string;
  protocol?: string;
  ciotNumber?: string;
  message?: string;
  raw?: unknown;
};

export type FiscalCancelRequest = {
  emissionId: string;
  docType: FiscalDocType;
  chave?: string | null;
  protocol?: string | null;
  externalId?: string | null;
  environment: string;
  companyDocument: string;
  reason: string;
};

export interface FiscalProvider {
  kind: FiscalProviderKind | string;
  emit(req: FiscalEmitRequest): Promise<FiscalEmitResult>;
  cancel(req: FiscalCancelRequest): Promise<FiscalEmitResult>;
  status(externalId: string): Promise<FiscalEmitResult>;
}
