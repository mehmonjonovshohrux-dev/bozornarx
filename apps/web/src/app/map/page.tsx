'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PageShell } from '@/components/PageShell';
import { GeoPlot } from '@/components/ui/charts';
import { ErrorBox, PageTitle, Spinner } from '@/components/ui/kit';
import { money } from '@/lib/fmt';
import { qs, usePublicApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function MapPage() {
  const [regionId, setRegionId] = useState(''); const [productId, setProductId] = useState(''); const [active, setActive] = useState<string>();
  const regions = usePublicApi<any[]>('/catalog/regions');
  const products = usePublicApi<any>('/catalog/products?pageSize=100&sort=name');
  const markets = usePublicApi<any[]>(`/catalog/markets${qs({ regionId })}`);
  const map = usePublicApi<any>(`/analytics/map${qs({ regionId, productId })}`);
  const stores: any[] = map.data?.stores ?? [];
  const shown = [...stores].sort((a, b) => (a.pricePerBase ?? Infinity) - (b.pricePerBase ?? Infinity));
  return (
    <PageShell>
      <PageTitle title="Do‘konlar va bozorlar xaritasi" sub="Mahsulot tanlasangiz, do‘konlar shu mahsulot narxi bo‘yicha tartiblanadi." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <select className="input" value={regionId} onChange={(e) => setRegionId(e.target.value)} aria-label="Hudud"><option value="">Barcha hududlar</option>{regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Mahsulot"><option value="">Mahsulot tanlanmagan</option>{products.data?.items.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <ErrorBox error={map.error} retry={map.reload} />{map.loading && !map.data && <Spinner />}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-3"><GeoPlot active={active} onPick={setActive} stores={stores.filter((s) => s.lat !== null).map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, label: s.pricePerBase ? money(s.pricePerBase) : undefined }))} />
          <p className="mt-2 text-xs text-ink-muted">Joylashuv taxminiy; xarita internetsiz ham ishlaydi. Faqat koordinatasi kiritilgan tasdiqlangan do‘konlar ko‘rsatiladi.</p></div>
        <div className="space-y-4">
          <ul className="max-h-[420px] space-y-2 overflow-y-auto">{shown.length === 0 && !map.loading && <li className="card p-4 text-ink-muted">Bu filtr bo‘yicha do‘kon topilmadi.</li>}
            {shown.map((s) => <li key={s.id}><Link href={`/stores/${s.slug}`} onMouseEnter={() => setActive(s.id)} className={`card flex items-center justify-between gap-2 p-3 ${active === s.id ? 'border-accent-500' : ''}`}><span><b>{s.name}</b><br /><span className="text-xs text-ink-muted">{s.region.name}{s.market ? ` · ${s.market.name}` : ''}</span></span>{s.pricePerBase != null && <b className="text-brand-700">{money(s.pricePerBase)}</b>}</Link></li>)}</ul>
          <div className="card p-4"><h2 className="mb-2 font-bold">Bozorlar</h2><ul className="space-y-1 text-sm">{markets.data?.map((m) => <li key={m.id}>🏬 {m.name}{m.address ? <span className="text-ink-muted"> — {m.address}</span> : ''}</li>)}{markets.data?.length === 0 && <li className="text-ink-muted">Bozorlar kiritilmagan.</li>}</ul></div>
        </div>
      </div>
    </PageShell>
  );
}
