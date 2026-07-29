"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Connector = {
  id: string;
  key: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

export default function IntegracoesPage() {
  const [items, setItems] = useState<Connector[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/integrations");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function configure(id: string) {
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "configure",
        id,
        status: "configured",
        config: { mode: "stub" },
      }),
    });
    setMsg("Configurado");
    load();
  }

  async function sync(c: Connector) {
    if (["winthor", "sap", "generic_rest"].includes(c.key)) {
      const res = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: c.key }),
      });
      const data = await res.json();
      setMsg(data.run?.message || data.message || data.error || "OK");
      load();
      return;
    }
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_stub", id: c.id }),
    });
    const data = await res.json();
    setMsg(data.message || "OK");
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/torre" className="ghost-link">
          ← Torre
        </Link>
        <Link href="/integracoes/winthor" className="btn btn-accent">
          Winthor
        </Link>
        <Link href="/frete/emissao/config" className="btn btn-outline">
          Parceiro fiscal
        </Link>
      </div>
      <h1 className="page-title">Integrações</h1>
      <p className="page-sub">
        Open Platform: ERP (Winthor) sincroniza pedidos → entregas. Sem clonar o
        ERP.
      </p>
      {msg ? <p className="muted">{msg}</p> : null}
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Conector</th>
              <th>Status</th>
              <th>Último sync</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <div className="muted">{c.key}</div>
                  {c.lastError ? (
                    <div className="muted" style={{ color: "var(--bad)" }}>
                      {c.lastError}
                    </div>
                  ) : null}
                </td>
                <td>
                  <span
                    className={
                      c.status === "connected"
                        ? "badge badge-ok"
                        : c.status === "error"
                          ? "badge badge-bad"
                          : "badge"
                    }
                  >
                    {c.status}
                  </span>
                </td>
                <td className="muted">
                  {c.lastSyncAt
                    ? new Date(c.lastSyncAt).toLocaleString("pt-BR")
                    : "—"}
                </td>
                <td className="toolbar">
                  {c.key === "winthor" ? (
                    <Link
                      href="/integracoes/winthor"
                      className="btn btn-outline"
                    >
                      Abrir
                    </Link>
                  ) : null}
                  {c.status === "available" ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => configure(c.id)}
                    >
                      Configurar
                    </button>
                  ) : null}
                  {["configured", "connected", "error"].includes(c.status) ? (
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={() => sync(c)}
                    >
                      Sync
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
