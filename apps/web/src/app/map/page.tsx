'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/PageShell';
import { OsmMap, directionsUrl, fmtKm, haversineKm, type MapPoint } from '@/components/map/OsmMap';
import { ErrorBox, PageTitle, Spinner } from '@/components/ui/kit';
import { money } from '@/lib/fmt';
import { qs, usePublicApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
type LL = { lat: number; lng: number };
export default function MapPage() {
  const [regionId, setRegionId] = useState(''); const [productId, setProductId] = useState(''); const [active, setActive] = useState<string>();
  const [user, setUser] = useState<LL | null>(null); const [geoMsg, setGeoMsg] = useState(''); const [sortBy, setSortBy] = useState<'dist' | 'price'>('price');
  const [q, setQ] = useState(''); const [place, setPlace] = useState<{ center: [number, number]; name: string } | null>(null); const [searching, setSearching] = useState(false);
  const regions = usePublicApi<any[]>('/catalog/regions');
  const products = usePublicApi<any>('/catalog/products?pageSize=100&sort=name');
  const markets = usePublicApi<any[]>(`/catalog/markets${qs({ regionId })}`);
  const map = usePublicApi<any>(`/analytics/map${qs({ regionId, productId })}`);
  const stores: any[] = (map.data?.stores ?? []).filter((s: any) => s.lat != null && s.lng != null);

  const rows = useMemo(() => {
    const r = stores.map((s) => ({ ...s, km: user ? haversineKm(user, s) : null as number | null }));
    r.sort((a, b) => (sortBy === 'dist' && user ? (a.km ?? 0) - (b.km ?? 0) : (a.pricePerBase ?? Infinity) - (b.pricePerBase ?? Infinity)));
    return r;
  }, [stores, user, sortBy]);
  const points: MapPoint[] = useMemo(() => [
    ...rows.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, kind: 'store' as const, title: s.name, label: s.pricePerBase ? money(s.pricePerBase) : s.name,
      html: `<b>${esc(s.name)}</b><br>${esc(s.region.name)}${s.market ? ' · ' + esc(s.market.name) : ''}${s.pricePerBase ? `<br><b>${money(s.pricePerBase)}</b>` : ''}<br><a href="/stores/${esc(s.slug)}">Do‘konni ochish</a> · <a target="_blank" rel="noopener" href="${directionsUrl(s, user ?? undefined)}">Yo‘nalish</a>` })),
    ...(markets.data ?? []).filter((m: any) => m.lat != null && m.lng != null).map((m: any) => ({ id: 'm' + m.id, lat: m.lat, lng: m.lng, kind: 'market' as const, title: m.name, html: `<b>${esc(m.name)}</b>${m.address ? '<br>' + esc(m.address) : ''}` })),
  ], [rows, markets.data, user]);

  const locate = () => {
    if (!navigator.geolocation) { setGeoMsg('Brauzer joylashuvni qo‘llamaydi.'); return; }
    setGeoMsg('Joylashuv aniqlanmoqda…');
    navigator.geolocation.getCurrentPosition((p) => { setUser({ lat: p.coords.latitude, lng: p.coords.longitude }); setSortBy('dist'); setGeoMsg(''); },
      () => setGeoMsg('Joylashuvga ruxsat berilmadi. Hududni qo‘lda tanlang yoki manzil qidiring; masofa hisoblanmaydi.'), { timeout: 10000, maximumAge: 60000 });
  };
  // Nominatim (OSM geocoder). Public instance: low volume only, user-initiated, with attribution.
  const search = async (e: React.FormEvent) => {
    e.preventDefault(); if (q.trim().length < 2) return; setSearching(true); setGeoMsg('');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=uz&accept-language=uz&q=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      if (j[0]) setPlace({ center: [Number(j[0].lat), Number(j[0].lon)], name: j[0].display_name }); else setGeoMsg('Bunday joy topilmadi.');
    } catch { setGeoMsg('Manzil qidiruvi hozir ishlamayapti.'); } finally { setSearching(false); }
  };

  return (
    <PageShell>
      <PageTitle title="Do‘konlar va bozorlar xaritasi" sub="Pilot hudud: Namangan viloyati va Chortoq; keyin butun O‘zbekiston. Faqat koordinatasi kiritilgan tasdiqlangan do‘konlar ko‘rsatiladi." />
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto]">
        <select className="input" value={regionId} onChange={(e) => setRegionId(e.target.value)} aria-label="Hudud"><option value="">Barcha hududlar</option>{regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Mahsulot"><option value="">Mahsulot tanlanmagan</option>{products.data?.items.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <form onSubmit={search} className="flex gap-2"><input className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Manzil qidirish (masalan, Chortoq)" aria-label="Manzil qidirish" /><button className="btn btn-primary" disabled={searching}>{searching ? '…' : 'Qidirish'}</button></form>
        <button className="btn btn-ghost" onClick={locate}>Menga yaqin</button>
      </div>
      {geoMsg && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">{geoMsg}</p>}
      <ErrorBox error={map.error} retry={map.reload} />{map.loading && !map.data && <Spinner />}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <OsmMap key={place?.name ?? 'm'} points={points} activeId={active} onPick={setActive} user={user} center={place?.center} zoom={place ? 14 : 11} height={560} />
          {place && <p className="mt-2 text-xs text-ink-muted">Qidiruv natijasi: {place.name} (Nominatim / OpenStreetMap)</p>}
          {!map.loading && points.length === 0 && <p className="mt-2 text-sm text-ink-muted">Bu filtr bo‘yicha koordinatali do‘kon yoki bozor hali kiritilmagan. Sotuvchilar do‘kon manzilini kabinetida belgilaydi.</p>}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-bold">Sotuvchilar ({rows.length})</h2>
            <div className="flex gap-1 text-sm"><button className={`chip ${sortBy === 'price' ? 'chip-on' : ''}`} onClick={() => setSortBy('price')}>Narx</button><button className={`chip ${sortBy === 'dist' ? 'chip-on' : ''}`} onClick={() => setSortBy('dist')} disabled={!user} title={user ? '' : 'Avval “Menga yaqin” ni bosing'}>Masofa</button></div></div>
          <ul className="max-h-[470px] space-y-2 overflow-y-auto">{rows.length === 0 && !map.loading && <li className="card p-4 text-ink-muted">Do‘kon topilmadi.</li>}
            {rows.map((s) => <li key={s.id}><div onMouseEnter={() => setActive(s.id)} onClick={() => setActive(s.id)} className={`card flex cursor-pointer items-center justify-between gap-2 p-3 ${active === s.id ? 'border-accent-500' : ''}`}>
              <span><b>{s.name}</b><br /><span className="text-xs text-ink-muted">{s.region.name}{s.market ? ` · ${s.market.name}` : ''}{s.km != null ? ` · ${fmtKm(s.km)}` : ''}</span></span>
              <span className="text-right">{s.pricePerBase != null && <b className="block text-brand-700">{money(s.pricePerBase)}</b>}<Link href={`/stores/${s.slug}`} className="text-xs underline">Do‘kon</Link> · <a className="text-xs underline" target="_blank" rel="noopener noreferrer" href={directionsUrl(s, user ?? undefined)}>Yo‘nalish</a></span></div></li>)}</ul>
        </div>
      </div>
    </PageShell>
  );
}
function esc(s: string) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)); }
