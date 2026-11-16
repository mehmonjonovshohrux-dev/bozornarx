'use client';
import Link from 'next/link';
import { OsmMap } from '../map/OsmMap';
import { AreaChart, Donut, compactNum } from '../ui/charts';
import { Badge, ErrorBox, ProductImage, Spinner, statusTone } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { ORDER_STATUS, STORE_STATUS, ago, money } from '@/lib/fmt';
import { useApi } from '@/lib/hooks';
import { Dash, Kpi, Panel, Row, Soft } from './parts';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function SellerDashboard() {
  const q = useApi<any>('/dashboards/seller');
  if (q.loading && !q.data) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  const d = q.data;
  if (!d.store) return (
    <Panel title="Sotuvchi kabineti"><p className="text-ink-soft">Savdoni boshlash uchun do‘kon oching. Do‘kon moderator tekshiruvidan so‘ng ommaga ko‘rinadi.</p><Link href="/seller" className="btn btn-primary mt-4">Do‘kon ochish</Link></Panel>
  );
  const s = d.store, k = d.kpi;
  return (
    <Dash>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 p-5 text-white shadow-card">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15"><Icon name="store" size={30} /></span>
          <div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-extrabold">{s.name}</h1><p className="text-sm text-emerald-50/90">{s.region}{s.market ? ` · ${s.market}` : ''}</p></div>
          <Badge tone={s.status === 'VERIFIED' ? 'ok' : 'warn'}>{STORE_STATUS[s.status] ?? s.status}</Badge>
        </div>
        <Panel className="!p-4">
          <Row><Icon name="star" className="text-amber-500" /><span className="flex-1 text-sm">Reyting</span><b>{k.rating ?? '—'}{k.reviews ? <span className="font-normal text-ink-muted"> ({k.reviews})</span> : null}</b></Row>
          <Row><Icon name="shield" className="text-brand-700" /><span className="flex-1 text-sm">Ishonch belgisi</span><b className="text-sm">{s.status === 'VERIFIED' ? 'Tasdiqlangan' : 'Kutilmoqda'}</b></Row>
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon="wallet" label="Bugungi savdo" value={money(k.todaySales)} href="/seller/orders" />
        <Kpi icon="package" label="Bugungi buyurtmalar" value={`${k.todayOrders} ta`} sub={k.newOrders ? `${k.newOrders} ta yangi` : undefined} tone="orange" href="/seller/orders" />
        <Kpi icon="box" label="Faol narxlar" value={`${k.activePrices} ta`} tone="red" href="/seller/prices" />
        <Kpi icon="users" label="Mijozlar" value={`${k.customers} nafar`} tone="violet" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr_1fr]">
        <Panel title="Sotuvlar dinamikasi (30 kun)"><p className="-mt-2 mb-1 text-sm text-ink-muted">Jami: <b className="text-ink">{money(d.total30)}</b></p><AreaChart points={d.sales} unit="so‘m" height={210} /></Panel>
        <Panel title="Kategoriyalar bo‘yicha sotuv">
          <Donut rows={d.byCategory.map((c: any) => ({ label: c.name, value: c.sum }))} center={{ top: 'Jami', bottom: compactNum(d.total30) }} />
        </Panel>
        <Panel title="Do‘kon joylashuvi" action={{ href: '/map', label: 'Xaritada' }}>
          {s.lat != null && s.lng != null ? <OsmMap height={220} center={[s.lat, s.lng]} zoom={14} points={[{ id: s.id, lat: s.lat, lng: s.lng, kind: 'store', title: s.name }]} /> : <Soft>Do‘kon koordinatasi kiritilmagan. Do‘kon profilida joylashuvni belgilang.</Soft>}
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="So‘nggi buyurtmalar" action={{ href: '/seller/orders', label: 'Barchasi' }}>
          {d.recentOrders.length === 0 ? <Soft>Hali buyurtma kelmagan.</Soft> : d.recentOrders.map((o: any) => <Row key={o.id} href={`/seller/orders`}><span className="w-24 truncate text-sm font-bold">{o.number}</span><span className="min-w-0 flex-1 truncate text-sm">{o.buyer} · {o.items} ta mahsulot</span><b className="hidden text-sm sm:block">{money(o.total)}</b><Badge tone={statusTone(o.status)}>{ORDER_STATUS[o.status] ?? o.status}</Badge><span className="hidden text-xs text-ink-muted md:block">{ago(o.at)}</span></Row>)}
        </Panel>
        <Panel title="Eng ko‘p sotilgan mahsulotlar" action={{ href: '/seller/products', label: 'Barchasi' }}>
          {d.topProducts.length === 0 ? <Soft>Sotuv bo‘lgach shu yerda ko‘rinadi.</Soft> : d.topProducts.map((p: any) => <Row key={p.slug}><ProductImage id={null} alt={p.name} name={p.name} className="h-12 w-12 rounded-xl" /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{p.name}</b><span className="text-xs text-ink-muted">{Math.round(p.qty * 10) / 10} {p.unit}</span></span><b className="text-sm">{money(p.sum)}</b></Row>)}
        </Panel>
      </div>
      <Panel title="Tezkor amallar">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[['/seller/products', 'plus', 'Mahsulot qo‘shish'], ['/seller/prices', 'tag', 'Narxlarni yangilash'], ['/seller/discounts', 'percent', 'Aksiya yaratish'], ['/seller/orders', 'package', 'Buyurtmalar']].map(([h, i, t]) => <Link key={h} href={h} className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 p-4 font-bold hover:bg-brand-50"><Icon name={i} className="text-brand-700" />{t}</Link>)}
        </div>
      </Panel>
    </Dash>
  );
}
