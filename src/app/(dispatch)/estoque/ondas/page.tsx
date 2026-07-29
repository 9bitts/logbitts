"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Delivery = {
  id: string;
  externalCode: string | null;
  status: string;
  customer: { name: string };
};

type Wave = {
  id: string;
  name: string;
  status: string;
  tasks?: {
    id: string;
    qty: number;
    status: string;
    product: { sku: string; name: string };
    fromLocation: { code: string } | null;
    delivery: { externalCode: string | null };
  }[];
};

export default function OndasPage() {
  const [pending, setPending] = useState<Delivery[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [detail, setDetail] = useState<Wave | null>(null);

  async function load() {
    const date = new Date().toISOString().slice(0, 10);
    const [d, w] = await Promise.all([
      fetch(`/api/deliveries?date=${date}&status=pending`).then((r) => r.json()),
      fetch("/api/waves").then((r) => r.json()),
    ]);
    setPending(Array.isArray(d) ? d.filter((x: Delivery) => x.status === "pending") : []);
    setWaves(Array.isArray(w) ? w : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function openWave(id: string) {
    const res = await fetch(`/api/waves?id=${id}`);
    if (res.ok) setDetail(await res.json());
  }

  async function createWave() {
    const res = await fetch("/api/waves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryIds: selected }),
    });
    if (res.ok) {
      const data = await res.json();
      setDetail(data);
      setSelected([]);
      load();
    } else {
      const err = await res.json();
      alert(err.error || "Falha");
    }
  }

  async function release() {
    if (!detail) return;
    const res = await fetch("/api/waves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", id: detail.id }),
    });
    if (res.ok) {
      setDetail(await res.json());
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
      <h1 className="page-title">Ondas de picking</h1>
      <p className="page-sub">
        Pedidos pending → onda → liberar → coletor separa → ready_to_ship → rotas DMS.
      </p>
      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Entregas pending</h3>
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Pedido</th>
                <th>Cliente</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(d.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, d.id]
                            : ids.filter((x) => x !== d.id),
                        )
                      }
                    />
                  </td>
                  <td>{d.externalCode || d.id.slice(-6)}</td>
                  <td>{d.customer.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="btn btn-accent"
            disabled={!selected.length}
            onClick={createWave}
          >
            Criar onda ({selected.length})
          </button>
          <h3>Ondas</h3>
          <ul style={{ paddingLeft: "1rem" }}>
            {waves.map((w) => (
              <li key={w.id}>
                <button type="button" className="btn-ghost" onClick={() => openWave(w.id)}>
                  {w.name} — {w.status}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel">
          {detail ? (
            <>
              <div className="toolbar">
                <strong>{detail.name}</strong>
                <span className="badge">{detail.status}</span>
                {detail.status === "draft" ? (
                  <button type="button" className="btn btn-warn" onClick={release}>
                    Liberar para armazém
                  </button>
                ) : null}
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>SKU</th>
                    <th>De</th>
                    <th>Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.tasks || []).map((t) => (
                    <tr key={t.id}>
                      <td>{t.delivery.externalCode}</td>
                      <td>
                        {t.product.sku} — {t.product.name}
                      </td>
                      <td>{t.fromLocation?.code || "—"}</td>
                      <td>{t.qty}</td>
                      <td>
                        <span className="badge">{t.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">Selecione uma onda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
