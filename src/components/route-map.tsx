"use client";

import { useEffect, useRef } from "react";
import {
  Map,
  Marker,
  Popup,
  LngLatBounds,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapStop = {
  id: string;
  lat: number | null;
  lng: number | null;
  status?: string;
  label?: string;
  sequence?: number;
};

export function RouteMap({
  stops,
  className,
}: {
  stops: MapStop[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const style =
      process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
      "https://tiles.openfreemap.org/styles/liberty";
    const map = new Map({
      container: ref.current,
      style,
      center: [-46.6333, -23.5505],
      zoom: 11,
    });
    map.addControl(new NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: Marker[] = [];
    const valid = stops.filter(
      (s) => s.lat != null && s.lng != null && Number.isFinite(s.lat),
    );

    for (const s of valid) {
      const el = document.createElement("div");
      el.className = `map-pin map-pin-${s.status || "pending"}`;
      el.textContent = String(s.sequence ?? "");
      const marker = new Marker({ element: el })
        .setLngLat([s.lng!, s.lat!])
        .setPopup(
          new Popup({ offset: 12 }).setText(s.label || `#${s.sequence}`),
        )
        .addTo(map);
      markers.push(marker);
    }

    if (valid.length) {
      const bounds = new LngLatBounds();
      valid.forEach((s) => bounds.extend([s.lng!, s.lat!]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 13 });
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [stops]);

  return <div ref={ref} className={className || "route-map"} />;
}
