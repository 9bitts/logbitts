"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function FreteHubPage() {
  const [carriers, setCarriers] = useState<unknown[]>([]);
  const [shipments, setShipments] = useState<{ status: string }[]>([]);
  const [ctes, setCtes] = useState<{ status: string }[]>([]);
  const [invoices, setInvoices] = useState<{ status: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/carriers").then((r) => r.json()),
      fetch("/api/freight/shipments").then((r) => r.json()),
      fetch("/api/freight/cte").then((r) => r.json()),
      fetch("/api/freight/invoices").then((r) => r.json()),
    ]).then(([c, s, t, i]) => {
      setCarriers(Array.isArray(c) ? c : []);
      setShipments(Array.isArray(s) ? s : []);
      setCtes(Array.isArray(t) ? t : []);
      setInvoices(Array.isArray(i) ? i : []);
    });
  }, []);

  return (
    <div>
      <h1 className="page-title">Frete (TMS Embarcador)</h1>
      <p className="page-sub">
        Cotação, contratação, tracking, auditoria de CT-e e conciliação de fatura.
      </p>
      <div className="toolbar">
        <Link className="btn btn-outline" href="/frete/transportadoras">
          Transportadoras
        </Link>
        <Link className="btn btn-outline" href="/frete/tabelas">
          Tabelas de frete
        </Link>
        <Link className="btn btn-accent" href="/frete/cotacao">
          Cotação
        </Link>
        <Link className="btn btn-outline" href="/frete/embarques">
          Embarques
        </Link>
        <Link className="btn btn-outline" href="/frete/auditoria">
          Auditoria CT-e
        </Link>
        <Link className="btn btn-outline" href="/frete/faturas">
          Faturas
        </Link>
      </div>
      <div className="grid-3">
        <div className="panel">
          <div className="muted">Transportadoras</div>
          <strong style={{ fontSize: "1.5rem" }}>{carriers.length}</strong>
        </div>
        <div className="panel">
          <div className="muted">Embarques abertos</div>
          <strong style={{ fontSize: "1.5rem" }}>
            {shipments.filter((s) => ["booked", "in_transit"].includes(s.status)).length}
          </strong>
        </div>
        <div className="panel">
          <div className="muted">CT-e / faturas</div>
          <strong style={{ fontSize: "1.5rem" }}>
            {ctes.length} / {invoices.length}
          </strong>
          <div className="muted">
            Divergências: {ctes.filter((c) => c.status === "mismatch").length}
          </div>
        </div>
      </div>
    </div>
  );
}
