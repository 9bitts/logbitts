"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Stop = {
  id: string;
  sequence: number;
  status: string;
  failureReason?: string | null;
  customer: {
    name: string;
    address: string;
    city: string;
    lat: number | null;
    lng: number | null;
  };
  delivery: { externalCode: string | null; packages: number | null };
};

type RouteDetail = {
  id: string;
  name: string;
  status: string;
  stops: Stop[];
};

const QUEUE_KEY = "logbitts_offline_queue";

type QueueItem = {
  id: string;
  body: Record<string, unknown>;
  createdAt: number;
};

function loadQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(items: QueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

async function getGeo(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

function mapsLink(lat: number, lng: number) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`,
  };
}

export default function MotoristaPage() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [routes, setRoutes] = useState<{ id: string; name: string; status: string }[]>(
    [],
  );
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [failReason, setFailReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [queueLen, setQueueLen] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const refreshQueueLen = () => setQueueLen(loadQueue().length);

  const flushQueue = useCallback(async () => {
    const q = loadQueue();
    if (!q.length || !navigator.onLine) return;
    const remaining: QueueItem[] = [];
    for (const item of q) {
      try {
        const res = await fetch("/api/driver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
        if (!res.ok) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    saveQueue(remaining);
    refreshQueueLen();
  }, []);

  const loadRoutes = useCallback(async () => {
    const res = await fetch("/api/driver");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setRoutes(data.routes || []);
  }, [router]);

  async function openRoute(id: string) {
    const res = await fetch(`/api/driver?id=${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setRoute(data);
    const current =
      data.stops.find((s: Stop) =>
        ["en_route", "arrived"].includes(s.status),
      ) || data.stops.find((s: Stop) => s.status === "pending");
    setActiveStopId(current?.id || null);
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      flushQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    loadRoutes();
    refreshQueueLen();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [loadRoutes, flushQueue]);

  async function postAction(body: Record<string, unknown>) {
    setBusy(true);
    try {
      if (!navigator.onLine) {
        const q = loadQueue();
        q.push({ id: crypto.randomUUID(), body, createdAt: Date.now() });
        saveQueue(q);
        refreshQueueLen();
        return;
      }
      const res = await fetch("/api/driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setRoute(data);
        const current =
          data.stops.find((s: Stop) =>
            ["en_route", "arrived"].includes(s.status),
          ) || null;
        setActiveStopId(current?.id || null);
        setPhotoDataUrl(null);
        setRecipientName("");
        clearSignature();
      }
    } finally {
      setBusy(false);
    }
  }

  function clearSignature() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = c.offsetWidth * 2;
    c.height = c.offsetHeight * 2;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.offsetWidth, c.offsetHeight);
    ctx.strokeStyle = "#0f1c2e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    function pos(e: PointerEvent) {
      const rect = c!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function down(e: PointerEvent) {
      drawing.current = true;
      const p = pos(e);
      ctx!.beginPath();
      ctx!.moveTo(p.x, p.y);
    }
    function move(e: PointerEvent) {
      if (!drawing.current) return;
      const p = pos(e);
      ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
    }
    function up() {
      drawing.current = false;
    }
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [activeStopId, route?.id]);

  const active = route?.stops.find((s) => s.id === activeStopId);

  return (
    <div className="driver-shell">
      <div className="driver-top">
        <strong>Logbitts</strong>
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
        <div className="offline-banner">
          Offline — ações serão sincronizadas ({queueLen} na fila)
        </div>
      ) : queueLen ? (
        <div className="offline-banner" style={{ background: "var(--accent)" }}>
          Online — {queueLen} evento(s) pendente(s){" "}
          <button type="button" className="btn-ghost" style={{ color: "#fff" }} onClick={flushQueue}>
            Sync
          </button>
        </div>
      ) : null}

      {!route ? (
        <div className="driver-card">
          <h2 style={{ marginTop: 0 }}>Rotas de hoje</h2>
          {routes.map((r) => (
            <button
              key={r.id}
              type="button"
              className="btn"
              style={{ width: "100%", marginBottom: 8 }}
              onClick={() => openRoute(r.id)}
            >
              {r.name} — {r.status}
            </button>
          ))}
          {!routes.length ? (
            <p className="muted">Nenhuma rota publicada para você hoje.</p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="driver-card">
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{route.name}</strong>
                <div className="muted" style={{ color: "#94a3b8" }}>
                  {route.status}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ color: "#e8eef7", borderColor: "#334155" }}
                onClick={() => setRoute(null)}
              >
                Voltar
              </button>
            </div>
            {route.status === "published" ? (
              <button
                type="button"
                className="btn btn-accent"
                style={{ width: "100%", marginTop: 12 }}
                disabled={busy}
                onClick={() =>
                  postAction({ action: "start_route", routeId: route.id })
                }
              >
                Iniciar rota
              </button>
            ) : null}
          </div>

          {route.stops.map((s) => (
            <button
              key={s.id}
              type="button"
              className="driver-card"
              style={{
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                outline:
                  activeStopId === s.id ? "2px solid var(--accent)" : undefined,
              }}
              onClick={() => setActiveStopId(s.id)}
            >
              <div className="stop-list-item" style={{ border: 0, padding: 0 }}>
                <span className="seq">{s.sequence}</span>
                <div>
                  <strong>{s.customer.name}</strong>
                  <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                    {s.customer.address}
                  </div>
                  <span className="badge" style={{ marginTop: 6 }}>
                    {s.status}
                  </span>
                </div>
              </div>
            </button>
          ))}

          {active && !["delivered", "failed"].includes(active.status) ? (
            <div className="driver-card">
              <h3 style={{ marginTop: 0 }}>Parada #{active.sequence}</h3>
              <p style={{ margin: "0 0 0.5rem" }}>{active.customer.name}</p>
              <p style={{ color: "#94a3b8", marginTop: 0 }}>
                {active.customer.address}, {active.customer.city}
              </p>

              {active.customer.lat != null && active.customer.lng != null ? (
                <div className="driver-actions">
                  <a
                    className="btn btn-accent"
                    href={mapsLink(active.customer.lat, active.customer.lng).waze}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Navegar no Waze
                  </a>
                  <a
                    className="btn btn-outline"
                    style={{ color: "#e8eef7", borderColor: "#334155", textAlign: "center" }}
                    href={
                      mapsLink(active.customer.lat, active.customer.lng).google
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Maps
                  </a>
                </div>
              ) : null}

              <div className="driver-actions">
                {active.status !== "arrived" ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={async () => {
                      const geo = await getGeo();
                      postAction({
                        action: "arrive",
                        stopId: active.id,
                        ...geo,
                      });
                    }}
                  >
                    Check-in / Cheguei
                  </button>
                ) : null}

                <label className="btn btn-outline" style={{ textAlign: "center", color: "#e8eef7", borderColor: "#334155" }}>
                  Tirar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        setPhotoDataUrl(String(reader.result));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {photoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoDataUrl}
                    alt="POD"
                    style={{ width: "100%", borderRadius: 12 }}
                  />
                ) : null}

                <div className="field">
                  <label style={{ color: "#94a3b8" }}>Nome do recebedor</label>
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    style={{ background: "#0b1220", color: "#fff", borderColor: "#334155" }}
                  />
                </div>
                <label style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                  Assinatura
                </label>
                <canvas ref={canvasRef} className="sig-canvas" />
                <button type="button" className="btn-ghost" style={{ color: "#94a3b8" }} onClick={clearSignature}>
                  Limpar assinatura
                </button>

                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={busy}
                  onClick={async () => {
                    const geo = await getGeo();
                    const signatureDataUrl = canvasRef.current?.toDataURL("image/png");
                    postAction({
                      action: "deliver",
                      stopId: active.id,
                      photoDataUrl,
                      signatureDataUrl,
                      recipientName,
                      ...geo,
                    });
                  }}
                >
                  Confirmar entrega (POD)
                </button>

                <div className="field">
                  <label style={{ color: "#94a3b8" }}>Ocorrência / falha</label>
                  <input
                    value={failReason}
                    onChange={(e) => setFailReason(e.target.value)}
                    placeholder="Cliente ausente, recusa…"
                    style={{ background: "#0b1220", color: "#fff", borderColor: "#334155" }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-warn"
                  disabled={busy || !failReason}
                  onClick={async () => {
                    const geo = await getGeo();
                    postAction({
                      action: "fail",
                      stopId: active.id,
                      reason: failReason,
                      ...geo,
                    });
                    setFailReason("");
                  }}
                >
                  Registrar ocorrência
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
