'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { haversineKm, fmtKm, directionsUrl } from '../map/OsmMap';
import { AreaChart } from '../ui/charts';
import { Badge, ErrorBox, ProductImage, Spinner, statusTone } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { useAuth } from '@/lib/auth-context';
import { CONTRACT_STATUS, ORDER_STATUS, ago, money } from '@/lib/fmt';
import { qs, useApi, usePublicApi } from '@/lib/hooks';
import { Dash, Hero, Kpi, Panel, Row, Soft } from './parts';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function BuyerDashboard() {
  const { user } = useAuth();
  const q = useApi<any>('/dashboards/buyer');
  const [cat, setCat] = useState('');
  if (q.loading && !q.data) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  const d = q.data; const first = (user?.profile?.fullName ?? '').split(' ')[0];
  const cats: Array<[string, string]> = [...new Map<string, string>(d.deals.map((x: any) => [x.category, x.categoryName] as [string, string])).entries()];
  const deals = d.deals.filter((x: any) => !cat || x.category === cat);
  return (
    <Dash>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Hero title={`Xush kelibsiz${first ? `, ${first}` : ''}!`} text="Bugungi eng qulay narxlar va ishonchli sotuvchilar bir joyda — BozorNarx’da." cta={{ href: '/catalog', label: 'Mahsulotlarni ko‘rish' }} art={['sabzi', 'pomidor', 'kartoshka']} />
        <Panel title="Mening faoliyatim">
          <Row href="/orders"><Icon name="package" className="text-brand-700" /><span className="flex-1 text-sm">Faol buyurtmalar</span><b>{d.activity.active}</b></Row>
          <Row href="/orders"><Icon name="truck" className="text-accent-600" /><span className="flex-1 text-sm">Kutilayotgan yetkazib berish</span><b>{d.activity.awaitingDelivery}</b></Row>
          <Row href="/contracts"><Icon name="doc" className="text-sky-700" /><span className="flex-1 text-sm">Imzolangan shartnomalar</span><b>{d.activity.signedContracts}</b></Row>
          <Row href="/favorites"><Icon name="heart" className="text-danger" /><span className="flex-1 text-sm">Sevimli mahsulotlar</span><b>{d.activity.favorites}</b></Row>
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon="tag" label="Faol narxlar" value={`${d.kpi.livePrices} ta`} href="/catalog" />
        <Kpi icon="bell" label="Narx ogohlantirishlari" value={`${d.kpi.alerts} ta`} tone="green" href="/alerts" />
        <Kpi icon="package" label="Jami buyurtmalar" value={`${d.kpi.totalOrders} ta`} tone="red" href="/orders" />
        <Kpi icon="wallet" label="Sarflangan summa" value={money(d.kpi.spent)} tone="orange" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Ommabop mahsulotlar" action={{ href: '/catalog', label: 'Barchasi' }}>
          <div className="mb-3 flex flex-wrap gap-2">
            <button onClick={() => setCat('')} className={`rounded-full px-4 py-1.5 text-sm font-bold ${!cat ? 'bg-brand-700 text-white' : 'border border-cream-300 bg-white text-ink-soft'}`}>Barchasi</button>
            {cats.map(([slug, name]) => <button key={slug} onClick={() => setCat(slug)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${cat === slug ? 'bg-brand-700 text-white' : 'border border-cream-300 bg-white text-ink-soft'}`}>{name}</button>)}
          </div>
          {deals.length === 0 ? <Soft>Hozircha tasdiqlangan narxlar yo‘q. Sotuvchilar narx kiritgach, shu yerda ko‘rinadi.</Soft> :
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {deals.slice(0, 8).map((p: any) => (
                <li key={p.productId}><Link href={`/catalog/${p.slug}`} className="block overflow-hidden rounded-2xl border border-cream-300 bg-white transition hover:-translate-y-0.5 hover:shadow-card">
                  <ProductImage id={null} alt={p.name} name={p.name} category={p.categoryName} className="h-28 w-full" />
                  <div className="p-3"><b className="block truncate">{p.name}</b><span className="text-lg font-extrabold text-brand-800">{money(p.price)}</span><span className="text-xs text-ink-muted"> /{p.unit}</span><span className="mt-0.5 block truncate text-xs text-ink-muted">{p.store} · {p.region}</span></div>
                </Link></li>))}
            </ul>}
        </Panel>
        <div className="space-y-5">
          <Dynamics productId={d.deals[0]?.productId} name={d.deals[0]?.name} />
          <Nearest />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Buyurtmalarim" action={{ href: '/orders', label: 'Barchasi' }}>
          {d.recentOrders.length === 0 ? <Soft>Hali buyurtma yo‘q.</Soft> : d.recentOrders.map((o: any) => <Row key={o.id} href={`/orders/${o.id}`}><span className="min-w-0 flex-1"><b className="block truncate text-sm">{o.number}</b><span className="text-xs text-ink-muted">{o.store} · {money(o.total)}</span></span><Badge tone={statusTone(o.status)}>{ORDER_STATUS[o.status] ?? o.status}</Badge></Row>)}
        </Panel>
        <Panel title="Yetkazib berish" action={{ href: '/orders', label: 'Kuzatish' }}>
          {!d.delivery ? <Soft>Hozir yo‘ldagi buyurtma yo‘q.</Soft> : <div>
            <b className="text-sm">{d.delivery.number}</b> <span className="text-xs text-ink-muted">· {d.delivery.store}</span>
            <ol className="mt-3 space-y-2">{d.delivery.steps.map((s: any, i: number) => <li key={i} className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /><span className="flex-1">{ORDER_STATUS[s.status] ?? s.status}</span><span className="text-xs text-ink-muted">{ago(s.at)}</span></li>)}</ol>
            {d.delivery.address && <p className="mt-2 text-xs text-ink-muted">Manzil: {d.delivery.address}</p>}</div>}
        </Panel>
        <Panel title="Shartnomalar" action={{ href: '/contracts', label: 'Barchasi' }}>
          {d.contracts.length === 0 ? <Soft>Hali shartnoma yo‘q.</Soft> : d.contracts.map((c: any) => <Row key={c.id} href={`/contracts/${c.id}`}><span className="min-w-0 flex-1"><b className="block truncate text-sm">{c.number}</b><span className="text-xs text-ink-muted">{c.goods ?? 'Shartnoma'}</span></span><Badge tone={statusTone(c.status)}>{CONTRACT_STATUS[c.status] ?? c.status}</Badge></Row>)}
        </Panel>
        <Panel title="To‘lov va chat">
          <Row><Icon name="wallet" className="text-brand-700" /><span className="flex-1 text-sm">Yetkazilganda naqd</span><Badge tone="ok">Ishlaydi</Badge></Row>
          <Row><Icon name="credit" className="text-ink-muted" /><span className="flex-1 text-sm">Bank kartasi</span><Badge tone="muted">Ulanmagan</Badge></Row>
          <Link href="/chat" className="btn btn-primary mt-3 w-full"><Icon name="chat" size={18} />Sotuvchi bilan chat</Link>
        </Panel>
      </div>
    </Dash>
  );
}

function Dynamics({ productId, name }: { productId?: string; name?: string }) {
  const h = usePublicApi<any>(productId ? `/catalog/products/${productId}/history${qs({ days: 30 })}` : null);
  const pts = (h.data?.series ?? []).map((b: any) => ({ x: b.date, y: b.avg }));
  return (
    <Panel title={<>Narx dinamikasi{name ? <span className="font-semibold text-ink-soft"> · {name}</span> : null}</>}>
      {!productId ? <Soft>Narx ma’lumoti paydo bo‘lgach grafik shu yerda chiqadi.</Soft> : h.loading ? <Spinner /> : <AreaChart points={pts} height={170} unit={`so‘m/${h.data?.baseUnit ?? ''}`} labelEvery={7} />}
    </Panel>
  );
}

/** Nearest sellers: distance is computed only after the user allows location. Nothing is guessed. */
function Nearest() {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null); const [msg, setMsg] = useState('');
  const map = usePublicApi<any>('/analytics/map');
  const rows = useMemo(() => ((map.data?.stores ?? []) as any[]).filter((s) => s.lat != null).map((s) => ({ ...s, km: me ? haversineKm(me, s) : null })).sort((a, b) => (me ? a.km - b.km : (a.pricePerBase ?? Infinity) - (b.pricePerBase ?? Infinity))).slice(0, 3), [map.data, me]);
  const locate = () => { setMsg('Aniqlanmoqda…'); navigator.geolocation?.getCurrentPosition((p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setMsg(''); }, () => setMsg('Joylashuvga ruxsat berilmadi — masofa hisoblanmaydi.'), { timeout: 10000 }); };
  return (
    <Panel title="Eng yaqin sotuvchilar" action={{ href: '/map', label: 'Xaritada' }}>
      {!me && <button className="btn btn-ghost mb-2 w-full !min-h-[40px]" onClick={locate}><Icon name="pin" size={17} />Menga yaqinlarini ko‘rsat</button>}
      {msg && <p className="mb-2 text-xs text-ink-muted">{msg}</p>}
      {rows.length === 0 ? <Soft>Koordinatasi kiritilgan do‘konlar hali yo‘q.</Soft> : rows.map((s: any) => (
        <Row key={s.id}><span className="min-w-0 flex-1"><Link href={`/stores/${s.slug}`} className="block truncate text-sm font-bold">{s.name}</Link><span className="text-xs text-ink-muted">{s.region.name}{s.km != null ? ` · ${fmtKm(s.km)}` : ''}</span></span>{s.pricePerBase != null && <b className="text-sm text-brand-800">{money(s.pricePerBase)}</b>}<a className="text-xs font-bold text-brand-700 underline" target="_blank" rel="noopener noreferrer" href={directionsUrl(s, me ?? undefined)}>Yo‘nalish</a></Row>))}
    </Panel>
  );
}
