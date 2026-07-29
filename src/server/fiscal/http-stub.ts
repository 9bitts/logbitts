import type {
  FiscalCancelRequest,
  FiscalEmitRequest,
  FiscalEmitResult,
  FiscalProvider,
} from "./types";

/**
 * HTTP stub for real partners (Focus NFe, PlugNotas, etc.).
 * Expects POST {baseUrl}/emit and /cancel returning JSON FiscalEmitResult shape.
 */
export function createHttpStubProvider(
  baseUrl: string,
  apiKey: string | null,
): FiscalProvider {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  return {
    kind: "http_stub",
    async emit(req: FiscalEmitRequest): Promise<FiscalEmitResult> {
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/emit`, {
          method: "POST",
          headers,
          body: JSON.stringify(req),
        });
        const data = (await res.json()) as FiscalEmitResult;
        if (!res.ok) {
          return {
            ok: false,
            status: "error",
            message: data.message || `HTTP ${res.status}`,
            raw: data,
          };
        }
        return data;
      } catch (e) {
        return {
          ok: false,
          status: "error",
          message: e instanceof Error ? e.message : "Falha no parceiro fiscal",
        };
      }
    },
    async cancel(req: FiscalCancelRequest): Promise<FiscalEmitResult> {
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/cancel`, {
          method: "POST",
          headers,
          body: JSON.stringify(req),
        });
        const data = (await res.json()) as FiscalEmitResult;
        if (!res.ok) {
          return {
            ok: false,
            status: "error",
            message: data.message || `HTTP ${res.status}`,
            raw: data,
          };
        }
        return data;
      } catch (e) {
        return {
          ok: false,
          status: "error",
          message: e instanceof Error ? e.message : "Falha no cancelamento",
        };
      }
    },
    async status(externalId: string): Promise<FiscalEmitResult> {
      try {
        const res = await fetch(
          `${baseUrl.replace(/\/$/, "")}/status/${encodeURIComponent(externalId)}`,
          { headers },
        );
        return (await res.json()) as FiscalEmitResult;
      } catch (e) {
        return {
          ok: false,
          status: "error",
          message: e instanceof Error ? e.message : "Falha no status",
        };
      }
    },
  };
}
