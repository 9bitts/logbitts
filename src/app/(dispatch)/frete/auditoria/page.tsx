"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Shipment = {
  id: string;
  externalCode: string | null;
  expectedAmount: number;
  carrier: { name: string; document: string | null };
};
type Cte = {
  id: string;
  number: string | null;
  chave: string | null;
  freightAmount: number;
  expectedAmount: number | null;
  variance: number | null;
  status: string;
  carrier: { name: string } | null;
};

export default function AuditoriaPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [form, setForm] = useState({
    shipmentId: "",
    number: "",
    chave: "",
    freightAmount: "",
    carrierDocument: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const [s, c] = await Promise.all([
      fetch("/api/freight/shipments").then((r) => r.json()),
      fetch("/api/freight/cte").then((r) => r.json()),
    ]);
    setShipments(s);
    setCtes(c);
    if (s[0] && !form.shipmentId) {
      setForm((f) => ({
        ...f,
        shipmentId: s[0].id,
        freightAmount: String(s[0].expectedAmount),
        carrierDocument: s[0].carrier.document || "",
      }));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function importCte(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/freight/cte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import",
        shipmentId: form.shipmentId || null,
        number: form.number,
        chave: form.chave,
        freightAmount: Number(form.freightAmount),
        carrierDocument: form.carrierDocument,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`CT-e importado: ${data.status}`);
      load();
    } else setMsg(data.error || "Falha");
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete" className="ghost-link">
          ← Frete
        </Link>
      </div>
      <h1 className="page-title">Auditoria de CT-e</h1>
      <p className="page-sub">
        Importação manual/JSON (stub). Emissão fiscal fica na Fase 4.
      </p>
      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Importar CT-e</h3>
          <form onSubmit={importCte}>
            <div className="field">
              <label>Embarque</label>
              <select
                value={form.shipmentId}
                onChange={(e) => {
                  const sh = shipments.find((s) => s.id === e.target.value);
                  setForm({
                    ...form,
                    shipmentId: e.target.value,
                    freightAmount: sh ? String(sh.expectedAmount) : form.freightAmount,
                    carrierDocument: sh?.carrier.document || form.carrierDocument,
                  });
                }}
              >
                <option value="">— auto match —</option>
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.externalCode} — {s.carrier.name} — R${" "}
                    {s.expectedAmount.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Número</label>
              <input
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Chave</label>
              <input
                value={form.chave}
                onChange={(e) => setForm({ ...form, chave: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Valor frete CT-e</label>
              <input
                value={form.freightAmount}
                onChange={(e) =>
                  setForm({ ...form, freightAmount: e.target.value })
                }
                required
              />
            </div>
            <div className="field">
              <label>CNPJ transportadora</label>
              <input
                value={form.carrierDocument}
                onChange={(e) =>
                  setForm({ ...form, carrierDocument: e.target.value })
                }
              />
            </div>
            <button className="btn" type="submit">
              Auditar
            </button>
            {msg ? <p className="muted">{msg}</p> : null}
          </form>
        </div>
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>CT-e</th>
                <th>Valor</th>
                <th>Esperado</th>
                <th>Δ</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ctes.map((c) => (
                <tr key={c.id}>
                  <td>{c.number || c.chave || c.id.slice(-6)}</td>
                  <td>R$ {c.freightAmount.toFixed(2)}</td>
                  <td>
                    {c.expectedAmount != null
                      ? `R$ ${c.expectedAmount.toFixed(2)}`
                      : "—"}
                  </td>
                  <td>
                    {c.variance != null ? c.variance.toFixed(2) : "—"}
                  </td>
                  <td>
                    <span
                      className={
                        c.status === "matched"
                          ? "badge badge-ok"
                          : c.status === "mismatch"
                            ? "badge badge-bad"
                            : "badge"
                      }
                    >
                      {c.status}
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
