'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ReportButton } from '@/components/ReportButton';
import { PageShell } from '@/components/PageShell';
import { BarList, LineChart } from '@/components/ui/charts';
import { Badge, ErrorBox, Field, Modal, PageTitle, ProductImage, Spinner, Stat, Tabs } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TRUST, ago, money } from '@/lib/fmt';
import { qs, useAction, useApi, usePublicApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [regionId, setRegionId] = useState('');
  const product = usePublicApi<any>(`/catalog/products/${slug}${qs({ regionId })}`);
  const id: string | undefined = product.data?.id;
  const compare = usePublicApi<any>(id ? `/catalog/products/${id}/compare${qs({ regionId })}` : null);
  const regions = usePublicApi<any[]>('/catalog/regions');
  const [tab, setTab] = useState<'offers' | 'history' | 'regions'>('offers');

  if (product.loading && !product.data) return <PageShell><Spinner /></PageShell>;
  if (product.error) return <PageShell><ErrorBox error={product.error} retry={product.reload} /><Link href="/catalog" className="btn btn-ghost mt-4">← Katalog</Link></PageShell>;
  const p = product.data;
  return (
    <PageShell>
      <Link href="/catalog" className="text-sm font-semibold text-brand-700">← Katalog</Link>
      <div className="mt-3 grid gap-5 md:grid-cols-[280px_1fr]">
        <ProductImage id={p.images?.[0]?.fileId} alt={p.name} name={p.name} category={p.category?.name} className="h-64 w-full rounded-2xl" />
        <div>
          <p className="text-sm text-ink-muted">{p.category.name}{p.brand ? ` · ${p.brand}` : ''}</p>
          <h1 className="text-3xl font-extrabold text-brand-800">{p.name}</h1>
          {p.description && <p className="mt-2 text-ink-soft">{p.description}</p>}
          <p className="mt-2 text-sm text-ink-muted">Asosiy birlik: {p.unit.name} ({p.unit.code})</p>
          {user && <UserActions productId={p.id} unit={p.unit.code} />}
          {!user && <p className="mt-4 rounded-xl bg-cream-200 px-4 py-3 text-sm">Buyurtma berish, sevimlilarga qo‘shish va ogohlantirish uchun <Link href={`/login?next=/catalog/${slug}`} className="font-bold text-brand-700 underline">kiring</Link>.</p>}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={[{ id: 'offers', label: 'Takliflar' }, { id: 'history', label: 'Narx tarixi' }, { id: 'regions', label: 'Hududlar' }]} value={tab} onChange={setTab} />
        <select className="input !w-auto" value={regionId} onChange={(e) => setRegionId(e.target.value)} aria-label="Hudud"><option value="">Barcha hududlar</option>{regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </div>
      {tab === 'offers' && <Offers compare={compare} canBuy={!!user?.permissions.includes('orders.create')} />}
      {tab === 'history' && <History id={p.id} regionId={regionId} />}
      {tab === 'regions' && <Regional id={p.id} />}
    </PageShell>
  );
}

function UserActions({ productId, unit }: { productId: string; unit: string }) {
  const { user } = useAuth();
  const fav = useApi<{ favorite: boolean }>(user?.permissions.includes('favorites.manage') ? `/favorites/${productId}` : null);
  const toggle = useAction(async () => { await api(`/favorites/${productId}`, { method: fav.data?.favorite ? 'DELETE' : 'POST' }); fav.reload(); });
  const [alertOpen, setAlertOpen] = useState(false);
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {user?.permissions.includes('favorites.manage') && <button className="btn btn-ghost" disabled={toggle.busy} onClick={() => void toggle.run()}>{fav.data?.favorite ? '❤️ Sevimlilarda' : '🤍 Sevimlilarga'}</button>}
      {user?.permissions.includes('alerts.manage') && <button className="btn btn-ghost" onClick={() => setAlertOpen(true)}>🔔 Narx ogohlantirishi</button>}
      <ErrorBox error={toggle.error} />
      <AlertModal open={alertOpen} onClose={() => setAlertOpen(false)} productId={productId} unit={unit} />
    </div>
  );
}

