"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProdutosPage() {
  const [items, setItems] = useState<
    { id: string; sku: string; name: string; unit: string; barcode: string | null }[]
  >([]);
  const [form, setForm] = useState({ sku: "", name: "", barcode: "", unit: "UN" });

  async function load() {
    const res = await fetch("/api/products");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ sku: "", name: "", barcode: "", unit: "UN" });
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/estoque" className="ghost-link">
          ← Estoque
        </Link>
      </div>
      <h1 className="page-title">Produtos</h1>
      <div className="grid-2">
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nome</th>
                <th>Un</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Novo produto</h3>
          <form onSubmit={submit}>
            <div className="field">
              <label>SKU</label>
              <input
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Nome</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Barcode</label>
              <input
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
            <button className="btn" type="submit">
              Salvar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
