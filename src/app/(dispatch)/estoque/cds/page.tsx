"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Wh = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  active: boolean;
};

export default function CdsPage() {
  const [items, setItems] = useState<Wh[]>([]);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/warehouses");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Falha");
    else {
      setMsg("CD criado");
      setForm({ name: "", code: "", address: "" });
      load();
    }
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/estoque" className="ghost-link">
          ← Estoque
        </Link>
        <Link href="/analytics" className="btn btn-outline">
          Analytics
        </Link>
      </div>
      <h1 className="page-title">Centros de distribuição</h1>
      <p className="page-sub">Multi-CD — cada warehouse com endereços, docks e estoque próprios.</p>
      <div className="grid-2">
        <form className="panel" onSubmit={create}>
          <h3 style={{ marginTop: 0 }}>Novo CD</h3>
          <div className="field">
            <label>Código</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="CD-02"
            />
          </div>
          <div className="field">
            <label>Nome</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="CD Campinas"
            />
          </div>
          <div className="field">
            <label>Endereço</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
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
                <th>Endereço</th>
                <th>Ativo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td>{w.code || "—"}</td>
                  <td>{w.name}</td>
                  <td className="muted">{w.address || "—"}</td>
                  <td>
                    <span className={w.active ? "badge badge-ok" : "badge"}>
                      {w.active ? "sim" : "não"}
                    </span>
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
