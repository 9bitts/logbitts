"use client";

import { useCallback, useEffect, useState } from "react";

type Customer = {
  id: string;
  name: string;
  city: string;
  address: string;
};
type Delivery = {
  id: string;
  externalCode: string | null;
  status: string;
  scheduledDate: string | null;
  weightKg: number | null;
  customer: Customer;
};

export default function EntregasPage() {
  const [items, setItems] = useState<Delivery[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("");
  const [externalCode, setExternalCode] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [dRes, cRes] = await Promise.all([
      fetch(`/api/deliveries?date=${date}`),
      fetch("/api/customers"),
    ]);
    if (dRes.ok) setItems(await dRes.json());
    if (cRes.ok) {
      const c = await cRes.json();
      setCustomers(c);
      if (!customerId && c[0]) setCustomerId(c[0].id);
    }
  }, [date, customerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createDelivery(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        externalCode,
        scheduledDate: date,
      }),
    });
    if (res.ok) {
      setExternalCode("");
      load();
    }
  }

  async function onImport(file: File) {
    const text = await file.text();
    const res = await fetch("/api/deliveries/import", {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    const data = await res.json();
    setMsg(
      `Importados: ${data.createdDeliveries} entregas, ${data.createdCustomers} clientes` +
        (data.errors?.length ? ` (${data.errors.length} erros)` : ""),
    );
    load();
  }

  return (
    <div>
      <h1 className="page-title">Entregas</h1>
      <p className="page-sub">
        Pedidos do dia — importação CSV/API genérica (stub ERP).
      </p>
      <div className="grid-2">
        <div className="panel">
          <div className="toolbar">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <label className="btn btn-outline" style={{ cursor: "pointer" }}>
              Importar CSV
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                }}
              />
            </label>
          </div>
          {msg ? <p className="muted">{msg}</p> : null}
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Cidade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>{d.externalCode || d.id.slice(-6)}</td>
                  <td>{d.customer.name}</td>
                  <td>{d.customer.city}</td>
                  <td>
                    <span
                      className={
                        d.status === "pending" ? "badge" : "badge badge-run"
                      }
                    >
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.75rem" }}>
            CSV: customer_name, address, city, state, zip, lat, lng,
            external_code, weight_kg, scheduled_date
          </p>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Nova entrega</h3>
          <form onSubmit={createDelivery}>
            <div className="field">
              <label>Cliente</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Código externo</label>
              <input
                value={externalCode}
                onChange={(e) => setExternalCode(e.target.value)}
                placeholder="PED-1234"
              />
            </div>
            <button className="btn" type="submit">
              Criar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
