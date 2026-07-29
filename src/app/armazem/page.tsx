"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type PickTask = {
  kind: "pick";
  id: string;
  qty: number;
  product: { sku: string; name: string; barcode: string | null };
  fromLocation: { code: string } | null;
  delivery: { externalCode: string | null };
};

type PutawayTask = {
  kind: "putaway";
  id: string;
  qtyReceived: number;
  product: { sku: string; name: string };
  receipt: { code: string | null };
};

type CycleTask = {
  kind: "cycle";
  id: string;
  qtySystem: number;
  product: { sku: string; name: string };
  location: { code: string };
};

type Task = PickTask | PutawayTask | CycleTask;

const QUEUE_KEY = "logbitts_wh_queue";

export default function ArmazemPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"pick" | "putaway" | "cycle">("pick");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<{ id: string; code: string; type: string }[]>(
    [],
  );
  const [active, setActive] = useState<Task | null>(null);
  const [qty, setQty] = useState("");
  const [locationId, setLocationId] = useState("");
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/warehouse/tasks?type=${tab}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.ok) setTasks(await res.json());
  }, [tab, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    fetch("/api/locations")
      .then((r) => r.json())
      .then((locs) => {
        setLocations(locs);
        const storage = locs.find((l: { type: string }) => l.type === "storage");
        if (storage) setLocationId(storage.id);
      });
    load();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [load]);

  async function confirm() {
    if (!active) return;
    setMsg("");
    try {
      if (active.kind === "pick") {
        const res = await fetch("/api/waves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete_task",
            taskId: active.id,
            qtyPicked: Number(qty || active.qty),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Falha");
      } else if (active.kind === "putaway") {
        const res = await fetch("/api/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "putaway",
            lineId: active.id,
            locationId,
            qty: Number(qty || active.qtyReceived),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Falha");
      } else {
        const res = await fetch("/api/cycle-counts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "count",
            lineId: active.id,
            qtyCounted: Number(qty),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Falha");
      }
      setActive(null);
      setQty("");
      load();
    } catch (e) {
      if (!navigator.onLine) {
        const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
        q.push({ active, qty, locationId, at: Date.now() });
        localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
        setMsg("Salvo offline — sync quando voltar a rede");
      } else {
        setMsg((e as Error).message);
      }
    }
  }

  return (
    <div className="driver-shell">
      <div className="driver-top">
        <strong>Logbitts Armazém</strong>
        <button
          type="button"
          className="btn-ghost"
          style={{ color: "#94a3b8" }}
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
          }}
        >
          Sair
        </button>
      </div>
      {!online ? (
        <div className="offline-banner">Offline — fila local ativa</div>
      ) : null}
      <div className="toolbar" style={{ gap: 8 }}>
        {(["pick", "putaway", "cycle"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "btn" : "btn btn-outline"}
            style={
              tab !== t
                ? { color: "#e8eef7", borderColor: "#334155" }
                : undefined
            }
            onClick={() => {
              setTab(t);
              setActive(null);
            }}
          >
            {t === "pick" ? "Picking" : t === "putaway" ? "Putaway" : "Inventário"}
          </button>
        ))}
      </div>

      {!active ? (
        <div className="driver-card">
          <h2 style={{ marginTop: 0 }}>Fila ({tasks.length})</h2>
          {tasks.map((t) => (
            <button
              key={t.id}
              type="button"
              className="btn"
              style={{ width: "100%", marginBottom: 8, textAlign: "left" }}
              onClick={() => {
                setActive(t);
                if (t.kind === "pick") setQty(String(t.qty));
                if (t.kind === "putaway") setQty(String(t.qtyReceived));
                if (t.kind === "cycle") setQty(String(t.qtySystem));
              }}
            >
              {t.kind === "pick" && (
                <>
                  Pick {t.product.sku} × {t.qty}
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    {t.fromLocation?.code || "?"} · {t.delivery.externalCode}
                  </div>
                </>
              )}
              {t.kind === "putaway" && (
                <>
                  Putaway {t.product.sku} × {t.qtyReceived}
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    ASN {t.receipt.code}
                  </div>
                </>
              )}
              {t.kind === "cycle" && (
                <>
                  Contar {t.product.sku} @ {t.location.code}
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    Sistema: {t.qtySystem}
                  </div>
                </>
              )}
            </button>
          ))}
          {!tasks.length ? (
            <p style={{ color: "#94a3b8" }}>Nada na fila deste tipo.</p>
          ) : null}
        </div>
      ) : (
        <div className="driver-card">
          <button
            type="button"
            className="btn-ghost"
            style={{ color: "#94a3b8" }}
            onClick={() => setActive(null)}
          >
            ← Voltar
          </button>
          <h3>
            {active.kind === "pick" && active.product.name}
            {active.kind === "putaway" && active.product.name}
            {active.kind === "cycle" && active.product.name}
          </h3>
          <p style={{ color: "#94a3b8" }}>
            {active.kind === "pick" &&
              `SKU ${active.product.sku} · De ${active.fromLocation?.code || "—"}`}
            {active.kind === "putaway" && `SKU ${active.product.sku}`}
            {active.kind === "cycle" &&
              `SKU ${active.product.sku} · ${active.location.code}`}
          </p>
          {active.kind === "putaway" ? (
            <div className="field">
              <label style={{ color: "#94a3b8" }}>Endereço destino</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                style={{ background: "#0b1220", color: "#fff", borderColor: "#334155" }}
              >
                {locations
                  .filter((l) => l.type === "storage" || l.type === "picking")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} ({l.type})
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label style={{ color: "#94a3b8" }}>Quantidade</label>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              style={{ background: "#0b1220", color: "#fff", borderColor: "#334155" }}
            />
          </div>
          {msg ? <p style={{ color: "#fbbf24" }}>{msg}</p> : null}
          <button type="button" className="btn btn-accent" style={{ width: "100%" }} onClick={confirm}>
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}
