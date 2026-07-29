"use client";

import { useCallback, useEffect, useState } from "react";

export default function CadastrosPage() {
  const [tab, setTab] = useState<"customers" | "drivers" | "vehicles">(
    "customers",
  );
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [drivers, setDrivers] = useState<Record<string, unknown>[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [c, d, v] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/drivers"),
      fetch("/api/vehicles"),
    ]);
    if (c.ok) setCustomers(await c.json());
    if (d.ok) setDrivers(await d.json());
    if (v.ok) setVehicles(await v.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const url =
      tab === "customers"
        ? "/api/customers"
        : tab === "drivers"
          ? "/api/drivers"
          : "/api/vehicles";
    const body =
      tab === "customers"
        ? {
            name: form.name,
            address: form.address,
            city: form.city,
            state: form.state || "SP",
            zip: form.zip,
            lat: form.lat,
            lng: form.lng,
            phone: form.phone,
          }
        : tab === "drivers"
          ? { name: form.name, phone: form.phone, document: form.document }
          : {
              plate: form.plate,
              label: form.label,
              capacityKg: form.capacityKg,
            };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setForm({});
    load();
  }

  return (
    <div>
      <h1 className="page-title">Cadastros</h1>
      <p className="page-sub">Clientes, motoristas e veículos.</p>
      <div className="toolbar">
        {(
          [
            ["customers", "Clientes"],
            ["drivers", "Motoristas"],
            ["vehicles", "Veículos"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={tab === k ? "btn" : "btn btn-outline"}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                {tab === "customers" ? (
                  <>
                    <th>Nome</th>
                    <th>Cidade</th>
                    <th>CEP</th>
                  </>
                ) : null}
                {tab === "drivers" ? (
                  <>
                    <th>Nome</th>
                    <th>Telefone</th>
                  </>
                ) : null}
                {tab === "vehicles" ? (
                  <>
                    <th>Placa</th>
                    <th>Label</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {tab === "customers" &&
                customers.map((c) => (
                  <tr key={String(c.id)}>
                    <td>{String(c.name)}</td>
                    <td>{String(c.city)}</td>
                    <td>{String(c.zip)}</td>
                  </tr>
                ))}
              {tab === "drivers" &&
                drivers.map((d) => (
                  <tr key={String(d.id)}>
                    <td>{String(d.name)}</td>
                    <td>{String(d.phone || "—")}</td>
                  </tr>
                ))}
              {tab === "vehicles" &&
                vehicles.map((v) => (
                  <tr key={String(v.id)}>
                    <td>{String(v.plate)}</td>
                    <td>{String(v.label || "—")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Novo</h3>
          <form onSubmit={submit}>
            {tab === "customers" ? (
              <>
                <div className="field">
                  <label>Nome</label>
                  <input
                    required
                    value={form.name || ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Endereço</label>
                  <input
                    required
                    value={form.address || ""}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Cidade</label>
                  <input
                    required
                    value={form.city || ""}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>UF</label>
                  <input
                    value={form.state || "SP"}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>CEP</label>
                  <input
                    required
                    value={form.zip || ""}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Lat</label>
                  <input
                    value={form.lat || ""}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Lng</label>
                  <input
                    value={form.lng || ""}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            {tab === "drivers" ? (
              <>
                <div className="field">
                  <label>Nome</label>
                  <input
                    required
                    value={form.name || ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            {tab === "vehicles" ? (
              <>
                <div className="field">
                  <label>Placa</label>
                  <input
                    required
                    value={form.plate || ""}
                    onChange={(e) => setForm({ ...form, plate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Label</label>
                  <input
                    value={form.label || ""}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            <button className="btn" type="submit">
              Salvar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
