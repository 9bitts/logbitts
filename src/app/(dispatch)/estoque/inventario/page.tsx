"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Count = {
  id: string;
  name: string;
  status: string;
  lines?: {
    id: string;
    qtySystem: number;
    qtyCounted: number | null;
    status: string;
    product: { sku: string; name: string };
    location: { code: string };
  }[];
};

export default function InventarioPage() {
  const [counts, setCounts] = useState<Count[]>([]);
  const [detail, setDetail] = useState<Count | null>(null);
  const [input, setInput] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/cycle-counts");
    if (res.ok) setCounts(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function open(id: string) {
    const res = await fetch(`/api/cycle-counts?id=${id}`);
    if (res.ok) setDetail(await res.json());
  }

  async function create() {
    const res = await fetch("/api/cycle-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      setDetail(data);
      load();
    }
  }

  async function countLine(lineId: string) {
    const qty = Number(input[lineId]);
    const res = await fetch("/api/cycle-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "count", lineId, qtyCounted: qty }),
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
        <button type="button" className="btn btn-accent" onClick={create}>
          Abrir inventário
        </button>
      </div>
      <h1 className="page-title">Inventário cíclico</h1>
      <div className="grid-2">
        <div className="panel">
          <ul style={{ paddingLeft: "1rem" }}>
            {counts.map((c) => (
              <li key={c.id}>
                <button type="button" className="btn-ghost" onClick={() => open(c.id)}>
                  {c.name} — {c.status}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel">
          {detail ? (
            <>
              <h3 style={{ marginTop: 0 }}>
                {detail.name} <span className="badge">{detail.status}</span>
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>End.</th>
                    <th>Sistema</th>
                    <th>Contado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lines || []).map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.product.sku}
                      </td>
                      <td>{l.location.code}</td>
                      <td>{l.qtySystem}</td>
                      <td>
                        {l.status === "pending" ? (
                          <input
                            style={{ width: 80 }}
                            value={input[l.id] ?? ""}
                            onChange={(e) =>
                              setInput({ ...input, [l.id]: e.target.value })
                            }
                            placeholder={String(l.qtySystem)}
                          />
                        ) : (
                          l.qtyCounted
                        )}
                      </td>
                      <td>
                        {l.status === "pending" ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => countLine(l.id)}
                          >
                            Lançar
                          </button>
                        ) : (
                          <span className="badge badge-ok">ok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">Selecione um inventário.</p>
          )}
        </div>
      </div>
    </div>
  );
}
