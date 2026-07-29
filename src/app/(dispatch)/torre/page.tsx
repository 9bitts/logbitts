"use client";

import { useCallback, useEffect, useState } from "react";
import { RouteMap } from "@/components/route-map";

type TowerRoute = {
  id: string;
  name: string;
  status: string;
  driver: { name: string } | null;
  progress: { done: number; total: number };
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

export default function TorrePage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [routes, setRoutes] = useState<TowerRoute[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tower?date=${date}`);
    if (!res.ok) return;
    const data = await res.json();
    setRoutes(data.routes || []);
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
      <p className="page-sub">Acompanhe rotas do dia — atualiza a cada 20s.</p>
      <div className="toolbar">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="button" className="btn btn-outline" onClick={load}>
          Atualizar
        </button>
      </div>
      <div className="grid-2">
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Rota</th>
                <th>Motorista</th>
                <th>Status</th>
                <th>Progresso</th>
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
                      current?.id === r.id ? "rgba(15,118,110,0.08)" : undefined,
                  }}
                >
                  <td>{r.name}</td>
                  <td>{r.driver?.name || "—"}</td>
                  <td>
                    <span className={badge(r.status)}>{r.status}</span>
                  </td>
                  <td>
                    {r.progress.done}/{r.progress.total}
                  </td>
                </tr>
              ))}
              {!routes.length ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhuma rota neste dia. Monte em Rotas.
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
