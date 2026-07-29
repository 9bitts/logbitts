"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Dock = { id: string; code: string; status: string };
type Carrier = { id: string; name: string };
type Appt = {
  id: string;
  type: string;
  status: string;
  windowStart: string;
  windowEnd: string;
  vehiclePlate: string | null;
  driverName: string | null;
  dockId: string | null;
  dock: { code: string } | null;
  carrier: { name: string } | null;
};

export default function AgendaPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<Appt[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [form, setForm] = useState({
    type: "inbound",
    windowStart: "08:00",
    windowEnd: "09:00",
    vehiclePlate: "",
    driverName: "",
    carrierId: "",
    dockId: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const [a, d, c] = await Promise.all([
      fetch(`/api/yard/appointments?date=${date}`).then((r) => r.json()),
      fetch("/api/docks").then((r) => r.json()),
      fetch("/api/carriers").then((r) => r.json()),
    ]);
    setItems(Array.isArray(a) ? a : []);
    setDocks(Array.isArray(d) ? d : []);
    setCarriers(Array.isArray(c) ? c : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/yard/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        scheduledDate: date,
        carrierId: form.carrierId || null,
        dockId: form.dockId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Falha");
    else {
      setMsg("Agendado");
      load();
    }
  }

  async function assign(id: string, dockId: string) {
    await fetch("/api/yard/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign_dock", id, dockId }),
    });
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/patio" className="ghost-link">
          ← Pátio
        </Link>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <h1 className="page-title">Agenda de docks</h1>
      <div className="grid-2">
        <form className="panel" onSubmit={create}>
          <h3 style={{ marginTop: 0 }}>Novo agendamento</h3>
          <div className="field">
            <label>Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="inbound">Recebimento (inbound)</option>
              <option value="outbound">Expedição (outbound)</option>
              <option value="pickup">Coleta</option>
              <option value="delivery">Entrega no CD</option>
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Início</label>
              <input
                type="time"
                value={form.windowStart}
                onChange={(e) =>
                  setForm({ ...form, windowStart: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Fim</label>
              <input
                type="time"
                value={form.windowEnd}
                onChange={(e) => setForm({ ...form, windowEnd: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Transportadora</label>
            <select
              value={form.carrierId}
              onChange={(e) => setForm({ ...form, carrierId: e.target.value })}
            >
              <option value="">—</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Placa</label>
            <input
              value={form.vehiclePlate}
              onChange={(e) =>
                setForm({ ...form, vehiclePlate: e.target.value })
              }
              placeholder="ABC1D23"
            />
          </div>
          <div className="field">
            <label>Motorista</label>
            <input
              value={form.driverName}
              onChange={(e) => setForm({ ...form, driverName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Dock (opcional)</label>
            <select
              value={form.dockId}
              onChange={(e) => setForm({ ...form, dockId: e.target.value })}
            >
              <option value="">A definir</option>
              {docks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} ({d.status})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-accent">
            Agendar
          </button>
          {msg ? <p className="muted">{msg}</p> : null}
        </form>
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Janela</th>
                <th>Tipo</th>
                <th>Placa</th>
                <th>Dock</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.windowStart}–{a.windowEnd}
                  </td>
                  <td>{a.type}</td>
                  <td>
                    {a.vehiclePlate || "—"}
                    {a.carrier ? (
                      <div className="muted">{a.carrier.name}</div>
                    ) : null}
                  </td>
                  <td>{a.dock?.code || "—"}</td>
                  <td>
                    <span className="badge">{a.status}</span>
                  </td>
                  <td>
                    {!a.dockId && docks[0] ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => assign(a.id, docks[0].id)}
                      >
                        Dock {docks[0].code}
                      </button>
                    ) : null}
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
