"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Client = {
  id: string;
  name: string;
  code: string | null;
  document: string | null;
  email: string | null;
  active: boolean;
};

export default function TplClientsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [form, setForm] = useState({
    name: "",
    code: "",
    document: "",
    email: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/tpl/clients");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tpl/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Falha");
    else {
      setMsg("Cliente 3PL criado");
      setForm({ name: "", code: "", document: "", email: "" });
      load();
    }
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/estoque" className="ghost-link">
          ← Estoque
        </Link>
      </div>
      <h1 className="page-title">Clientes 3PL</h1>
      <p className="page-sub">
        Multi-cliente no mesmo CD — cada shipper com código próprio (estoque e
        entregas podem referenciar o cliente).
      </p>
      <div className="grid-2">
        <form className="panel" onSubmit={create}>
          <h3 style={{ marginTop: 0 }}>Novo cliente</h3>
          <div className="field">
            <label>Código</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="CLI-A"
            />
          </div>
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
            <label>E-mail</label>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                <th>CNPJ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.code || "—"}</td>
                  <td>{c.name}</td>
                  <td className="muted">{c.document || "—"}</td>
                  <td>
                    <span className={c.active ? "badge badge-ok" : "badge"}>
                      {c.active ? "ativo" : "inativo"}
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
