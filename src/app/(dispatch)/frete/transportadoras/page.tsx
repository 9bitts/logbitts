"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function TransportadorasPage() {
  const [items, setItems] = useState<
    { id: string; name: string; document: string | null; phone: string | null; active: boolean }[]
  >([]);
  const [form, setForm] = useState({
    name: "",
    document: "",
    rntrc: "",
    phone: "",
    email: "",
  });

  async function load() {
    const res = await fetch("/api/carriers");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/carriers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", document: "", rntrc: "", phone: "", email: "" });
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete" className="ghost-link">
          ← Frete
        </Link>
      </div>
      <h1 className="page-title">Transportadoras</h1>
      <div className="grid-2">
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>Telefone</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.document || "—"}</td>
                  <td>{c.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Nova transportadora</h3>
          <form onSubmit={submit}>
            <div className="field">
              <label>Nome</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>CNPJ</label>
              <input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
              />
            </div>
            <div className="field">
              <label>RNTRC</label>
              <input
                value={form.rntrc}
                onChange={(e) => setForm({ ...form, rntrc: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <button className="btn" type="submit">
              Salvar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
