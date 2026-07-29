"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Dock = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  active: boolean;
};

export default function DocksPage() {
  const [items, setItems] = useState<Dock[]>([]);
  const [form, setForm] = useState({ code: "", name: "", type: "both" });
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/docks");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/docks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Falha");
    else {
      setMsg("Dock criado");
      setForm({ code: "", name: "", type: "both" });
      load();
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/docks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", id, status }),
    });
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/patio" className="ghost-link">
          ← Pátio
        </Link>
      </div>
      <h1 className="page-title">Docks</h1>
      <div className="grid-2">
        <form className="panel" onSubmit={create}>
          <h3 style={{ marginTop: 0 }}>Novo dock</h3>
          <div className="field">
            <label>Código</label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="D01"
            />
          </div>
          <div className="field">
            <label>Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dock 1 — Recebimento"
            />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="both">Entrada e saída</option>
              <option value="inbound">Só entrada</option>
              <option value="outbound">Só saída</option>
            </select>
          </div>
          <button type="submit" className="btn btn-accent">
            Criar
          </button>
          {msg ? <p className="muted">{msg}</p> : null}
        </form>
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>{d.code}</td>
                  <td>{d.name}</td>
                  <td>{d.type}</td>
                  <td>
                    <span
                      className={
                        d.status === "free"
                          ? "badge badge-ok"
                          : d.status === "occupied"
                            ? "badge badge-warn"
                            : "badge"
                      }
                    >
                      {d.status}
                    </span>
                  </td>
                  <td>
                    {d.status === "blocked" ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setStatus(d.id, "free")}
                      >
                        Liberar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setStatus(d.id, "blocked")}
                      >
                        Bloquear
                      </button>
                    )}
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
