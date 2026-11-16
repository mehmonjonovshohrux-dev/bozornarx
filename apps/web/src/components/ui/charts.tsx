'use client';
// Dependency-free SVG charts (works offline, accessible via <title>/aria-label).
export interface Pt { x: string; y: number }

export function LineChart({ points, projection = [], height = 180, label, unit }: { points: Pt[]; projection?: Pt[]; height?: number; label: string; unit?: string }) {
  const all = [...points, ...projection];
  if (points.length === 0) return <p className="py-8 text-center text-ink-muted">Bu davr uchun narx tarixi yo‘q.</p>;
  const W = 640, H = height, P = { l: 52, r: 12, t: 12, b: 26 };
  const ys = all.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min *= 0.95; max *= 1.05; if (min === max) { min = 0; max = 1; } }
  const sx = (i: number) => P.l + (all.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (all.length - 1));
  const sy = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const path = (pts: Pt[], off: number) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i + off).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const ticks = [min, (min + max) / 2, max];
  const f = (v: number) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(v).replace(/,/g, ' ');
  const pick = (i: number) => (all.length <= 6 || i % Math.ceil(all.length / 6) === 0 || i === all.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      <title>{label}</title>
      {ticks.map((t) => (<g key={t}><line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} stroke="#e7e0cf" /><text x={P.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{f(t)}</text></g>))}
      {all.map((p, i) => pick(i) && <text key={p.x + i} x={sx(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#6b7280">{p.x.slice(5)}</text>)}
      <path d={path(points, 0)} fill="none" stroke="#047857" strokeWidth="2.5" strokeLinejoin="round" />
      {projection.length > 0 && <path d={`M${sx(points.length - 1)},${sy(points[points.length - 1].y)} ${path(projection, points.length).replace(/^M/, 'L')}`} fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="5 4" />}
      {points.map((p, i) => <circle key={p.x} cx={sx(i)} cy={sy(p.y)} r="3" fill="#047857"><title>{`${p.x}: ${f(p.y)}${unit ? ' ' + unit : ''}`}</title></circle>)}
    </svg>
  );
}

export function BarList({ rows, unit }: { rows: Array<{ label: string; value: number | null; sub?: string }>; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  const f = (v: number) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(v).replace(/,/g, ' ');
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-ink">{r.label}</span><span className="text-ink-soft">{r.value === null ? '—' : `${f(r.value)} ${unit ?? ''}`}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-brand-500" style={{ width: `${((r.value ?? 0) / max) * 100}%` }} /></div>
          {r.sub && <div className="mt-0.5 text-xs text-ink-muted">{r.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

/** Uzbekistan outline-free scatter map: stores placed by lat/lng inside the country's bounding box. No tiles, so it works offline. */
export function GeoPlot({ stores, onPick, active }: { stores: Array<{ id: string; name: string; lat: number; lng: number; label?: string }>; onPick?: (id: string) => void; active?: string }) {
  const lat0 = 37.1, lat1 = 45.6, lng0 = 55.9, lng1 = 73.2, W = 640, H = 360;
  const x = (lng: number) => ((lng - lng0) / (lng1 - lng0)) * W;
  const y = (lat: number) => (1 - (lat - lat0) / (lat1 - lat0)) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Do‘konlar xaritasi (taxminiy joylashuv)" className="h-auto w-full rounded-xl bg-brand-50">
      {[0.25, 0.5, 0.75].map((g) => <g key={g}><line x1={W * g} x2={W * g} y1="0" y2={H} stroke="#d1fae5" /><line y1={H * g} y2={H * g} x1="0" x2={W} stroke="#d1fae5" /></g>)}
      {stores.map((s) => (
        <g key={s.id} onClick={() => onPick?.(s.id)} className="cursor-pointer" tabIndex={0} role="button" aria-label={s.name} onKeyDown={(e) => e.key === 'Enter' && onPick?.(s.id)}>
          <circle cx={x(s.lng)} cy={y(s.lat)} r={active === s.id ? 9 : 6} fill={active === s.id ? '#f97316' : '#059669'} stroke="#fff" strokeWidth="2"><title>{s.name}{s.label ? ` — ${s.label}` : ''}</title></circle>
        </g>
      ))}
    </svg>
  );
}
