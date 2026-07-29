"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Delivery = {
  id: string;
  externalCode: string | null;
  weightKg: number | null;
  customer: { city: string; state: string; name: string };
};
type Carrier = { id: string; name: string };
type Bid = {
  id: string;
  amount: number;
  transitDays: number | null;
  status: string;
  carrier: { name: string };
};
type Offer = {
  id: string;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  weightKg: number;
  priceAsk: number | null;
  status: string;
  bids: Bid[];
};

export default function MarketplacePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [deliveryId, setDeliveryId] = useState("");
  const [priceAsk, setPriceAsk] = useState("");
  const [bidForm, setBidForm] = useState({
    offerId: "",
    carrierId: "",
    amount: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const date = new Date().toISOString().slice(0, 10);
    const [o, d, c] = await Promise.all([
      fetch("/api/marketplace/offers").then((r) => r.json()),
      fetch(`/api/deliveries?date=${date}`).then((r) => r.json()),
      fetch("/api/carriers").then((r) => r.json()),
    ]);
    setOffers(Array.isArray(o) ? o : []);
    setDeliveries(Array.isArray(d) ? d : []);
    setCarriers(Array.isArray(c) ? c : []);
    if (d?.[0] && !deliveryId) setDeliveryId(d[0].id);
    if (c?.[0]) setBidForm((f) => ({ ...f, carrierId: f.carrierId || c[0].id }));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publish(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/marketplace/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        deliveryId: deliveryId || null,
        priceAsk: priceAsk ? Number(priceAsk) : null,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Oferta publicada" : data.error || "Falha");
    load();
  }

  async function bid(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/marketplace/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bid",
        offerId: bidForm.offerId,
        carrierId: bidForm.carrierId,
        amount: Number(bidForm.amount),
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Lance registrado" : data.error || "Falha");
    load();
  }

  async function accept(bidId: string) {
    const res = await fetch("/api/marketplace/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept_bid", bidId }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? `Adjudicado → embarque ${data.shipment?.externalCode}`
        : data.error || "Falha",
    );
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete" className="ghost-link">
          ← Frete
        </Link>
        <Link href="/frete/embarques" className="btn btn-outline">
          Embarques
        </Link>
      </div>
      <h1 className="page-title">Marketplace de cargas</h1>
      <p className="page-sub">
        Publique oferta → transportadoras lançam → aceite vira embarque.
      </p>
      {msg ? <p className="muted">{msg}</p> : null}

      <div className="grid-2">
        <form className="panel" onSubmit={publish}>
          <h3 style={{ marginTop: 0 }}>Publicar oferta</h3>
          <div className="field">
            <label>Entrega</label>
            <select
              value={deliveryId}
              onChange={(e) => setDeliveryId(e.target.value)}
            >
              {deliveries.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.externalCode || d.id.slice(-6)} — {d.customer.name} (
                  {d.customer.city}/{d.customer.state})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Preço pedido (R$)</label>
            <input
              value={priceAsk}
              onChange={(e) => setPriceAsk(e.target.value)}
              placeholder="opcional"
            />
          </div>
          <button type="submit" className="btn btn-accent">
            Publicar
          </button>
        </form>

        <form className="panel" onSubmit={bid}>
          <h3 style={{ marginTop: 0 }}>Registrar lance</h3>
          <div className="field">
            <label>Oferta</label>
            <select
              value={bidForm.offerId}
              onChange={(e) => setBidForm({ ...bidForm, offerId: e.target.value })}
              required
            >
              <option value="">—</option>
              {offers
                .filter((o) => ["open", "bidding"].includes(o.status))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.originState}→{o.destState} {o.weightKg}kg ({o.status})
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>Transportadora</label>
            <select
              value={bidForm.carrierId}
              onChange={(e) =>
                setBidForm({ ...bidForm, carrierId: e.target.value })
              }
            >
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Valor (R$)</label>
            <input
              required
              value={bidForm.amount}
              onChange={(e) => setBidForm({ ...bidForm, amount: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-outline">
            Lançar
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Ofertas</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Rota</th>
              <th>Peso</th>
              <th>Ask</th>
              <th>Lances</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id}>
                <td>
                  {o.originCity}/{o.originState} → {o.destCity}/{o.destState}
                </td>
                <td>{o.weightKg} kg</td>
                <td>
                  {o.priceAsk != null ? `R$ ${o.priceAsk.toFixed(2)}` : "—"}
                </td>
                <td>
                  {(o.bids || []).map((b) => (
                    <div key={b.id} className="toolbar" style={{ marginBottom: 4 }}>
                      <span>
                        {b.carrier.name}: R$ {b.amount.toFixed(2)}
                      </span>
                      {b.status === "open" &&
                      ["open", "bidding"].includes(o.status) ? (
                        <button
                          type="button"
                          className="btn btn-accent"
                          onClick={() => accept(b.id)}
                        >
                          Aceitar
                        </button>
                      ) : (
                        <span className="badge">{b.status}</span>
                      )}
                    </div>
                  ))}
                  {!o.bids?.length ? (
                    <span className="muted">sem lances</span>
                  ) : null}
                </td>
                <td>
                  <span className="badge">{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
