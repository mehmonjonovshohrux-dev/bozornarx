'use client';
import Link from 'next/link';
import { OsmMap } from '../map/OsmMap';
import { AreaChart, Donut, compactNum } from '../ui/charts';
import { ErrorBox, Spinner } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { ORDER_STATUS, ago, money } from '@/lib/fmt';
import { useApi } from '@/lib/hooks';
import { Dash, Kpi, Panel, Row, Soft } from './parts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATE: Record<string, [string, string]> = { ok: ['Ishlayapti', 'text-brand-700'], off: ['Ulanmagan', 'text-ink-muted'], down: ['Ishlamayapti', 'text-danger'] };
export function AdminDashboard() {
  const q = useApi<any>('/dashboards/admin');
  if (q.loading && !q.data) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  const d = q.data, k = d.kpi;
  const pts = [...d.stores.map((s: any) => ({ id: s.id, lat: s.lat, lng: s.lng, kind: 'store' as const, title: s.name })), ...d.markets.map((m: any) => ({ id: 'm' + m.id, lat: m.lat, lng: m.lng, kind: 'market' as const, title: m.name }))];
  return (
    <Dash>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold">Boshqaruv paneli</h1><p className="text-ink-soft">BozorNarx tizimining umumiy holati (haqiqiy ma’lumotlar)</p></div>
        <div className="flex gap-2"><Link href="/admin" className="btn btn-primary !min-h-[42px]"><Icon name="settings" size={17} />Boshqaruv markazi</Link></div></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon="user" label="Foydalanuvchilar" value={k.users} href="/admin" />
        <Kpi icon="store" label="Sotuvchilar" value={k.sellers} tone="orange" href="/admin" />
        <Kpi icon="shield" label="Moderatorlar" value={k.moderators} tone="amber" href="/admin" />
        <Kpi icon="cart" label="Buyurtmalar" value={k.orders} tone="blue" />
        <Kpi icon="doc" label="Shartnomalar" value={k.contracts} tone="violet" />
        <Kpi icon="wallet" label="Yakunlangan savdo" value={compactNum(k.paidVolume)} sub="so‘m" tone="amber" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr_1fr]">
        <Panel title="Savdo aylanmasi (30 kun)"><p className="-mt-2 mb-1 text-2xl font-extrabold">{money(d.turnover30)}</p><AreaChart points={d.turnover} height={220} unit="so‘m" /></Panel>
        <Panel title="Buyurtmalar holati"><Donut rows={d.orderStatus.map((s: any) => ({ label: ORDER_STATUS[s.status] ?? s.status, value: s.count }))} center={{ top: 'Jami', bottom: String(k.orders) }} /></Panel>
        <Panel title="Tizim holati">
          {d.system.map((s: any) => <Row key={s.key}><span className="flex-1 text-sm">{s.label}</span><b className={`text-sm ${STATE[s.state][1]}`}>{STATE[s.state][0]}</b></Row>)}
          <p className="mt-2 text-xs text-ink-muted">“Ulanmagan” — tashqi xizmat sozlanmagan; tizim uni ishlayotgandek ko‘rsatmaydi.</p>
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Hududiy xarita" action={{ href: '/map', label: 'Batafsil' }}>
          {pts.length ? <OsmMap height={300} points={pts} /> : <Soft>Koordinatali do‘kon yoki bozor hali kiritilmagan.</Soft>}
        </Panel>
        <Panel title="Hududlar bo‘yicha savdo (TOP 5)">
          {d.topRegions.length === 0 ? <Soft>Hali savdo ma’lumoti yo‘q.</Soft> : d.topRegions.map((r: any) => <div key={r.name} className="mb-3"><div className="flex justify-between text-sm"><b>{r.name}</b><span>{compactNum(r.sum)} so‘m · {r.percent}%</span></div><div className="mt-1 h-2 rounded-full bg-cream-200"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, r.percent)}%` }} /></div></div>)}
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="So‘nggi faoliyat (audit)" action={{ href: '/admin', label: 'Audit log' }}>
          {d.activity.length === 0 ? <Soft>Hali yozuv yo‘q.</Soft> : d.activity.map((a: any) => <Row key={a.id}><Icon name="history" className="text-brand-700" /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{a.action}</b><span className="text-xs text-ink-muted">{a.entity}{a.actor ? ` · ${a.actor}` : ''}</span></span><span className="text-xs text-ink-muted">{ago(a.at)}</span></Row>)}
        </Panel>
        <Panel title="Tezkor amallar">
          <div className="grid grid-cols-2 gap-3">{[['/admin', 'users', 'Foydalanuvchilar'], ['/moderation', 'shield', 'Moderatsiya'], ['/contracts', 'doc', 'Shartnomalar'], ['/disputes', 'scale', 'Nizolar']].map(([h, i, t]) => <Link key={t} href={h} className="flex items-center gap-2 rounded-2xl border border-cream-300 bg-cream-50 p-3 text-sm font-bold hover:bg-brand-50"><Icon name={i} className="text-brand-700" />{t}</Link>)}</div>
        </Panel>
      </div>
    </Dash>
  );
}
