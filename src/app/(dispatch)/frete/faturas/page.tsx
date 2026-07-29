"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Carrier = { id: string; name: string };
type Cte = {
  id: string;
  number: string | null;
  freightAmount: number;
  status: string;
  carrierId: string | null;
};
type Invoice = {
  id: string;
  number: string;
  totalAmount: number;
  status: string;
  carrier: { name: string };
};

export default function FaturasPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [carrierId, setCarrierId] = useState("");
  const [number, setNumber] = useState("");
  const [selectedCtes, setSelectedCtes] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const [c, t, i] = await Promise.all([
      fetch("/api/carriers").then((r) => r.json()),
      fetch("/api/freight/cte").then((r) => r.json()),
      fetch("/api/freight/invoices").then((r) => r.json()),
    ]);
    setCarriers(c);
    setCtes(t);
    setInvoices(i);
    if (c[0] && !carrierId) setCarrierId(c[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/freight/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        carrierId,
        number,
        cteIds: selectedCtes,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`Fatura ${data.number} criada`);
      setSelectedCtes([]);
      setNumber("");
      load();
    } else setMsg(data.error || "Falha");
  }

  async function reconcile(id: string) {
    const res = await fetch("/api/freight/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reconcile", id }),
    });
    const data = await res.json();
    setMsg(`Conciliação: ${data.status}`);
    load();
  }

  const ctesForCarrier = ctes.filter(
    (c) => !carrierId || c.carrierId === carrierId,
  );

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete" className="ghost-link">
          ← Frete
        </Link>
      </div>
      <h1 className="page-title">Faturas de frete</h1>
      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Nova fatura</h3>
          <form onSubmit={create}>
            <div className="field">
              <label>Transportadora</label>
              <select
                value={carrierId}
                onChange={(e) => setCarrierId(e.target.value)}
              >
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Número</label>
              <input
                required
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
            <div className="field">
              <label>CT-es</label>
              {ctesForCarrier.map((c) => (
                <label key={c.id} style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={selectedCtes.includes(c.id)}
                    onChange={(e) =>
                      setSelectedCtes((ids) =>
                        e.target.checked
                          ? [...ids, c.id]
                          : ids.filter((x) => x !== c.id),
                      )
                    }
                  />{" "}
                  {c.number || c.id.slice(-6)} — R$ {c.freightAmount.toFixed(2)}{" "}
                  ({c.status})
                </label>
              ))}
            </div>
            <button className="btn" type="submit">
              Criar fatura
            </button>
            {msg ? <p className="muted">{msg}</p> : null}
          </form>
        </div>
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Transportadora</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.number}</td>
                  <td>{i.carrier.name}</td>
                  <td>R$ {i.totalAmount.toFixed(2)}</td>
                  <td>
                    <span
                      className={
                        i.status === "reconciled"
                          ? "badge badge-ok"
                          : i.status === "disputed"
                            ? "badge badge-bad"
                            : "badge"
                      }
                    >
                      {i.status}
                    </span>
                  </td>
                  <td>
                    {i.status === "open" ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => reconcile(i.id)}
                      >
                        Conciliar
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
