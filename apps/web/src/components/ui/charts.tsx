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

/* ───────── Dashboard charts (pure SVG, no dependency) ───────── */
const compact = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} mlrd` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} mln` : n >= 1e3 ? `${Math.round(n / 1e3)} ming` : String(Math.round(n)));
export { compact as compactNum };

/** Smooth area chart. Pass one or two series (the 2nd is drawn as a dashed orange line). */
export function AreaChart({ points, second, height = 200, color = '#10b981', unit = '', labelEvery = 5 }: { points: Pt[]; second?: Pt[]; height?: number; color?: string; unit?: string; labelEvery?: number }) {
  const W = 640, H = height, P = { l: 46, r: 12, t: 14, b: 26 };
  const all = [...points, ...(second ?? [])]; const max = Math.max(1, ...all.map((p) => p.y));
  const n = Math.max(1, points.length - 1);
  const sx = (i: number) => P.l + (i / n) * (W - P.l - P.r); const sy = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const gid = `ag${color.replace('#', '')}${height}`;
  const ticks = [0, 0.5, 1].map((t) => max * t);
  if (points.length === 0 || max <= 1 && points.every((p) => p.y === 0)) return <div className="grid place-items-center text-sm text-ink-muted" style={{ height }}>Hali ma’lumot yo‘q</div>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} stroke="#e7e0cf" strokeDasharray="3 4" /><text x={P.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{compact(t)}</text></g>)}
      {points.map((p, i) => i % labelEvery === 0 && <text key={p.x} x={sx(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#6b7280">{p.x.slice(5).replace('-', '.')}</text>)}
      <path d={`${path(points)} L${sx(points.length - 1)},${H - P.b} L${sx(0)},${H - P.b}Z`} fill={`url(#${gid})`} />
      <path d={path(points)} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {second && <path d={path(second)} fill="none" stroke="#f97316" strokeWidth="2.2" strokeDasharray="5 4" strokeLinecap="round" />}
      {points.map((p, i) => <circle key={p.x} cx={sx(i)} cy={sy(p.y)} r="7" fill="transparent"><title>{`${p.x}: ${compact(p.y)}${unit ? ' ' + unit : ''}`}</title></circle>)}
    </svg>
  );
}

export function BarsChart({ points, height = 150, color = '#10b981' }: { points: Pt[]; height?: number; color?: string }) {
  const max = Math.max(1, ...points.map((p) => p.y)); const empty = points.every((p) => p.y === 0);
  if (empty) return <div className="grid place-items-center text-sm text-ink-muted" style={{ height }}>Hali ma’lumot yo‘q</div>;
  return (
    <div className="flex items-end gap-[3px]" style={{ height }} role="img" aria-label="Ustunli grafik">
      {points.map((p) => <div key={p.x} className="flex-1 rounded-t-md" title={`${p.x}: ${compact(p.y)}`} style={{ height: `${Math.max(3, (p.y / max) * 100)}%`, background: `linear-gradient(180deg,${color},${color}99)` }} />)}
    </div>
  );
}

export const DONUT_COLORS = ['#16a34a', '#f97316', '#eab308', '#ef4444', '#6366f1', '#0ea5e9'];
export function Donut({ rows, center, size = 150 }: { rows: Array<{ label: string; value: number }>; center?: { top: string; bottom: string }; size?: number }) {
  const total = rows.reduce((a, r) => a + r.value, 0); const R = 52, C = 2 * Math.PI * R; let off = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Diagramma" className="shrink-0">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f3ecda" strokeWidth="18" />
        {total > 0 && rows.map((r, i) => { const len = (r.value / total) * C; const el = <circle key={r.label} cx="70" cy="70" r={R} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />; off += len; return el; })}
        {center && <><text x="70" y="66" textAnchor="middle" fontSize="12" fill="#6b7280">{center.top}</text><text x="70" y="86" textAnchor="middle" fontSize="19" fontWeight="800" fill="#1f2937">{center.bottom}</text></>}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {rows.map((r, i) => <li key={r.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} /><span className="min-w-0 flex-1 truncate">{r.label}</span><b>{total ? Math.round((r.value / total) * 100) : 0}%</b></li>)}
        {rows.length === 0 && <li className="text-ink-muted">Hali ma’lumot yo‘q</li>}
      </ul>
    </div>
  );
}
