"use client";

import { useCallback, useEffect, useState } from "react";
import { RouteMap } from "@/components/route-map";
import Link from "next/link";

type TowerRoute = {
  id: string;
  name: string;
  status: string;
  driver: { name: string } | null;
  progress: { done: number; total: number; delivered: number; failed: number };
  metrics: {
    otifPct: number | null;
    km: number;
    freightCost: number;
    costPerKm: number | null;
    slaRisk: boolean;
  };
  stops: {
    id: string;
    sequence: number;
    status: string;
    lat: number | null;
    lng: number | null;
    customerName: string;
    address: string;
  }[];
};

type Kpis = {
  otifPct: number | null;
  routesCount: number;
  stopsTotal: number;
  stopsDelivered: number;
  openShipments: number;
  mismatchCtes: number;
  freightSpend: number;
  avgCostPerKm: number | null;
  authorizedEmissions: number;
  fiscalErrors: number;
};

export default function TorrePage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [routes, setRoutes] = useState<TowerRoute[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tower?date=${date}`);
    if (!res.ok) return;
    const data = await res.json();
    setRoutes(data.routes || []);
    setKpis(data.kpis || null);
    if (!selected && data.routes?.[0]) setSelected(data.routes[0].id);
  }, [date, selected]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const current = routes.find((r) => r.id === selected) || routes[0];
  const mapStops =
    current?.stops.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      status: s.status,
      sequence: s.sequence,
      label: s.customerName,
    })) || [];

  function badge(status: string) {
    if (status === "completed") return "badge badge-ok";
    if (status === "in_progress") return "badge badge-run";
    if (status === "published") return "badge badge-warn";
    return "badge";
  }

  return (
    <div>
      <h1 className="page-title">Torre de controle</h1>
      <p className="page-sub">
        Operação do dia + KPIs embarcador (OTIF, custo/km, frete, fiscal).
      </p>
      <div className="toolbar">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="button" className="btn btn-outline" onClick={load}>
          Atualizar
        </button>
        <Link href="/frete/emissao" className="btn btn-accent">
          Emissão fiscal
        </Link>
        <Link href="/frete" className="btn btn-outline">
          Frete
        </Link>
      </div>

      {kpis ? (
        <div className="grid-3" style={{ marginBottom: "1rem" }}>
          <div className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              OTIF do dia
            </div>
            <strong style={{ fontSize: "1.6rem" }}>
              {kpis.otifPct != null ? `${kpis.otifPct}%` : "—"}
            </strong>
            <div className="muted">
              {kpis.stopsDelivered}/{kpis.stopsTotal} paradas
            </div>
          </div>
          <div className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              Frete contratado
            </div>
            <strong style={{ fontSize: "1.6rem" }}>
              R$ {kpis.freightSpend.toFixed(2)}
            </strong>
            <div className="muted">
              Custo/km médio:{" "}
              {kpis.avgCostPerKm != null ? `R$ ${kpis.avgCostPerKm}` : "—"}
            </div>
          </div>
          <div className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              SLA / auditoria
            </div>
            <strong style={{ fontSize: "1.6rem" }}>
              {kpis.openShipments} emb.
            </strong>
            <div className="muted">
              CT-e divergentes:{" "}
              <span className={kpis.mismatchCtes ? "badge badge-bad" : "badge"}>
                {kpis.mismatchCtes}
              </span>
              {" · "}
              Emissões OK: {kpis.authorizedEmissions}
              {kpis.fiscalErrors ? (
                <>
                  {" · "}
                  <span className="badge badge-bad">
                    erros {kpis.fiscalErrors}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Rota</th>
                <th>Motorista</th>
                <th>OTIF</th>
                <th>Km</th>
                <th>R$/km</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  style={{
                    cursor: "pointer",
                    background:
                      current?.id === r.id
                        ? "rgba(15,118,110,0.08)"
                        : undefined,
                  }}
                >
                  <td>
                    {r.name}
                    {r.metrics.slaRisk ? (
                      <span className="badge badge-bad" style={{ marginLeft: 6 }}>
                        SLA
                      </span>
                    ) : null}
                  </td>
                  <td>{r.driver?.name || "—"}</td>
                  <td>
                    {r.metrics.otifPct != null ? `${r.metrics.otifPct}%` : "—"}
                  </td>
                  <td>{r.metrics.km}</td>
                  <td>
                    {r.metrics.costPerKm != null
                      ? r.metrics.costPerKm.toFixed(2)
                      : "—"}
                  </td>
                  <td>
                    <span className={badge(r.status)}>{r.status}</span>
                  </td>
                </tr>
              ))}
              {!routes.length ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Nenhuma rota neste dia.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <RouteMap stops={mapStops} />
          {current ? (
            <div style={{ marginTop: "0.75rem" }}>
              <strong>{current.name}</strong>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                Frete rota: R$ {current.metrics.freightCost.toFixed(2)} ·{" "}
                {current.progress.delivered} ok / {current.progress.failed} falha
              </div>
              <ul style={{ paddingLeft: "1.1rem", margin: "0.5rem 0 0" }}>
                {current.stops.map((s) => (
                  <li key={s.id} className="muted" style={{ marginBottom: 4 }}>
                    #{s.sequence} {s.customerName} — {s.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
