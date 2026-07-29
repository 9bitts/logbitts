"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Dock = { id: string; code: string; status: string };
type Appt = {
  id: string;
  vehiclePlate: string | null;
  windowStart: string;
  status: string;
  type: string;
};
type Visit = {
  id: string;
  vehiclePlate: string;
  driverName: string | null;
  status: string;
  checkedInAt: string;
  waitMinutes: number | null;
  dock: { id: string; code: string } | null;
};

export default function GatePage() {
  const [docks, setDocks] = useState<Dock[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [form, setForm] = useState({
    vehiclePlate: "",
    driverName: "",
    appointmentId: "",
    dockId: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const date = new Date().toISOString().slice(0, 10);
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
  }, []);

  async function checkIn(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/yard/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "check_in",
        vehiclePlate: form.vehiclePlate,
        driverName: form.driverName || null,
        appointmentId: form.appointmentId || null,
        dockId: form.dockId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Falha");
    else {
      setMsg(`Check-in ${form.vehiclePlate}`);
      setForm({ vehiclePlate: "", driverName: "", appointmentId: "", dockId: "" });
      load();
    }
  }

  async function assignDock(id: string, dockId: string) {
    await fetch("/api/yard/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign_dock", id, dockId }),
    });
    load();
  }

  async function checkOut(id: string) {
    const res = await fetch("/api/yard/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_out", id }),
    });
    const data = await res.json();
    if (res.ok) setMsg(`Checkout — espera ${data.waitMinutes} min`);
    load();
  }

  const freeDocks = docks.filter((d) => d.status === "free");

  return (
    <div>
      <div className="toolbar">
        <Link href="/patio" className="ghost-link">
          ← Pátio
        </Link>
      </div>
      <h1 className="page-title">Gate</h1>
      <p className="page-sub">Check-in / check-out de veículos no CD.</p>
      <div className="grid-2">
        <form className="panel" onSubmit={checkIn}>
          <h3 style={{ marginTop: 0 }}>Check-in</h3>
          <div className="field">
            <label>Agendamento (opcional)</label>
            <select
              value={form.appointmentId}
              onChange={(e) => {
                const a = appts.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  appointmentId: e.target.value,
                  vehiclePlate: a?.vehiclePlate || form.vehiclePlate,
                });
              }}
            >
              <option value="">Walk-in / sem agenda</option>
              {appts
                .filter((a) => !["done", "cancelled", "no_show"].includes(a.status))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.windowStart} {a.type} {a.vehiclePlate || ""}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>Placa</label>
            <input
              required
              value={form.vehiclePlate}
              onChange={(e) =>
                setForm({ ...form, vehiclePlate: e.target.value })
              }
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
            <label>Dock direto (opcional)</label>
            <select
              value={form.dockId}
              onChange={(e) => setForm({ ...form, dockId: e.target.value })}
            >
              <option value="">Fila do pátio</option>
              {freeDocks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-accent">
            Check-in
          </button>
          {msg ? <p className="muted">{msg}</p> : null}
        </form>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>No pátio</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Dock</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.vehiclePlate}
                    {v.driverName ? (
                      <div className="muted">{v.driverName}</div>
                    ) : null}
                  </td>
                  <td>{v.dock?.code || "fila"}</td>
                  <td>
                    <span className="badge">{v.status}</span>
                  </td>
                  <td className="toolbar">
                    {v.status === "on_site" && freeDocks[0] ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => assignDock(v.id, freeDocks[0].id)}
                      >
                        → {freeDocks[0].code}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={() => checkOut(v.id)}
                    >
                      Checkout
                    </button>
                  </td>
                </tr>
              ))}
              {!visits.length ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhum veículo.
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
