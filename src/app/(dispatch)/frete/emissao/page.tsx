"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Emission = {
  id: string;
  docType: string;
  status: string;
  chave: string | null;
  number: string | null;
  protocol: string | null;
  freightAmount: number;
  errorMessage: string | null;
  carrier: { name: string } | null;
  shipment: { externalCode: string | null } | null;
};

type Shipment = {
  id: string;
  externalCode: string | null;
  expectedAmount: number;
  status: string;
  carrier: { name: string };
};

type RouteRow = {
  id: string;
  name: string;
  routeDate: string;
  status: string;
};

export default function EmissaoFiscalPage() {
  const [tab, setTab] = useState<"cte" | "mdfe" | "ciot">("cte");
  const [emissions, setEmissions] = useState<Emission[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [shipmentId, setShipmentId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverDocument, setDriverDocument] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const date = new Date().toISOString().slice(0, 10);
    const [e, s, t] = await Promise.all([
      fetch("/api/fiscal/emissions").then((r) => r.json()),
      fetch("/api/freight/shipments").then((r) => r.json()),
      fetch(`/api/tower?date=${date}`).then((r) => r.json()),
    ]);
    setEmissions(Array.isArray(e) ? e : []);
    setShipments(Array.isArray(s) ? s : []);
    const routeList = Array.isArray(t?.routes) ? t.routes : [];
    setRoutes(
      routeList.map((r: RouteRow) => ({
        id: r.id,
        name: r.name,
        routeDate: r.routeDate,
        status: r.status,
      })),
    );
    if (!shipmentId && s?.[0]) setShipmentId(s[0].id);
    if (!routeId && routeList[0]) setRouteId(routeList[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function emitDoc() {
    setBusy(true);
    setMsg("");
    const body: Record<string, unknown> = {
      action: "create",
      docType: tab,
      submit: true,
    };
    if (tab === "cte" || tab === "ciot") {
      body.shipmentId = shipmentId;
      if (tab === "ciot") {
        body.vehiclePlate = vehiclePlate || "ABC1D23";
        body.driverDocument = driverDocument || "123.456.789-00";
      }
    } else {
      body.routeId = routeId;
      body.vehiclePlate = vehiclePlate || undefined;
      body.freightAmount = 0;
    }
    const res = await fetch("/api/fiscal/emissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Falha na emissão");
      return;
    }
    setMsg(
      data.status === "authorized"
        ? `${tab.toUpperCase()} autorizado: ${data.chave || data.number || data.protocol}`
        : `${tab.toUpperCase()}: ${data.status} ${data.errorMessage || ""}`,
    );
    load();
  }

  async function cancel(id: string) {
    const reason = window.prompt("Motivo do cancelamento", "Erro de digitação");
    if (!reason) return;
    const res = await fetch("/api/fiscal/emissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", id, reason }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Falha");
    else {
      setMsg("Cancelado");
      load();
    }
  }

  const filtered = emissions.filter((e) => e.docType === tab);

  return (
    <div>
      <div className="toolbar">
        <Link href="/frete" className="ghost-link">
          ← Frete
        </Link>
        <Link href="/frete/emissao/config" className="btn btn-outline">
          Parceiro fiscal
        </Link>
      </div>
      <h1 className="page-title">Emissão fiscal</h1>
      <p className="page-sub">
        CT-e, MDF-e e CIOT via adapter (mock em homologação). Não fala com SEFAZ
        direto — prepara o plug do parceiro.
      </p>

      <div className="toolbar">
        {(["cte", "mdfe", "ciot"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "btn btn-accent" : "btn btn-outline"}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Nova emissão — {tab.toUpperCase()}</h3>
        {(tab === "cte" || tab === "ciot") && (
          <div className="field">
            <label>Embarque</label>
            <select
              value={shipmentId}
              onChange={(e) => setShipmentId(e.target.value)}
            >
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.externalCode} — {s.carrier.name} — R${" "}
                  {s.expectedAmount.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}
        {tab === "mdfe" && (
          <div className="field">
            <label>Rota do dia</label>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.routeDate}) — {r.status}
                </option>
              ))}
            </select>
          </div>
        )}
        {(tab === "mdfe" || tab === "ciot") && (
          <div className="grid-2">
            <div className="field">
              <label>Placa</label>
              <input
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="ABC1D23"
              />
            </div>
            {tab === "ciot" ? (
              <div className="field">
                <label>CPF motorista</label>
                <input
                  value={driverDocument}
                  onChange={(e) => setDriverDocument(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            ) : null}
          </div>
        )}
        <button
          type="button"
          className="btn btn-accent"
          disabled={busy || (tab !== "mdfe" && !shipmentId) || (tab === "mdfe" && !routeId)}
          onClick={emitDoc}
        >
          {busy ? "Emitindo…" : `Emitir ${tab.toUpperCase()}`}
        </button>
        {msg ? <p className="muted">{msg}</p> : null}
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Ref.</th>
              <th>Chave / nº</th>
              <th>Valor</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{e.docType.toUpperCase()}</td>
                <td>
                  {e.shipment?.externalCode || e.carrier?.name || "—"}
                </td>
                <td style={{ fontSize: "0.75rem", maxWidth: 220, wordBreak: "break-all" }}>
                  {e.chave || e.number || "—"}
                  {e.protocol ? (
                    <div className="muted">{e.protocol}</div>
                  ) : null}
                </td>
                <td>R$ {e.freightAmount.toFixed(2)}</td>
                <td>
                  <span
                    className={
                      e.status === "authorized"
                        ? "badge badge-ok"
                        : e.status === "error" || e.status === "rejected"
                          ? "badge badge-bad"
                          : "badge"
                    }
                  >
                    {e.status}
                  </span>
                  {e.errorMessage ? (
                    <div className="muted">{e.errorMessage}</div>
                  ) : null}
                </td>
                <td>
                  {e.status === "authorized" ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => cancel(e.id)}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhuma emissão ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
