"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Incident } from "@/lib/types";

const COLOR = { critical: "#C9302C", high: "#D9772B", medium: "#B8962E", low: "#5B6B70" } as const;
const where = (i: Incident) => i.location ?? i.location_at_sync;

export default function MapView({ incidents, selectedId, onSelect }: { incidents: Incident[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const latest = useRef(incidents);
  latest.current = incidents;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current).setView([22.5, 79], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 0);
    return () => { m.remove(); map.current = null; fitted.current = false; };
  }, []);

  useEffect(() => {
    const g = layer.current, m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [];
    for (const i of incidents) {
      const l = where(i); if (!l) continue;
      pts.push([l.lat, l.lng]);
      const done = i.status === "resolved";
      const cls = `pin${i.priority === "critical" && !done ? " pin-pulse" : ""}${i.id === selectedId ? " pin-sel" : ""}`;
      const icon = L.divIcon({ className: "", html: `<span class="${cls}" style="background:${COLOR[i.priority]};opacity:${done ? 0.35 : 1}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker([l.lat, l.lng], { icon, keyboard: false, title: `${i.priority}: ${i.message.slice(0, 60)}` }).on("click", () => onSelect(i.id)).addTo(g);
    }
    if (!fitted.current && pts.length) { m.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 13 }); fitted.current = true; }
  }, [incidents, selectedId, onSelect]);

  useEffect(() => {
    const i = latest.current.find((x) => x.id === selectedId); const l = i && where(i);
    if (l && map.current) map.current.flyTo([l.lat, l.lng], Math.max(map.current.getZoom(), 13), { duration: 0.6 });
  }, [selectedId]);

  return <div ref={el} className="h-72 w-full rounded-lg" role="img" aria-label="Map of incidents" />;
}
