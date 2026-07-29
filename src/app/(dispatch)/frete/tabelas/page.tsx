"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Carrier = { id: string; name: string };
type Table = { id: string; name: string; carrierId: string | null; carrier: Carrier | null };
type Rate = {
  id: string;
  originState: string;
  destState: string;
  pricePerKg: number;
  minimumPrice: number;
  transitDays: number | null;
};

export default function TabelasPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [rates, setRates] = useState<Rate[]>([]);
  const [tableForm, setTableForm] = useState({ name: "", carrierId: "" });
  const [rateForm, setRateForm] = useState({
    originState: "SP",
    destState: "SP",
    pricePerKg: "2.5",
    minimumPrice: "35",
    transitDays: "2",
  });

  async function load() {
    const [c, t] = await Promise.all([
      fetch("/api/carriers").then((r) => r.json()),
      fetch("/api/freight/rates").then((r) => r.json()),
    ]);
    setCarriers(c);
    setTables(t);
    if (t[0] && !selected) setSelected(t[0].id);
    if (c[0] && !tableForm.carrierId) {
      setTableForm((f) => ({ ...f, carrierId: c[0].id }));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/freight/rates?tableId=${selected}`)
      .then((r) => r.json())
      .then(setRates);
  }, [selected]);

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/freight/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_table",
        name: tableForm.name,
        carrierId: tableForm.carrierId,
      }),
    });
    if (res.ok) {
      const row = await res.json();
      setSelected(row.id);
      setTableForm((f) => ({ ...f, name: "" }));
      load();
    }
  }

  async function addRate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await fetch("/api/freight/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_rate",
        tableId: selected,
        ...rateForm,
        pricePerKg: Number(rateForm.pricePerKg),
        minimumPrice: Number(rateForm.minimumPrice),
        transitDays: Number(rateForm.transitDays),
      }),
    });
    const res = await fetch(`/api/freight/rates?tableId=${selected}`);
    setRates(await res.json());
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete" className="ghost-link">
          ← Frete
        </Link>
      </div>
      <h1 className="page-title">Tabelas de frete</h1>
      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Tabelas</h3>
          <ul style={{ paddingLeft: "1rem" }}>
            {tables.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setSelected(t.id)}
                >
                  {t.name} {t.carrier ? `(${t.carrier.name})` : ""}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={createTable} style={{ marginTop: "1rem" }}>
            <div className="field">
              <label>Nome</label>
              <input
                required
                value={tableForm.name}
                onChange={(e) =>
                  setTableForm({ ...tableForm, name: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Transportadora</label>
              <select
                value={tableForm.carrierId}
                onChange={(e) =>
                  setTableForm({ ...tableForm, carrierId: e.target.value })
                }
              >
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn" type="submit">
              Criar tabela
            </button>
          </form>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Faixas</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Origem</th>
                <th>Destino</th>
                <th>R$/kg</th>
                <th>Mín.</th>
                <th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>{r.originState}</td>
                  <td>{r.destState}</td>
                  <td>{r.pricePerKg}</td>
                  <td>{r.minimumPrice}</td>
                  <td>{r.transitDays}d</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={addRate}>
            <div className="grid-2">
              <div className="field">
                <label>UF origem</label>
                <input
                  value={rateForm.originState}
                  onChange={(e) =>
                    setRateForm({ ...rateForm, originState: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>UF destino</label>
                <input
                  value={rateForm.destState}
                  onChange={(e) =>
                    setRateForm({ ...rateForm, destState: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label>R$/kg</label>
              <input
                value={rateForm.pricePerKg}
                onChange={(e) =>
                  setRateForm({ ...rateForm, pricePerKg: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Mínimo</label>
              <input
                value={rateForm.minimumPrice}
                onChange={(e) =>
                  setRateForm({ ...rateForm, minimumPrice: e.target.value })
                }
              />
            </div>
            <button className="btn" type="submit" disabled={!selected}>
              Adicionar faixa
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
