"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function EstoqueDashboard() {
  const [stock, setStock] = useState<
    { qty: number; product: { sku: string; name: string }; location: { code: string } }[]
  >([]);
  const [waves, setWaves] = useState<{ id: string; name: string; status: string }[]>([]);
  const [receipts, setReceipts] = useState<{ id: string; code: string | null; status: string }[]>(
    [],
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/stock").then((r) => r.json()),
      fetch("/api/waves").then((r) => r.json()),
      fetch("/api/receipts").then((r) => r.json()),
    ]).then(([s, w, r]) => {
      setStock(Array.isArray(s) ? s : []);
      setWaves(Array.isArray(w) ? w : []);
      setReceipts(Array.isArray(r) ? r : []);
    });
  }, []);

  const low = stock.filter((s) => s.qty > 0 && s.qty < 10);

  return (
    <div>
      <h1 className="page-title">Estoque (WMS)</h1>
      <p className="page-sub">Recebimento → endereçamento → picking → expedição (DMS).</p>
      <div className="toolbar">
        <Link className="btn btn-outline" href="/estoque/produtos">
          Produtos
        </Link>
        <Link className="btn btn-outline" href="/estoque/enderecos">
          Endereços
        </Link>
        <Link className="btn btn-outline" href="/estoque/recebimento">
          Recebimento
        </Link>
        <Link className="btn btn-accent" href="/estoque/ondas">
          Ondas de picking
        </Link>
        <Link className="btn btn-outline" href="/estoque/inventario">
          Inventário
        </Link>
        <Link className="btn" href="/armazem">
          App coletor
        </Link>
      </div>
      <div className="grid-3">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Saldos baixos</h3>
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Endereço</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {low.slice(0, 8).map((s, i) => (
                <tr key={i}>
                  <td>
                    {s.product.sku} — {s.product.name}
                  </td>
                  <td>{s.location.code}</td>
                  <td>{s.qty}</td>
                </tr>
              ))}
              {!low.length ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Sem alertas
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Ondas</h3>
          <ul style={{ paddingLeft: "1rem" }}>
            {waves.slice(0, 6).map((w) => (
              <li key={w.id}>
                {w.name} — <span className="badge">{w.status}</span>
              </li>
            ))}
            {!waves.length ? <li className="muted">Nenhuma onda</li> : null}
          </ul>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Recebimentos</h3>
          <ul style={{ paddingLeft: "1rem" }}>
            {receipts.slice(0, 6).map((r) => (
              <li key={r.id}>
                {r.code} — <span className="badge">{r.status}</span>
              </li>
            ))}
            {!receipts.length ? <li className="muted">Nenhum ASN</li> : null}
          </ul>
        </div>
      </div>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Estoque atual</h3>
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Endereço</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s, i) => (
              <tr key={i}>
                <td>{s.product.sku}</td>
                <td>{s.product.name}</td>
                <td>{s.location.code}</td>
                <td>{s.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
