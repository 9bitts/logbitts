"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Connector = {
  id: string;
  key: string;
  name: string;
  status: string;
  configJson: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

type SyncRun = {
  id: string;
  status: string;
  direction: string;
  startedAt: string;
  createdDeliveries: number;
  createdCustomers: number;
  skipped: number;
  errors: number;
  message: string | null;
};

export default function WinthorPage() {
  const [connector, setConnector] = useState<Connector | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [mode, setMode] = useState<"mock" | "http">("mock");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("logbitts-demo-webhook");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [list, syncs] = await Promise.all([
      fetch("/api/integrations").then((r) => r.json()),
      fetch("/api/integrations/sync?key=winthor").then((r) => r.json()),
    ]);
    const wt = Array.isArray(list)
      ? list.find((c: Connector) => c.key === "winthor")
      : null;
    setConnector(wt || null);
    setRuns(Array.isArray(syncs) ? syncs : []);
    if (wt?.configJson) {
      try {
        const cfg = JSON.parse(wt.configJson);
        setMode(cfg.mode || "mock");
        setBaseUrl(cfg.baseUrl || "");
        setApiKey(cfg.apiKey || "");
        setWebhookSecret(cfg.webhookSecret || "logbitts-demo-webhook");
      } catch {
        /* ignore */
      }
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!connector) return;
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "configure",
        id: connector.id,
        status: "configured",
        config: { mode, baseUrl, apiKey, webhookSecret, companyCode: "DEMO" },
      }),
    });
    setMsg(res.ok ? "Configuração salva" : "Falha ao salvar");
    load();
  }

  async function syncNow() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/integrations/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "winthor" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setMsg(data.error || "Falha no sync");
    else setMsg(data.run?.message || "Sync OK");
    load();
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app";

  return (
    <div>
      <div className="toolbar">
        <Link href="/integracoes" className="ghost-link">
          ← Integrações
        </Link>
        <Link href="/entregas" className="btn btn-outline">
          Ver entregas
        </Link>
      </div>
      <h1 className="page-title">Winthor / ERP</h1>
      <p className="page-sub">
        Pedidos do ERP → clientes + entregas (idempotente por nº do pedido). Mock
        local ou HTTP GET /orders.
      </p>

      <div className="grid-2">
        <form className="panel" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>Conector</h3>
          <div className="muted" style={{ marginBottom: "0.75rem" }}>
            Status:{" "}
            <span className="badge">{connector?.status || "—"}</span>
            {connector?.lastError ? (
              <div className="badge badge-bad">{connector.lastError}</div>
            ) : null}
          </div>
          <div className="field">
            <label>Modo</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "mock" | "http")}
            >
              <option value="mock">mock (demo Winthor)</option>
              <option value="http">http (middleware / API)</option>
            </select>
          </div>
          {mode === "http" ? (
            <>
              <div className="field">
                <label>Base URL</label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://middleware.exemplo/winthor"
                />
              </div>
              <div className="field">
                <label>API key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </>
          ) : null}
          <div className="field">
            <label>Webhook secret</label>
            <input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>
          <div className="toolbar">
            <button type="submit" className="btn btn-outline">
              Salvar
            </button>
            <button
              type="button"
              className="btn btn-accent"
              disabled={busy}
              onClick={syncNow}
            >
              {busy ? "Sincronizando…" : "Sync agora"}
            </button>
          </div>
          {msg ? <p className="muted">{msg}</p> : null}
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "1rem" }}>
            Webhook push:
            <br />
            <code>
              POST {origin}/api/integrations/webhook?org=org_demo_logbitts&key=winthor
            </code>
            <br />
            Header <code>X-Logbitts-Secret: {webhookSecret}</code>
          </p>
        </form>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Histórico de sync</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Dir.</th>
                <th>Resultado</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: "0.8rem" }}>
                    {new Date(r.startedAt).toLocaleString("pt-BR")}
                  </td>
                  <td>{r.direction}</td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {r.message ||
                      `+${r.createdDeliveries} / skip ${r.skipped}`}
                  </td>
                  <td>
                    <span
                      className={
                        r.status === "success"
                          ? "badge badge-ok"
                          : r.status === "error"
                            ? "badge badge-bad"
                            : "badge"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!runs.length ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhum sync ainda — clique em Sync agora.
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
