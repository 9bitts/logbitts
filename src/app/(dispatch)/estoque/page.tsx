"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  WarehouseSwitcher,
  useWarehouseSelection,
} from "@/components/warehouse-switcher";

export default function EstoqueDashboard() {
  const { warehouses, warehouseId, setWarehouseId, current } =
    useWarehouseSelection();
  const [stock, setStock] = useState<
    { qty: number; product: { sku: string; name: string }; location: { code: string } }[]
  >([]);
  const [waves, setWaves] = useState<{ id: string; name: string; status: string }[]>([]);
  const [receipts, setReceipts] = useState<{ id: string; code: string | null; status: string }[]>(
    [],
  );

  useEffect(() => {
    if (!warehouseId) return;
    const q = `?warehouseId=${warehouseId}`;
    Promise.all([
      fetch(`/api/stock${q}`).then((r) => r.json()),
      fetch("/api/waves").then((r) => r.json()),
      fetch("/api/receipts").then((r) => r.json()),
    ]).then(([s, w, r]) => {
      setStock(Array.isArray(s) ? s : []);
      setWaves(Array.isArray(w) ? w : []);
      setReceipts(Array.isArray(r) ? r : []);
    });
  }, [warehouseId]);

  const low = stock.filter((s) => s.qty > 0 && s.qty < 10);

  return (
    <div>
      <h1 className="page-title">Estoque (WMS)</h1>
      <p className="page-sub">
        Multi-CD — recebimento → picking → expedição.
      </p>
      <div className="toolbar">
        <WarehouseSwitcher
          warehouses={warehouses}
          warehouseId={warehouseId}
          onChange={setWarehouseId}
        />
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
        <Link className="btn btn-outline" href="/estoque/cds">
          CDs
        </Link>
        <Link className="btn btn-outline" href="/estoque/clientes-3pl">
          3PL
        </Link>
        <Link className="btn btn-outline" href="/estoque/slotting">
          Slotting
        </Link>
        <Link className="btn" href="/armazem">
          App coletor
        </Link>
      </div>
      <p className="muted">CD ativo: {current?.name || "—"}</p>
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
          <strong style={{ fontSize: "1.5rem" }}>{waves.length}</strong>
          <div className="muted">
            Abertas: {waves.filter((w) => w.status !== "done").length}
          </div>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Recebimentos</h3>
          <strong style={{ fontSize: "1.5rem" }}>{receipts.length}</strong>
          <div className="muted">
            Abertos:{" "}
            {receipts.filter((r) => !["putaway_done", "cancelled"].includes(r.status || "")).length}
          </div>
        </div>
      </div>
    </div>
  );
}
