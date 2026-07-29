import type {
  FiscalCancelRequest,
  FiscalEmitRequest,
  FiscalEmitResult,
  FiscalProvider,
} from "./types";
import { createMockProvider } from "./mock";

/**
 * "SEFAZ direto" via certificado A1/A3 — demo path.
 * Real SEFAZ would sign XML with the cert; here we require an active cert fingerprint.
 */
export function createSefazDirectProvider(cert: {
  fingerprint: string;
  type: string;
  alias: string;
  status: string;
}): FiscalProvider {
  const mock = createMockProvider();
  return {
    kind: "mock", // reuse shape; caller sets provider string sefaz_direct on emission
    async emit(req: FiscalEmitRequest): Promise<FiscalEmitResult> {
      if (cert.status !== "active") {
        return {
          ok: false,
          status: "rejected",
          message: `Certificado ${cert.alias} não está ativo`,
        };
      }
      if (!cert.fingerprint) {
        return {
          ok: false,
          status: "error",
          message: "Certificado sem fingerprint",
        };
      }
      const result = await mock.emit(req);
      return {
        ...result,
        protocol: result.protocol
          ? `SEFAZ-${cert.type}-${result.protocol}`
          : `SEFAZ-${cert.type}`,
        raw: {
          ...(typeof result.raw === "object" && result.raw ? result.raw : {}),
          provider: "sefaz_direct",
          certificate: cert.alias,
          fingerprint: cert.fingerprint,
          tipo: cert.type,
        },
      };
    },
    async cancel(req: FiscalCancelRequest): Promise<FiscalEmitResult> {
      if (cert.status !== "active") {
        return {
          ok: false,
          status: "rejected",
          message: "Certificado inativo",
        };
      }
      const result = await mock.cancel(req);
      return {
        ...result,
        raw: { ...(typeof result.raw === "object" && result.raw ? result.raw : {}), provider: "sefaz_direct" },
      };
    },
    async status(externalId: string) {
      return mock.status(externalId);
    },
  };
}