function AlertModal({ open, onClose, productId, unit }: { open: boolean; onClose: () => void; productId: string; unit: string }) {
  const [price, setPrice] = useState(''); const [dir, setDir] = useState('BELOW'); const [done, setDone] = useState(false);
  const a = useAction(async () => { await api('/alerts', { body: { productId, direction: dir, targetPrice: Number(price), unitCode: unit } }); setDone(true); });
  return (
    <Modal open={open} title="Narx ogohlantirishi" onClose={() => { setDone(false); onClose(); }}>
      {done ? <p className="text-brand-700">Ogohlantirish yaratildi. Narx shartga kelganda xabar olasiz.</p> : (
        <div className="space-y-3">
          <Field label="Shart"><select className="input" value={dir} onChange={(e) => setDir(e.target.value)}><option value="BELOW">Narx shundan pastga tushsa</option><option value="ABOVE">Narx shundan oshsa</option></select></Field>
          <Field label={`Narx (so‘m / ${unit})`}><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <ErrorBox error={a.error} />
          <button className="btn btn-primary w-full" disabled={a.busy || !(Number(price) > 0)} onClick={() => void a.run()}>Yaratish</button>
        </div>)}
    </Modal>
  );
}

function Offers({ compare, canBuy }: { compare: { data?: any; loading: boolean; error: any; reload: () => void }; canBuy: boolean }) {
  const [sel, setSel] = useState<any>(null);
  if (compare.loading && !compare.data) return <Spinner />;
  if (compare.error) return <ErrorBox error={compare.error} retry={compare.reload} />;
  const d = compare.data;
  if (!d) return <Spinner />;
  if (d.offers.length === 0 && d.notComparable.length === 0) return <p className="card p-6 text-center text-ink-soft">Bu mahsulot uchun hozircha narx kiritilmagan.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Takliflar 1 {d.baseUnit} narxi bo‘yicha tartiblangan (qadoq o‘lchamlari hisobga olingan).</p>
      {d.offers.map((o: any) => <OfferCard key={o.id} o={o} base={d.baseUnit} canBuy={canBuy} onPick={() => setSel(o)} />)}
      {d.notComparable.length > 0 && <div><h3 className="mb-2 mt-4 font-bold text-ink-soft">Solishtirib bo‘lmaydigan takliflar</h3>{d.notComparable.map((o: any) => <OfferCard key={o.id} o={o} base={d.baseUnit} canBuy={canBuy} onPick={() => setSel(o)} />)}</div>}
      <OrderModal offer={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function OfferCard({ o, base, canBuy, onPick }: { o: any; base: string; canBuy: boolean; onPick: () => void }) {
  const t = TRUST[o.trust.status] ?? TRUST.INSUFFICIENT_DATA;
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {o.rank && <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">{o.rank}</span>}
          <Link href={`/stores/${o.store.slug}`} className="font-bold text-brand-800 hover:underline">{o.store.name}</Link>
          {o.store.verified && <Badge tone="ok">✓ Tasdiqlangan</Badge>}
          <Badge tone={t.tone}>{t.label}{o.trust.score !== null ? ` · ${o.trust.score}` : ''}</Badge>
          {o.stale && <Badge tone="warn">Eskirgan narx</Badge>}
        </div>
        <p className="mt-1 text-sm text-ink-muted">{o.store.region}{o.store.market ? ` · ${o.store.market}` : ''} · yangilangan {ago(o.confirmedAt)}{o.variant ? ` · ${o.variant.name}` : ''}</p>
        <p className="text-sm text-ink-muted">{o.deliveryAvailable ? '🚚 Yetkazib beradi' : 'Faqat olib ketish'} · {o.availability === 'IN_STOCK' ? 'Bor' : o.availability === 'LOW_STOCK' ? 'Oz qolgan' : 'Tugagan'}{o.quantityAvailable !== null ? ` (${o.quantityAvailable} ${o.unit})` : ''}</p>
      </div>
      <div className="text-right">
        <p className="text-xl font-extrabold text-brand-700">{money(o.effectivePrice)} <span className="text-xs font-medium text-ink-muted">/ {o.unit}</span></p>
        {o.discountPercent && <p className="text-xs text-accent-600">−{o.discountPercent}% (eski narx {money(o.price)})</p>}
        {o.pricePerBaseUnit !== null && o.unit !== base && <p className="text-xs text-ink-muted">{money(o.pricePerBaseUnit)} / {base}</p>}
        {o.diffFromCheapestPercent > 0 && <p className="text-xs text-ink-muted">+{o.diffFromCheapestPercent}% eng arzonidan</p>}
        <div className="mt-1"><ReportButton targetType="PRICE" targetId={o.id} label="🚩 Narx noto‘g‘ri" /></div>
        {canBuy && o.availability !== 'OUT_OF_STOCK' && <button className="btn btn-accent mt-2 !min-h-[40px]" onClick={onPick}>Sotib olish</button>}
      </div>
    </div>
  );
}

function OrderModal({ offer, onClose }: { offer: any; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<'cart' | 'offer'>('cart');
  const [q, setQ] = useState('1'); const [price, setPrice] = useState(''); const [msg, setMsg] = useState('');
  const [tiers, setTiers] = useState<any[] | null>(null);
  const run = useAction(async () => {
    if (mode === 'cart') { await api('/cart/items', { body: { priceRecordId: offer.id, quantity: Number(q) } }); router.push('/cart'); }
    else { await api('/offers', { body: { priceRecordId: offer.id, quantity: Number(q), offeredUnitPrice: Number(price), message: msg || undefined } }); router.push('/offers'); }
  });
  const chat = useAction(async () => { const c = await api<{ id: string }>('/chat/conversations', { body: { storeId: offer.store.id } }); router.push(`/chat/${c.id}`); });
  const offerId: string | undefined = offer?.id;
  useEffect(() => {
    if (!offerId) { setTiers(null); return; }
    api<any[]>(`/catalog/prices/${offerId}/tiers`, { auth: false }).then(setTiers).catch(() => setTiers([]));
  }, [offerId]);
  return (
    <Modal open={!!offer} title={offer ? `${offer.store.name}` : ''} onClose={onClose}>
      {offer && <div className="space-y-3">
        <Tabs tabs={[{ id: 'cart', label: 'Savatga' }, { id: 'offer', label: 'Narx taklif qilish' }]} value={mode} onChange={setMode} />
        <Field label={`Miqdor (${offer.unit})`}><input className="input" inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        {tiers && tiers.length > 0 && <div className="rounded-xl bg-brand-50 p-3 text-sm"><b>Ulgurji narxlar:</b>{tiers.map((t: any) => <div key={t.minQuantity}>{t.minQuantity} {offer.unit} dan: {money(t.unitPrice)}</div>)}</div>}
        {mode === 'offer' && <><Field label={`Sizning narxingiz (so‘m / ${offer.unit})`} hint={`E’lon qilingan narxning 30%–100% oralig‘ida (hozir ${money(offer.effectivePrice)}).`}><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field><Field label="Xabar (ixtiyoriy)"><textarea className="input" rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field></>}
        <ErrorBox error={run.error ?? chat.error} />
        <button className="btn btn-primary w-full" disabled={run.busy || !(Number(q) > 0) || (mode === 'offer' && !(Number(price) > 0))} onClick={() => void run.run()}>{mode === 'cart' ? 'Savatga qo‘shish' : 'Taklif yuborish'}</button>
        <button className="btn btn-ghost w-full" disabled={chat.busy} onClick={() => void chat.run()}>💬 Sotuvchiga yozish</button>
      </div>}
    </Modal>
  );
}

function History({ id, regionId }: { id: string; regionId: string }) {
  const [days, setDays] = useState(30);
  const h = usePublicApi<any>(`/catalog/products/${id}/history${qs({ days, regionId })}`);
  const f = usePublicApi<any>(`/analytics/products/${id}/forecast${qs({ days: Math.max(days, 30), regionId })}`);
  const st = usePublicApi<any>(`/catalog/products/${id}/stats${qs({ regionId })}`);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{[7, 30, 90, 365].map((d) => <button key={d} onClick={() => setDays(d)} className={`btn !min-h-[38px] !px-4 ${days === d ? 'btn-primary' : 'btn-ghost'}`}>{d === 365 ? '1 yil' : `${d} kun`}</button>)}</div>
      <ErrorBox error={h.error} />
      {h.loading && <Spinner />}
      {h.data && <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2"><b>1 {h.data.baseUnit} narxi</b>{h.data.trend && <Badge tone={h.data.trend.direction === 'UP' ? 'bad' : h.data.trend.direction === 'DOWN' ? 'ok' : 'muted'}>{h.data.trend.direction === 'UP' ? '↑ Oshmoqda' : h.data.trend.direction === 'DOWN' ? '↓ Tushmoqda' : h.data.trend.direction === 'FLAT' ? '→ Barqaror' : 'Ma’lumot kam'}</Badge>}</div>
        <LineChart label="Narx dinamikasi" unit={`so‘m/${h.data.baseUnit}`} points={h.data.series.map((b: any) => ({ x: b.date, y: b.avg }))} projection={f.data?.projectionReliable ? f.data.projection.map((p: any) => ({ x: p.date, y: p.value })) : []} />
        {f.data?.projectionReliable && <p className="mt-2 text-xs text-ink-muted"><span className="text-accent-600">- - -</span> Oddiy trend davomi (prognoz emas, faqat taxminiy yo‘nalish).</p>}
        {f.data && !f.data.projectionReliable && f.data.reason && <p className="mt-2 text-xs text-ink-muted">Trend davomi chizilmadi: {f.data.reason}</p>}
      </div>}
      {st.data && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Eng arzon" value={money(st.data.overall.min)} sub={`1 ${st.data.baseUnit}`} /><Stat label="Eng qimmat" value={money(st.data.overall.max)} />
        <Stat label="O‘rtacha" value={money(st.data.overall.avg)} /><Stat label="Median" value={money(st.data.overall.median)} sub={`${st.data.overall.count} ta narx`} />
      </div>}
    </div>
  );
}

function Regional({ id }: { id: string }) {
  const r = usePublicApi<any>(`/analytics/products/${id}/regional`);
  if (r.loading) return <Spinner />;
  if (r.error) return <ErrorBox error={r.error} retry={r.reload} />;
  const d = r.data;
  return (
    <div className="card space-y-4 p-4">
      {d.cheapestRegion && <p>Eng arzon hudud: <b className="text-brand-700">{d.cheapestRegion.region}</b> (median {money(d.cheapestRegion.median)} / {d.baseUnit}){d.dearestRegion && <> · eng qimmat: <b className="text-accent-600">{d.dearestRegion.region}</b> ({money(d.dearestRegion.median)})</>}</p>}
      <BarList unit={`so‘m/${d.baseUnit}`} rows={d.byRegion.map((x: any) => ({ label: x.region, value: x.median, sub: `min ${money(x.min)} · max ${money(x.max)} · o‘rtacha ${money(x.avg)} · ${x.count} ta narx` }))} />
      {d.byRegion.length === 0 && <p className="text-ink-muted">Hududlar bo‘yicha ma’lumot yo‘q.</p>}
    </div>
  );
}
