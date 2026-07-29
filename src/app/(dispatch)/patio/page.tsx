"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Dock = { id: string; code: string; name: string; status: string; type: string };
type Appt = {
  id: string;
  type: string;
  status: string;
  windowStart: string;
  windowEnd: string;
  vehiclePlate: string | null;
  driverName: string | null;
  dock: { code: string } | null;
  carrier: { name: string } | null;
};
type Visit = {
  id: string;
  vehiclePlate: string;
  status: string;
  checkedInAt: string;
  dock: { code: string } | null;
};

export default function PatioHubPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [docks, setDocks] = useState<Dock[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);

  async function load() {
    const [d, a, v] = await Promise.all([
      fetch("/api/docks").then((r) => r.json()),
      fetch(`/api/yard/appointments?date=${date}`).then((r) => r.json()),
      fetch("/api/yard/visits?onSite=1").then((r) => r.json()),
    ]);
    setDocks(Array.isArray(d) ? d : []);
    setAppts(Array.isArray(a) ? a : []);
    setVisits(Array.isArray(v) ? v : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const free = docks.filter((d) => d.status === "free").length;
  const occupied = docks.filter((d) => d.status === "occupied").length;

  return (
    <div>
      <h1 className="page-title">Pátio (YMS)</h1>
      <p className="page-sub">
        Docks, agendamentos e gate — amarra recebimento e expedição ao CD.
      </p>
      <div className="toolbar">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Link className="btn btn-outline" href="/patio/docks">
          Docks
        </Link>
        <Link className="btn btn-accent" href="/patio/agenda">
          Agenda
        </Link>
        <Link className="btn btn-outline" href="/patio/gate">
          Gate
        </Link>
        <Link className="btn btn-outline" href="/integracoes">
          Integrações
        </Link>
      </div>

      <div className="grid-3" style={{ marginBottom: "1rem" }}>
        <div className="panel">
          <div className="muted">Docks livres</div>
          <strong style={{ fontSize: "1.5rem" }}>
            {free}/{docks.length}
          </strong>
          <div className="muted">Ocupados: {occupied}</div>
        </div>
        <div className="panel">
          <div className="muted">Agendamentos do dia</div>
          <strong style={{ fontSize: "1.5rem" }}>{appts.length}</strong>
          <div className="muted">
            Em andamento:{" "}
            {
              appts.filter((a) =>
                ["checked_in", "at_dock", "loading"].includes(a.status),
              ).length
            }
          </div>
        </div>
        <div className="panel">
          <div className="muted">Veículos no pátio</div>
          <strong style={{ fontSize: "1.5rem" }}>{visits.length}</strong>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Agenda</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Janela</th>
                <th>Tipo</th>
                <th>Placa</th>
                <th>Dock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appts.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.windowStart}–{a.windowEnd}
                  </td>
                  <td>{a.type}</td>
                  <td>{a.vehiclePlate || "—"}</td>
                  <td>{a.dock?.code || "—"}</td>
                  <td>
                    <span className="badge">{a.status}</span>
                  </td>
                </tr>
              ))}
              {!appts.length ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Sem agendamentos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>No pátio agora</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Dock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td>{v.vehiclePlate}</td>
                  <td>{v.dock?.code || "fila"}</td>
                  <td>
                    <span className="badge">{v.status}</span>
                  </td>
                </tr>
              ))}
              {!visits.length ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Pátio vazio.
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
