"use client";

import dynamic from "next/dynamic";
import type { MapStop } from "./route-map";

export type { MapStop };

export const RouteMap = dynamic(
  () => import("./route-map").then((m) => m.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="map-skeleton"
        style={{
          minHeight: 280,
          borderRadius: 12,
          background: "var(--panel)",
          border: "1px solid var(--line)",
        }}
      />
    ),
  },
);
