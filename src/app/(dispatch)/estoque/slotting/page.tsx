"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  WarehouseSwitcher,
  useWarehouseSelection,
} from "@/components/warehouse-switcher";

type Rule = {
  id: string;
  name: string;
  priority: number;
  productSkuPrefix: string | null;
  locationType: string | null;
  preferPicking: boolean;
  active: boolean;
};
type Suggestion = {
  locationId: string;
  code: string;
  type: string;
  score: number;
  reason: string;
};

export default function SlottingPage() {
  const { warehouses, warehouseId, setWarehouseId } = useWarehouseSelection();
  const [rules, setRules] = useState<Rule[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sku, setSku] = useState("SKU-ARROZ");
  const [form, setForm] = useState({
    name: "SKU → picking",
    priority: "50",
    productSkuPrefix: "SKU-",
    locationType: "picking",
  });
  const [msg, setMsg] = useState("");

  async function loadRules() {
    const res = await fetch("/api/slotting");
    if (res.ok) setRules(await res.json());
  }

  useEffect(() => {
    loadRules();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/slotting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        warehouseId: warehouseId || null,
        priority: Number(form.priority),
        preferPicking: true,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Regra criada" : data.error || "Falha");
    loadRules();
  }

  async function suggest() {
    if (!warehouseId) return;
    const res = await fetch(
      `/api/slotting?suggest=1&warehouseId=${warehouseId}&sku=${encodeURIComponent(sku)}`,
    );
    if (res.ok) setSuggestions(await res.json());
  }

  return (
    <div>
      <div className="toolbar">
        <Link href="/estoque" className="ghost-link">
          ← Estoque
        </Link>
        <WarehouseSwitcher
          warehouses={warehouses}
          warehouseId={warehouseId}
          onChange={setWarehouseId}
        />
      </div>
      <h1 className="page-title">Slotting</h1>
      <p className="page-sub">
        Sugestão de endereçamento por regras (IA leve) — score por zona, ocupação
        e afinidade de SKU.
      </p>
      <div className="grid-2">
        <form className="panel" onSubmit={create}>
          <h3 style={{ marginTop: 0 }}>Nova regra</h3>
          <div className="field">
            <label>Nome</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Prioridade (menor = mais forte)</label>
            <input
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Prefixo SKU</label>
            <input
              value={form.productSkuPrefix}
              onChange={(e) =>
                setForm({ ...form, productSkuPrefix: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label>Tipo de endereço</label>
            <select
              value={form.locationType}
              onChange={(e) =>
                setForm({ ...form, locationType: e.target.value })
              }
            >
              <option value="">qualquer</option>
              <option value="picking">picking</option>
              <option value="storage">storage</option>
            </select>
          </div>
          <button type="submit" className="btn btn-accent">
            Salvar regra
          </button>
          {msg ? <p className="muted">{msg}</p> : null}
        </form>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Sugerir putaway</h3>
          <div className="field">
            <label>SKU</label>
            <input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <button type="button" className="btn btn-outline" onClick={suggest}>
            Calcular
          </button>
          <table className="table" style={{ marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>Endereço</th>
                <th>Tipo</th>
                <th>Score</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.locationId}>
                  <td>{s.code}</td>
                  <td>{s.type}</td>
                  <td>
                    <strong>{s.score}</strong>
                  </td>
                  <td className="muted">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Regras ativas</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Prio</th>
              <th>SKU</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.priority}</td>
                <td>{r.productSkuPrefix || "—"}</td>
                <td>{r.locationType || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
