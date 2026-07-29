"use client";

import { useEffect, useState } from "react";

const KEY = "logbitts_warehouse_id";

export type WarehouseOption = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
};

export function useWarehouseSelection() {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehouseId, setWarehouseId] = useState("");

  useEffect(() => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((rows: WarehouseOption[]) => {
        const list = Array.isArray(rows) ? rows.filter((w) => w.active !== false) : [];
        setWarehouses(list);
        const saved =
          typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
        const pick =
          (saved && list.find((w) => w.id === saved)?.id) || list[0]?.id || "";
        setWarehouseId(pick);
      });
  }, []);

  function select(id: string) {
    setWarehouseId(id);
    if (typeof window !== "undefined") localStorage.setItem(KEY, id);
  }

  const current = warehouses.find((w) => w.id === warehouseId) || null;
  return { warehouses, warehouseId, setWarehouseId: select, current };
}

export function WarehouseSwitcher({
  warehouses,
  warehouseId,
  onChange,
}: {
  warehouses: WarehouseOption[];
  warehouseId: string;
  onChange: (id: string) => void;
}) {
  if (warehouses.length <= 1) {
    return (
      <span className="muted" style={{ fontSize: "0.85rem" }}>
        {warehouses[0]?.name || "CD"}
      </span>
    );
  }
  return (
    <select
      value={warehouseId}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Centro de distribuição"
    >
      {warehouses.map((w) => (
        <option key={w.id} value={w.id}>
          {w.code ? `${w.code} — ` : ""}
          {w.name}
        </option>
      ))}
    </select>
  );
}
