"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Config = {
  provider: string;
  environment: string;
  apiKey: string | null;
  baseUrl: string | null;
  companyDocument: string | null;
  companyName: string | null;
  active: boolean;
};

export default function FiscalConfigPage() {
  const [form, setForm] = useState<Config>({
    provider: "mock",
    environment: "homologacao",
    apiKey: "",
    baseUrl: "",
    companyDocument: "",
    companyName: "",
    active: true,
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/fiscal/config")
      .then((r) => r.json())
      .then((c) => {
        if (c?.id) {
          setForm({
            provider: c.provider,
            environment: c.environment,
            apiKey: c.apiKey || "",
            baseUrl: c.baseUrl || "",
            companyDocument: c.companyDocument || "",
            companyName: c.companyName || "",
            active: c.active,
          });
        }
      });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/fiscal/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setMsg(res.ok ? "Configuração salva" : data.error || "Falha");
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete/emissao" className="ghost-link">
          ← Emissão
        </Link>
      </div>
      <h1 className="page-title">Parceiro fiscal</h1>
      <p className="page-sub">
        Adapter plugável. Use <code>mock</code> no demo;{" "}
        <code>http_stub</code> aponta para a API do parceiro (Focus, PlugNotas,
        etc.).
      </p>
      <form className="panel" onSubmit={save} style={{ maxWidth: 560 }}>
        <div className="field">
          <label>Provider</label>
          <select
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          >
            <option value="mock">mock (homologação local)</option>
            <option value="http_stub">http_stub (parceiro)</option>
            <option value="sefaz_direct">sefaz_direct (cert A1/A3)</option>
          </select>
        </div>
        <div className="field">
          <label>Ambiente</label>
          <select
            value={form.environment}
            onChange={(e) => setForm({ ...form, environment: e.target.value })}
          >
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </div>
        <div className="field">
          <label>Razão social emitente</label>
          <input
            value={form.companyName || ""}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          />
        </div>
        <div className="field">
          <label>CNPJ emitente</label>
          <input
            value={form.companyDocument || ""}
            onChange={(e) =>
              setForm({ ...form, companyDocument: e.target.value })
            }
          />
        </div>
        <div className="field">
          <label>Base URL (http_stub)</label>
          <input
            value={form.baseUrl || ""}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://parceiro.exemplo/api/fiscal"
          />
        </div>
        <div className="field">
          <label>API key</label>
          <input
            type="password"
            value={form.apiKey || ""}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          />
        </div>
        <button type="submit" className="btn btn-accent">
          Salvar
        </button>
        {msg ? <p className="muted">{msg}</p> : null}
      </form>
    </div>
  );
}
