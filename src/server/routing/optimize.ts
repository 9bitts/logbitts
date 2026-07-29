import { haversineKm } from "../lib/ids";

export type StopPoint = {
  id: string;
  lat: number;
  lng: number;
  zip?: string | null;
  weightKg?: number | null;
  volumeM3?: number | null;
};

/**
 * Nearest-neighbor from depot, with light zip/region bias.
 * Good enough for distributor mid-market MVP (~30 stops).
 */
export function optimizeSequence(
  points: StopPoint[],
  depot?: { lat: number; lng: number } | null,
): string[] {
  if (points.length <= 1) return points.map((p) => p.id);

  const withCoords = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  const without = points.filter(
    (p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lng),
  );

  // Group by first 5 ZIP digits when present
  const groups = new Map<string, StopPoint[]>();
  for (const p of withCoords) {
    const key = (p.zip || "00000").replace(/\D/g, "").slice(0, 5) || "00000";
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const groupCenters = [...groups.entries()].map(([key, list]) => {
    const lat = list.reduce((s, p) => s + p.lat, 0) / list.length;
    const lng = list.reduce((s, p) => s + p.lng, 0) / list.length;
    return { key, lat, lng, list };
  });

  const start =
    depot && Number.isFinite(depot.lat) && Number.isFinite(depot.lng)
      ? depot
      : { lat: withCoords[0].lat, lng: withCoords[0].lng };

  const orderedGroups: typeof groupCenters = [];
  const remaining = [...groupCenters];
  let cursor = start;
  while (remaining.length) {
    remaining.sort(
      (a, b) =>
        haversineKm(cursor, a) - haversineKm(cursor, b),
    );
    const next = remaining.shift()!;
    orderedGroups.push(next);
    cursor = next;
  }

  const result: string[] = [];
  for (const g of orderedGroups) {
    const local = [...g.list];
    let localCursor = result.length
      ? withCoords.find((p) => p.id === result[result.length - 1]) || start
      : start;
    while (local.length) {
      local.sort(
        (a, b) =>
          haversineKm(localCursor, a) - haversineKm(localCursor, b),
      );
      const n = local.shift()!;
      result.push(n.id);
      localCursor = n;
    }
  }

  for (const p of without) result.push(p.id);
  return result;
}
