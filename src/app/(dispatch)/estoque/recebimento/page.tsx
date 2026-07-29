"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Product = { id: string; sku: string; name: string };
type Receipt = {
  id: string;
  code: string | null;
  status: string;
  supplier: string | null;
  lines?: {
    id: string;
    qtyExpected: number;
    qtyReceived: number;
    status: string;
    product: Product;
  }[];
};

export default function RecebimentoPage() {
  const [warehouseId, setWarehouseId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [detail, setDetail] = useState<Receipt | null>(null);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("10");
  const [supplier, setSupplier] = useState("");

  async function load() {
    const [w, p, r] = await Promise.all([
      fetch("/api/warehouses").then((x) => x.json()),
      fetch("/api/products").then((x) => x.json()),
      fetch("/api/receipts").then((x) => x.json()),
    ]);
    if (w[0]) setWarehouseId(w[0].id);
    setProducts(p);
    setReceipts(r);
    if (p[0] && !productId) setProductId(p[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(id: string) {
    const res = await fetch(`/api/receipts?id=${id}`);
    if (res.ok) setDetail(await res.json());
  }

  async function createAsn(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId,
        supplier,
        lines: [{ productId, qtyExpected: Number(qty) }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setDetail(data);
      load();
    }
  }

  async function receive(lineId: string, q: number) {
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "receive", lineId, qty: q }),
    });
    if (res.ok) setDetail(await res.json());
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/estoque" className="ghost-link">
          ← Estoque
        </Link>
      </div>
      <h1 className="page-title">Recebimento</h1>
      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>ASNs</h3>
          <ul style={{ paddingLeft: "1rem" }}>
            {receipts.map((r) => (
              <li key={r.id}>
                <button type="button" className="btn-ghost" onClick={() => openDetail(r.id)}>
                  {r.code} — {r.status}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={createAsn} style={{ marginTop: "1rem" }}>
            <div className="field">
              <label>Fornecedor</label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="field">
              <label>Produto</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Qty esperada</label>
              <input value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={!warehouseId}>
              Abrir ASN
            </button>
          </form>
        </div>
        <div className="panel">
          {detail ? (
            <>
              <h3 style={{ marginTop: 0 }}>
                {detail.code} <span className="badge">{detail.status}</span>
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Esp.</th>
                    <th>Rec.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lines || []).map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.product.sku} — {l.product.name}
                      </td>
                      <td>{l.qtyExpected}</td>
                      <td>{l.qtyReceived}</td>
                      <td>
                        {l.status === "pending" ? (
                          <button
                            type="button"
                            className="btn btn-accent"
                            onClick={() => receive(l.id, l.qtyExpected)}
                          >
                            Conferir
                          </button>
                        ) : (
                          <span className="badge">{l.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted">
                Após conferir, use o app armazém para putaway nos endereços.
              </p>
            </>
          ) : (
            <p className="muted">Selecione ou crie um ASN.</p>
          )}
        </div>
      </div>
    </div>
  );
}
