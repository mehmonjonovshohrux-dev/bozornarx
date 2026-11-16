'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';

/**
 * Real OpenStreetMap map (Leaflet loaded from a CDN at runtime, so no npm dependency is required).
 * Tiles: NEXT_PUBLIC_MAP_TILES (default: the public OSM tile server — fine for pilots; for production traffic use a
 * tile provider that allows it, e.g. a self-hosted/commercial OSM-compatible provider, and set the env var).
 * No fake geography is drawn here: every marker comes from the `points` prop (backend stores/markets with lat/lng).
 */
export interface MapPoint { id: string; lat: number; lng: number; kind: 'store' | 'market'; title: string; label?: string; html?: string }
const TILES = process.env.NEXT_PUBLIC_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

let loader: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAFLET_CSS; document.head.appendChild(l); }
    const s = document.createElement('script'); s.src = LEAFLET_JS; s.async = true;
    s.onload = () => resolve((window as any).L); s.onerror = () => { loader = null; reject(new Error('leaflet')); };
    document.head.appendChild(s);
  });
  return loader;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`);
export const directionsUrl = (to: { lat: number; lng: number }, from?: { lat: number; lng: number }) =>
  `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from ? `${from.lat}%2C${from.lng}%3B` : '%3B'}${to.lat}%2C${to.lng}`;

export function OsmMap({ points, activeId, onPick, user, center = [41.07, 71.82], zoom = 11, height = 560, onError }:
  { points: MapPoint[]; activeId?: string; onPick?: (id: string) => void; user?: { lat: number; lng: number } | null; center?: [number, number]; zoom?: number; height?: number; onError?: (m: string) => void }) {
  const el = useRef<HTMLDivElement>(null); const map = useRef<any>(null); const layer = useRef<any>(null); const userMarker = useRef<any>(null);
  const [ready, setReady] = useState(false); const [err, setErr] = useState('');
  const pick = useRef(onPick); pick.current = onPick;

  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: true }).setView(center, zoom);
      const t = L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR });
      t.on('tileerror', () => { setErr('Xarita plitkalarini yuklab bo‘lmadi (tile provayder javob bermadi).'); onError?.('TILES_UNAVAILABLE'); });
      t.addTo(m); layer.current = L.layerGroup().addTo(m); map.current = m; setReady(true);
    }).catch(() => setErr('Xarita kutubxonasini yuklab bo‘lmadi. Internet aloqasini tekshiring.'));
    return () => { dead = true; if (map.current) { map.current.remove(); map.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = (window as any).L; if (!ready || !L || !layer.current) return;
    layer.current.clearLayers();
    const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    for (const p of pts) {
      const on = p.id === activeId; const bg = p.kind === 'market' ? '#ea580c' : '#047857';
      const icon = L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center"><div style="background:${bg};color:#fff;border:2px solid #fff;border-radius:999px;padding:4px 10px;font:700 12px Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 8px 18px -6px rgba(0,0,0,.5);${on ? 'outline:3px solid #fb923c;' : ''}">${(p.label ?? p.title).replace(/</g, '&lt;')}</div><div style="width:2px;height:9px;background:${bg}"></div></div>` });
      const mk = L.marker([p.lat, p.lng], { icon, zIndexOffset: on ? 1000 : 0 }).addTo(layer.current);
      if (p.html) mk.bindPopup(p.html, { maxWidth: 280 });
      mk.on('click', () => pick.current?.(p.id));
    }
    if (pts.length && !activeId) { const b = L.latLngBounds(pts.map((p) => [p.lat, p.lng])); if (b.isValid()) map.current.fitBounds(b.pad(0.2), { maxZoom: 14 }); }
  }, [points, ready, activeId]);

  useEffect(() => {
    const L = (window as any).L; if (!ready || !L || !map.current) return;
    if (userMarker.current) { userMarker.current.remove(); userMarker.current = null; }
    if (user) userMarker.current = L.circleMarker([user.lat, user.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map.current).bindTooltip('Siz shu yerdasiz');
  }, [user, ready]);

  useEffect(() => {
    const a = points.find((p) => p.id === activeId); if (a && map.current) map.current.flyTo([a.lat, a.lng], Math.max(map.current.getZoom(), 14), { duration: 0.6 });
  }, [activeId, points]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cream-300" style={{ height }}>
      <div ref={el} className="h-full w-full" role="application" aria-label="Xarita (OpenStreetMap)" />
      {!ready && !err && <div className="absolute inset-0 grid place-items-center bg-cream-100 text-sm text-ink-muted">Xarita yuklanmoqda…</div>}
      {err && <div className="absolute inset-x-3 top-3 z-[1000] rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>}
    </div>
  );
}
