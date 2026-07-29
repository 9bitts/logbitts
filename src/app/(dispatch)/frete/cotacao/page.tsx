"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Delivery = {
  id: string;
  externalCode: string | null;
  weightKg: number | null;
  status: string;
  customer: { name: string; state: string; zip: string; city: string };
};

type Quote = {
  id: string;
  amount: number;
  transitDays: number | null;
  weightKg: number;
  destState: string;
  tableName?: string;
  carrier: { id: string; name: string } | null;
};

export default function CotacaoPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveryId, setDeliveryId] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const date = new Date().toISOString().slice(0, 10);
    fetch(`/api/deliveries?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setDeliveries(list);
        if (list[0]) setDeliveryId(list[0].id);
      });
  }, []);

  async function quote() {
    setMsg("");
    const res = await fetch("/api/freight/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Falha na cotação");
      return;
    }
    setQuotes(data.quotes || []);
    if (!data.quotes?.length) setMsg("Nenhuma tabela cobriu esta rota/peso.");
  }

  async function book(quoteId: string) {
    const res = await fetch("/api/freight/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "book", quoteId, deliveryId }),
    });
    if (res.ok) {
      setMsg("Embarque contratado.");
      setQuotes([]);
    } else {
      const err = await res.json();
      setMsg(err.error || "Falha ao contratar");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete" className="ghost-link">
          ← Frete
        </Link>
      </div>
      <h1 className="page-title">Cotação de frete</h1>
      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="field">
          <label>Entrega</label>
          <select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
            {deliveries.map((d) => (
              <option key={d.id} value={d.id}>
                {d.externalCode || d.id.slice(-6)} — {d.customer.name} ({d.customer.city}/
                {d.customer.state}) · {d.weightKg || 0}kg
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-accent" onClick={quote} disabled={!deliveryId}>
          Cotar
        </button>
        {msg ? <p className="muted">{msg}</p> : null}
        <table className="table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Transportadora</th>
              <th>Tabela</th>
              <th>Valor</th>
              <th>Prazo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td>{q.carrier?.name || "—"}</td>
                <td>{q.tableName || "—"}</td>
                <td>R$ {q.amount.toFixed(2)}</td>
                <td>{q.transitDays ?? "—"}d</td>
                <td>
                  <button type="button" className="btn" onClick={() => book(q.id)}>
                    Contratar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
