"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Lake = {
  from: string;
  to: string;
  total: number;
  byType: Record<string, number>;
  byDay: { date: string; count: number }[];
  events: {
    id: string;
    eventType: string;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
    payload: unknown;
  }[];
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function DataLakePage() {
  const [from, setFrom] = useState(() => daysAgo(6));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Lake | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events?from=${from}&to=${to}`);
    if (res.ok) setData(await res.json());
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function exportJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logbitts-events-${from}_${to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxDay = Math.max(1, ...(data?.byDay.map((d) => d.count) || [1]));

  return (
    <div>
      <div className="toolbar">
        <Link href="/analytics" className="ghost-link">
          ← Analytics
        </Link>
      </div>
      <h1 className="page-title">Event lake</h1>
      <p className="page-sub">
        Stream de eventos de domínio (data lake operacional) — base para BI
        enterprise e integrações.
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
        <button type="button" className="btn btn-accent" onClick={exportJson}>
          Export JSON
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: "1rem" }}>
        <div className="panel">
          <div className="muted">Eventos no período</div>
          <strong style={{ fontSize: "1.5rem" }}>{data?.total ?? 0}</strong>
        </div>
        <div className="panel">
          <div className="muted">Tipos distintos</div>
          <strong style={{ fontSize: "1.5rem" }}>
            {data ? Object.keys(data.byType).length : 0}
          </strong>
        </div>
        <div className="panel">
          <div className="muted">Volume diário</div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 4,
              height: 48,
              marginTop: 8,
            }}
          >
            {data?.byDay.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count}`}
                style={{
                  flex: 1,
                  height: `${(d.count / maxDay) * 100}%`,
                  minHeight: 2,
                  background: "var(--accent)",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Por tipo</h3>
          <table className="table">
            <tbody>
              {data
                ? Object.entries(data.byType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <tr key={k}>
                        <td>
                          <code>{k}</code>
                        </td>
                        <td>
                          <strong>{v}</strong>
                        </td>
                      </tr>
                    ))
                : null}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Últimos eventos</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Tipo</th>
                <th>Entidade</th>
              </tr>
            </thead>
            <tbody>
              {data?.events.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: "0.75rem" }}>
                    {new Date(e.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td>
                    <code style={{ fontSize: "0.75rem" }}>{e.eventType}</code>
                  </td>
                  <td className="muted">
                    {e.entityType}/{e.entityId?.slice(-6)}
                  </td>
                </tr>
              ))}
              {!data?.events.length ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Sem eventos — use 3PL, marketplace ou certificado para gerar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
