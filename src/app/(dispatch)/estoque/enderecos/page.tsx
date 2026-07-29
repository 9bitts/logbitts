"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function EnderecosPage() {
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<
    { id: string; code: string; type: string; warehouseId: string }[]
  >([]);
  const [form, setForm] = useState({
    warehouseId: "",
    code: "",
    type: "storage",
  });

  async function load() {
    const [w, l] = await Promise.all([
      fetch("/api/warehouses").then((r) => r.json()),
      fetch("/api/locations").then((r) => r.json()),
    ]);
    setWarehouses(w);
    setLocations(l);
    if (w[0] && !form.warehouseId) setForm((f) => ({ ...f, warehouseId: w[0].id }));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm((f) => ({ ...f, code: "" }));
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/estoque" className="ghost-link">
          ← Estoque
        </Link>
      </div>
      <h1 className="page-title">Endereços</h1>
      <p className="page-sub">
        CD: {warehouses[0]?.name || "—"}
      </p>
      <div className="grid-2">
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id}>
                  <td>{l.code}</td>
                  <td>
                    <span className="badge">{l.type}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Novo endereço</h3>
          <form onSubmit={submit}>
            <div className="field">
              <label>Código</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="A-01-02"
              />
            </div>
            <div className="field">
              <label>Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="receiving">receiving</option>
                <option value="storage">storage</option>
                <option value="picking">picking</option>
                <option value="shipping">shipping</option>
              </select>
            </div>
            <button className="btn" type="submit" disabled={!form.warehouseId}>
              Salvar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
