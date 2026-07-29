"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Shipment = {
  id: string;
  externalCode: string | null;
  status: string;
  expectedAmount: number;
  trackingCode: string | null;
  carrier: { name: string };
};

export default function EmbarquesPage() {
  const [items, setItems] = useState<Shipment[]>([]);

  async function load() {
    const res = await fetch("/api/freight/shipments");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch("/api/freight/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_status",
        id,
        status,
        trackingCode: status === "in_transit" ? `TRK-${id.slice(-6)}` : undefined,
      }),
    });
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete" className="ghost-link">
          ← Frete
        </Link>
        <Link href="/frete/cotacao" className="btn btn-accent">
          Nova cotação
        </Link>
      </div>
      <h1 className="page-title">Embarques</h1>
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Transportadora</th>
              <th>Valor</th>
              <th>Tracking</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.externalCode}</td>
                <td>{s.carrier.name}</td>
                <td>R$ {s.expectedAmount.toFixed(2)}</td>
                <td>{s.trackingCode || "—"}</td>
                <td>
                  <span className="badge">{s.status}</span>
                </td>
                <td className="toolbar">
                  {s.status === "booked" ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setStatus(s.id, "in_transit")}
                    >
                      Em trânsito
                    </button>
                  ) : null}
                  {s.status === "in_transit" ? (
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={() => setStatus(s.id, "delivered")}
                    >
                      Entregue
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
