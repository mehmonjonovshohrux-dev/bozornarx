'use client';
import Link from 'next/link';
import { OsmMap } from '../map/OsmMap';
import { AreaChart, Donut } from '../ui/charts';
import { Badge, ErrorBox, Spinner } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { DISPUTE_STATUS, MOD_STATUS, ago, money } from '@/lib/fmt';
import { useApi } from '@/lib/hooks';
import { Dash, Kpi, Panel, Row, Soft } from './parts';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ModeratorDashboard() {
  const q = useApi<any>('/dashboards/moderator');
  if (q.loading && !q.data) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  const d = q.data, k = d.kpi;
  const pts = d.queue.filter((x: any) => x.lat != null && x.lng != null);
  return (
    <Dash>
      <div><h1 className="text-2xl font-extrabold">Moderator dashboardi</h1><p className="text-ink-soft">Platformadagi narxlar, do‘konlar va shikoyatlar holati</p></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon="list" label="Tekshiruv navbatida" value={k.queue} tone="orange" href="/moderation" />
        <Kpi icon="check" label="Tasdiqlangan (7 kun)" value={k.approved7d} />
        <Kpi icon="alert" label="Rad etilgan (7 kun)" value={k.rejected7d} tone="red" />
        <Kpi icon="store" label="Tekshirilayotgan do‘kon" value={k.stores} tone="blue" href="/moderation" />
        <Kpi icon="flag" label="Ochiq shikoyatlar" value={k.complaints} tone="red" href="/moderation" />
        <Kpi icon="scale" label="Ochiq nizolar" value={k.disputes} tone="violet" href="/disputes" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Panel title="Tekshiruvlar statistikasi (7 kun)">
          <AreaChart points={d.approvedSeries} second={d.rejectedSeries} height={200} labelEvery={1} />
          <p className="mt-1 text-xs text-ink-muted"><span className="font-bold text-brand-600">—</span> tasdiqlangan · <span className="font-bold text-accent-500">- -</span> rad etilgan</p>
        </Panel>
        <Panel title="Narxlar holati"><Donut rows={d.priceStatus.map((p: any) => ({ label: MOD_STATUS[p.status] ?? p.status, value: p.count }))} /></Panel>
        <Panel title="Tezkor amallar">
          {[['/moderation', 'list', 'Tekshiruv navbatini ochish'], ['/moderation', 'store', 'Do‘konlarni tekshirish'], ['/moderation', 'flag', 'Shikoyatlarni ko‘rib chiqish'], ['/map', 'map', 'Xaritada ko‘rish']].map(([h, i, t]) => <Link key={t} href={h} className="mb-2 flex items-center gap-3 rounded-xl border border-cream-300 bg-brand-50/60 px-3 py-3 text-sm font-bold hover:bg-brand-50"><Icon name={i} className="text-brand-700" /><span className="flex-1">{t}</span><Icon name="right" size={16} /></Link>)}
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Tekshiruv navbati" action={{ href: '/moderation', label: 'Barchasini ko‘rish' }}>
          {d.queue.length === 0 ? <Soft>Tekshiruvni kutayotgan narx yo‘q.</Soft> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-ink-muted"><tr><th className="py-2">Mahsulot</th><th>Sotuvchi</th><th>Narx</th><th>Holat</th><th>Vaqt</th></tr></thead>
              <tbody>{d.queue.map((r: any) => <tr key={r.id} className="border-t border-cream-200"><td className="py-2.5 font-bold">{r.product}</td><td>{r.store}<span className="block text-xs text-ink-muted">{r.region}</span></td><td>{money(r.price)}/{r.unit}</td><td><Badge tone="warn">Tekshiruvda</Badge></td><td className="text-xs text-ink-muted">{ago(r.at)}</td></tr>)}</tbody></table></div>)}
        </Panel>
        <Panel title="Navbatdagi do‘konlar xaritada" action={{ href: '/map', label: 'To‘liq xarita' }}>
          {pts.length ? <OsmMap height={260} points={pts.map((p: any) => ({ id: p.id, lat: p.lat, lng: p.lng, kind: 'store' as const, title: p.store, label: p.product }))} /> : <Soft>Koordinatali do‘konlar bo‘yicha navbat yo‘q.</Soft>}
        </Panel>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Panel title="So‘nggi shikoyatlar" action={{ href: '/moderation', label: 'Barchasi' }}>{d.complaints.length === 0 ? <Soft>Ochiq shikoyat yo‘q.</Soft> : d.complaints.map((c: any) => <Row key={c.id}><span className="min-w-0 flex-1"><b className="block truncate text-sm">{c.reason}</b><span className="text-xs text-ink-muted">{c.targetType} · {ago(c.createdAt)}</span></span><Badge tone="bad">Yangi</Badge></Row>)}</Panel>
        <Panel title="Ochiq nizolar" action={{ href: '/disputes', label: 'Barchasi' }}>{d.disputes.length === 0 ? <Soft>Ochiq nizo yo‘q.</Soft> : d.disputes.map((x: any) => <Row key={x.id} href={`/disputes/${x.id}`}><span className="min-w-0 flex-1"><b className="block truncate text-sm">Buyurtma {x.order ?? '—'}</b><span className="text-xs text-ink-muted">{ago(x.at)}</span></span><Badge tone="warn">{DISPUTE_STATUS[x.status] ?? x.status}</Badge></Row>)}</Panel>
        <Panel title="So‘nggi qarorlar">{d.decisions.length === 0 ? <Soft>Hali qaror yo‘q.</Soft> : d.decisions.map((x: any) => <Row key={x.id}><span className="min-w-0 flex-1"><b className="block truncate text-sm">{x.action} · {x.targetType}</b><span className="truncate text-xs text-ink-muted">{x.reason}</span></span><span className="text-xs text-ink-muted">{ago(x.createdAt)}</span></Row>)}</Panel>
      </div>
    </Dash>
  );
}
