"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Cert = {
  id: string;
  type: string;
  alias: string;
  cnpj: string | null;
  fingerprint: string | null;
  validTo: string | null;
  status: string;
};

export default function CertificadosPage() {
  const [items, setItems] = useState<Cert[]>([]);
  const [form, setForm] = useState({
    type: "A1",
    alias: "Certificado Demo A1",
    cnpj: "00.000.000/0001-91",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/fiscal/certificates");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function register(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/fiscal/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", ...form }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Certificado registrado (stub — sem chave privada)" : data.error);
    load();
  }

  async function activate(id: string) {
    const res = await fetch("/api/fiscal/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate", id }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? "Ativo — provider fiscal = sefaz_direct"
        : data.error || "Falha",
    );
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete/emissao" className="ghost-link">
          ← Emissão
        </Link>
        <Link href="/frete/emissao/config" className="btn btn-outline">
          Provider
        </Link>
      </div>
      <h1 className="page-title">Certificados A1 / A3</h1>
      <p className="page-sub">
        Cadastro de certificado para emissão SEFAZ direta (homologação demo —
        não armazena chave privada).
      </p>
      {msg ? <p className="muted">{msg}</p> : null}
      <div className="grid-2">
        <form className="panel" onSubmit={register}>
          <h3 style={{ marginTop: 0 }}>Registrar</h3>
          <div className="field">
            <label>Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="A1">A1 (arquivo)</option>
              <option value="A3">A3 (token/HSM)</option>
            </select>
          </div>
          <div className="field">
            <label>Alias</label>
            <input
              required
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
            />
          </div>
          <div className="field">
            <label>CNPJ</label>
            <input
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-accent">
            Registrar stub
          </button>
        </form>
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Alias</th>
                <th>Tipo</th>
                <th>Validade</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.alias}
                    <div className="muted" style={{ fontSize: "0.7rem" }}>
                      {c.fingerprint}
                    </div>
                  </td>
                  <td>{c.type}</td>
                  <td>{c.validTo || "—"}</td>
                  <td>
                    <span
                      className={
                        c.status === "active" ? "badge badge-ok" : "badge"
                      }
                    >
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {c.status === "pending" ? (
                      <button
                        type="button"
                        className="btn btn-accent"
                        onClick={() => activate(c.id)}
                      >
                        Ativar
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
