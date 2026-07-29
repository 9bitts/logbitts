"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RouteMap } from "@/components/route-map-lazy";
import Link from "next/link";

type Delivery = {
  id: string;
  status: string;
  externalCode: string | null;
  customer: {
    id: string;
    name: string;
    address: string;
    city: string;
    lat: number | null;
    lng: number | null;
    zip: string;
  };
};

type RouteDetail = {
  id: string;
  name: string;
  status: string;
  routeDate: string;
  driverId: string | null;
  vehicleId: string | null;
  stops: {
    id: string;
    sequence: number;
    status: string;
    delivery: Delivery;
    customer: Delivery["customer"];
  }[];
};

function SortableStop({
  id: stopId,
  label,
  meta,
}: {
  id: string;
  label: string;
  meta: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: stopId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-row"
      {...attributes}
      {...listeners}
    >
      <span className="badge">⋮⋮</span>
      <div>
        <strong>{label}</strong>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          {meta}
        </div>
      </div>
    </div>
  );
}

export default function RotasPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState<Delivery[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [routes, setRoutes] = useState<{ id: string; name: string; status: string }[]>(
    [],
  );
  const [detail, setDetail] = useState<RouteDetail | null>(null);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; label: string | null }[]>(
    [],
  );
  const [stopOrder, setStopOrder] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadLists = useCallback(async () => {
    const [dRes, rRes, drvRes, vRes] = await Promise.all([
      fetch(`/api/deliveries?date=${date}&status=ready_to_ship`),
      fetch(`/api/routes?date=${date}`),
      fetch("/api/drivers"),
      fetch("/api/vehicles"),
    ]);
    if (dRes.ok) {
      const all = await dRes.json();
      setPending(all.filter((d: Delivery) => d.status === "ready_to_ship"));
    }
    if (rRes.ok) setRoutes(await rRes.json());
    if (drvRes.ok) setDrivers(await drvRes.json());
    if (vRes.ok) setVehicles(await vRes.json());
  }, [date]);

  async function openRoute(id: string) {
    const res = await fetch(`/api/routes?id=${id}`);
    if (!res.ok) return;
    const data: RouteDetail = await res.json();
    setDetail(data);
    setStopOrder(data.stops.map((s) => s.id));
  }

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  async function createRoute() {
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routeDate: date,
        deliveryIds: selectedIds,
        driverId: drivers[0]?.id,
        vehicleId: vehicles[0]?.id,
        optimize: true,
        name: `Rota ${date}`,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setSelectedIds([]);
    await loadLists();
    openRoute(data.id);
  }

  async function patch(action: string, extra: Record<string, unknown> = {}) {
    if (!detail) return;
    const res = await fetch("/api/routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: detail.id, action, ...extra }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setDetail(data);
    setStopOrder(data.stops.map((s: { id: string }) => s.id));
    loadLists();
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStopOrder((items) => {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  async function saveOrder() {
    await patch("reorder", { stopIds: stopOrder });
  }

  const orderedStops = useMemo(() => {
    if (!detail) return [];
    return stopOrder
      .map((id) => detail.stops.find((s) => s.id === id))
      .filter(Boolean) as RouteDetail["stops"];
  }, [detail, stopOrder]);

  return (
    <div>
      <h1 className="page-title">Rotas</h1>
      <p className="page-sub">
        Selecione entregas, otimize a sequência e publique para o motorista.
      </p>
      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Entregas prontas (ready_to_ship)</h3>
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Cliente</th>
                <th>Endereço</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(d.id)}
                      onChange={(e) => {
                        setSelectedIds((ids) =>
                          e.target.checked
                            ? [...ids, d.id]
                            : ids.filter((x) => x !== d.id),
                        );
                      }}
                    />
                  </td>
                  <td>{d.customer.name}</td>
                  <td className="muted">
                    {d.customer.address} — {d.customer.city}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="toolbar" style={{ marginTop: "0.75rem" }}>
            <button
              className="btn btn-accent"
              disabled={!selectedIds.length}
              onClick={createRoute}
              type="button"
            >
              Criar rota ({selectedIds.length})
            </button>
          </div>
          <h3>Rotas do dia</h3>
          <ul style={{ paddingLeft: "1rem" }}>
            {routes.map((r) => (
              <li key={r.id} style={{ marginBottom: 6 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openRoute(r.id)}
                >
                  {r.name} — {r.status}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          {detail ? (
            <>
              <div className="toolbar">
                <strong>{detail.name}</strong>
                <span className="badge">{detail.status}</span>
                <Link href="/torre" className="ghost-link">
                  Ver na torre
                </Link>
              </div>
              <div className="grid-2" style={{ marginBottom: "0.75rem" }}>
                <div className="field">
                  <label>Motorista</label>
                  <select
                    value={detail.driverId || ""}
                    onChange={(e) =>
                      patch("assign", { driverId: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Veículo</label>
                  <select
                    value={detail.vehicleId || ""}
                    onChange={(e) =>
                      patch("assign", { vehicleId: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} {v.label ? `— ${v.label}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <RouteMap
                stops={orderedStops.map((s) => ({
                  id: s.id,
                  lat: s.customer.lat,
                  lng: s.customer.lng,
                  sequence: stopOrder.indexOf(s.id) + 1,
                  status: s.status,
                  label: s.customer.name,
                }))}
              />
              <div style={{ marginTop: "0.75rem" }}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={stopOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderedStops.map((s) => (
                      <SortableStop
                        key={s.id}
                        id={s.id}
                        label={`${stopOrder.indexOf(s.id) + 1}. ${s.customer.name}`}
                        meta={`${s.customer.address} · ${s.status}`}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
              <div className="toolbar">
                <button type="button" className="btn btn-outline" onClick={saveOrder}>
                  Salvar ordem
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => patch("optimize")}
                >
                  Otimizar sequência
                </button>
                {detail.status === "draft" ? (
                  <button
                    type="button"
                    className="btn btn-warn"
                    onClick={() => patch("publish")}
                  >
                    Publicar
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="muted">Selecione ou crie uma rota para editar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
