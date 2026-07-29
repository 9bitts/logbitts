"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Analytics = {
  from: string;
  to: string;
  summary: {
    deliveriesScheduled: number;
    routes: number;
    stops: number;
    deliveredStops: number;
    failedStops: number;
    otifPct: number | null;
    freightSpend: number;
    yardVisits: number;
    avgYardWaitMin: number | null;
    erpImported: number;
    warehouses: number;
  };
  statusFunnel: Record<string, number>;
  byWarehouse: {
    id: string;
    name: string;
    code: string | null;
    docksFree: number;
    docksTotal: number;
    locations: number;
    stockLines: number;
    stockQty: number;
  }[];
  daily: {
    date: string;
    delivered: number;
    failed: number;
    otifPct: number | null;
    deliveriesScheduled: number;
    stops: number;
  }[];
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState(() => daysAgo(6));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Analytics | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/analytics?from=${from}&to=${to}`);
    if (res.ok) setData(await res.json());
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!data) return;
    const lines = [
      "date,delivered,failed,otif,scheduled,stops",
      ...data.daily.map(
        (d) =>
          `${d.date},${d.delivered},${d.failed},${d.otifPct ?? ""},${d.deliveriesScheduled},${d.stops}`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logbitts-analytics-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxDelivered = Math.max(
    1,
    ...(data?.daily.map((d) => d.delivered) || [1]),
  );
  const s = data?.summary;

  return (
    <div>
      <h1 className="page-title">Analytics</h1>
      <p className="page-sub">
        BI operacional multi-CD — OTIF, funil, pátio, frete e ERP no período.
      </p>
      <div className="toolbar">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="btn btn-outline" onClick={load}>
          Atualizar
        </button>
        <button type="button" className="btn btn-accent" onClick={exportCsv}>
          Export CSV
        </button>
        <Link href="/torre" className="btn btn-outline">
          Torre do dia
        </Link>
      </div>

      {s ? (
        <div className="grid-3" style={{ marginBottom: "1rem" }}>
          <div className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              OTIF no período
            </div>
            <strong style={{ fontSize: "1.6rem" }}>
              {s.otifPct != null ? `${s.otifPct}%` : "—"}
            </strong>
            <div className="muted">
              {s.deliveredStops}/{s.stops} paradas · {s.failedStops} falhas
            </div>
          </div>
          <div className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              Entregas / frete
            </div>
            <strong style={{ fontSize: "1.6rem" }}>
              {s.deliveriesScheduled}
            </strong>
            <div className="muted">
              Frete R$ {s.freightSpend.toFixed(2)} · ERP +{s.erpImported}
            </div>
          </div>
          <div className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              Pátio / CDs
            </div>
            <strong style={{ fontSize: "1.6rem" }}>{s.yardVisits}</strong>
            <div className="muted">
              Espera média{" "}
              {s.avgYardWaitMin != null ? `${s.avgYardWaitMin} min` : "—"} ·{" "}
              {s.warehouses} CD
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Entregas por dia</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
            {data?.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.delivered} ok / OTIF ${d.otifPct ?? "—"}%`}
                style={{
                  flex: 1,
                  background: "var(--accent)",
                  opacity: 0.85,
                  height: `${Math.max(4, (d.delivered / maxDelivered) * 100)}%`,
                  borderRadius: 4,
                }}
              />
            ))}
          </div>
          <div
            className="muted"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.7rem",
              marginTop: 6,
            }}
          >
            <span>{from}</span>
            <span>{to}</span>
          </div>
          <table className="table" style={{ marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>OK</th>
                <th>Falha</th>
                <th>OTIF</th>
              </tr>
            </thead>
            <tbody>
              {data?.daily.map((d) => (
                <tr key={d.date}>
                  <td>{d.date.slice(5)}</td>
                  <td>{d.delivered}</td>
                  <td>{d.failed}</td>
                  <td>{d.otifPct != null ? `${d.otifPct}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Funil de status</h3>
          <table className="table">
            <tbody>
              {data
                ? Object.entries(data.statusFunnel).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>
                        <strong>{v}</strong>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
          <h3>Por CD</h3>
          <table className="table">
            <thead>
              <tr>
                <th>CD</th>
                <th>Docks</th>
                <th>Endereços</th>
                <th>Estoque</th>
              </tr>
            </thead>
            <tbody>
              {data?.byWarehouse.map((w) => (
                <tr key={w.id}>
                  <td>
                    {w.code ? `${w.code} ` : ""}
                    {w.name}
                  </td>
                  <td>
                    {w.docksFree}/{w.docksTotal}
                  </td>
                  <td>{w.locations}</td>
                  <td>
                    {w.stockLines} linhas · qty {w.stockQty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
