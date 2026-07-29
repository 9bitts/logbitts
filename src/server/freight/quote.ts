export type QuoteInput = {
  originState: string;
  destState: string;
  originZip?: string | null;
  destZip?: string | null;
  weightKg: number;
};

export type RateRow = {
  id: string;
  tableId: string;
  originState: string;
  destState: string;
  originZipPrefix: string | null;
  destZipPrefix: string | null;
  minWeightKg: number;
  maxWeightKg: number;
  pricePerKg: number;
  minimumPrice: number;
  fixedPrice: number | null;
  transitDays: number | null;
};

function zipPrefix(zip?: string | null, len = 3) {
  if (!zip) return "";
  return zip.replace(/\D/g, "").slice(0, len);
}

export function calcRateAmount(rate: RateRow, weightKg: number) {
  if (rate.fixedPrice != null && rate.fixedPrice > 0) {
    return Math.max(rate.fixedPrice, rate.minimumPrice || 0);
  }
  const raw = weightKg * (rate.pricePerKg || 0);
  return Math.max(raw, rate.minimumPrice || 0);
}

/** Match rates by UF + optional CEP prefix + weight band */
export function matchRates(rates: RateRow[], input: QuoteInput): RateRow[] {
  const oZip = zipPrefix(input.originZip);
  const dZip = zipPrefix(input.destZip);
  const w = input.weightKg || 0;
  const origin = input.originState.toUpperCase().slice(0, 2);
  const dest = input.destState.toUpperCase().slice(0, 2);

  return rates
    .filter((r) => {
      if (r.originState.toUpperCase() !== origin) return false;
      if (r.destState.toUpperCase() !== dest) return false;
      if (w < (r.minWeightKg ?? 0) || w > (r.maxWeightKg ?? 99999)) return false;
      if (r.originZipPrefix && oZip && !oZip.startsWith(r.originZipPrefix.replace(/\D/g, "").slice(0, 3))) {
        return false;
      }
      if (r.destZipPrefix && dZip && !dZip.startsWith(r.destZipPrefix.replace(/\D/g, "").slice(0, 3))) {
        return false;
      }
      return true;
    })
    .sort((a, b) => calcRateAmount(a, w) - calcRateAmount(b, w));
}
