import type {
  FiscalCancelRequest,
  FiscalEmitRequest,
  FiscalEmitResult,
  FiscalProvider,
} from "./types";

function digits(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function fakeChave(mod: string) {
  // 44 digits — not a real SEFAZ key; demo only
  const uf = "35";
  const aamm = new Date().toISOString().slice(2, 7).replace("-", "");
  const cnpj = digits(14);
  const modelo = mod; // 57 CT-e, 58 MDF-e
  return `${uf}${aamm}${cnpj}${modelo}${digits(9)}${digits(1)}${digits(8)}`.slice(
    0,
    44,
  );
}

export function createMockProvider(): FiscalProvider {
  return {
    kind: "mock",
    async emit(req: FiscalEmitRequest): Promise<FiscalEmitResult> {
      if (req.freightAmount < 0) {
        return {
          ok: false,
          status: "rejected",
          message: "Valor de frete inválido",
          raw: { reason: "VALOR" },
        };
      }
      const seq = String(Date.now()).slice(-6);
      if (req.docType === "ciot") {
        const ciotNumber = `CIOT${digits(10)}`;
        return {
          ok: true,
          status: "authorized",
          externalId: `mock_ciot_${req.emissionId}`,
          protocol: `PROT-CIOT-${seq}`,
          ciotNumber,
          number: ciotNumber,
          series: "1",
          raw: { provider: "mock", docType: "ciot" },
        };
      }
      const modelo = req.docType === "mdfe" ? "58" : "57";
      return {
        ok: true,
        status: "authorized",
        externalId: `mock_${req.docType}_${req.emissionId}`,
        chave: fakeChave(modelo),
        number: seq,
        series: "1",
        protocol: `PROT-${req.docType.toUpperCase()}-${seq}`,
        raw: { provider: "mock", docType: req.docType, ambiente: req.environment },
      };
    },
    async cancel(req: FiscalCancelRequest): Promise<FiscalEmitResult> {
      return {
        ok: true,
        status: "authorized",
        externalId: req.externalId || undefined,
        protocol: `CANC-${Date.now().toString().slice(-6)}`,
        message: req.reason,
        raw: { cancelled: true, provider: "mock" },
      };
    },
    async status(externalId: string): Promise<FiscalEmitResult> {
      return {
        ok: true,
        status: "authorized",
        externalId,
        raw: { polled: true },
      };
    },
  };
}
