'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Badge, Empty, ErrorBox, Field, Modal, PageTitle, Pager, Spinner, Table, statusTone } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { MOD_STATUS, TRUST, ago, money } from '@/lib/fmt';
import { qs, uploadFile, useAction, useApi, usePublicApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
function Prices() {
  const sp = useSearchParams();
  const [page, setPage] = useState(1); const [stale, setStale] = useState(sp.get('stale') === 'true');
  const [create, setCreate] = useState(false); const [row, setRow] = useState<any>(null);
  const q = useApi<Paged<any>>(`/prices/mine${qs({ page, pageSize: 15, stale: stale || undefined })}`);
  const confirm = useAction(async (id: string) => { await api(`/prices/${id}/confirm`, { method: 'POST', body: {} }); q.reload(); });
  const withdraw = useAction(async (id: string) => { await api(`/prices/${id}`, { method: 'DELETE' }); q.reload(); });
  return (
    <>
      <PageTitle title="Narxlarim" sub="Narx 7 kundan keyin “eskirgan” bo‘ladi. “Tasdiqlash” narxni o‘zgartirmasdan yangilaydi." action={<button className="btn btn-primary" onClick={() => setCreate(true)}>+ Narx qo‘shish</button>} />
      <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={stale} onChange={(e) => { setStale(e.target.checked); setPage(1); }} />Faqat eskirganlar</label>
      <ErrorBox error={q.error ?? confirm.error ?? withdraw.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Narxlar yo‘q" />}
      {q.data && q.data.items.length > 0 && <Table head={['Mahsulot', 'Narx', 'Qoldiq', 'Holat', 'Ishonch', '']}>{q.data.items.map((r) => { const t = TRUST[r.trust.status] ?? TRUST.INSUFFICIENT_DATA; return (
        <tr key={r.id}><td className="px-4 py-3"><b>{r.product.name}</b><br /><span className="text-xs text-ink-muted">{r.store.name}{r.variant ? ` · ${r.variant}` : ''}</span></td>
          <td className="px-4 py-3">{money(r.price)} / {r.unit}{r.discountPercent ? <span className="block text-xs text-accent-600">−{r.discountPercent}%</span> : null}</td>
          <td className="px-4 py-3">{r.quantityAvailable ?? '—'}</td>
          <td className="px-4 py-3"><Badge tone={statusTone(r.moderationStatus)}>{MOD_STATUS[r.moderationStatus]}</Badge>{r.stale && <Badge tone="warn">Eskirgan · {ago(r.confirmedAt)}</Badge>}</td>
          <td className="px-4 py-3"><Badge tone={t.tone}>{t.label}</Badge></td>
          <td className="space-x-3 whitespace-nowrap px-4 py-3 text-sm font-semibold"><button className="text-brand-700" disabled={confirm.busy} onClick={() => void confirm.run(r.id)}>Tasdiqlash</button><button className="text-ink-soft" onClick={() => setRow(r)}>Boshqarish</button><button className="text-danger" onClick={() => void withdraw.run(r.id)}>Olib tashlash</button></td></tr>); })}</Table>}
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
      <PriceForm open={create} onClose={() => { setCreate(false); q.reload(); }} />
      <PriceManage r={row} onClose={() => { setRow(null); q.reload(); }} />
    </>
  );
}
export default function SellerPrices() { return <AppShell><Suspense fallback={<Spinner />}><Prices /></Suspense></AppShell>; }

function PriceForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stores = useApi<any[]>(open ? '/stores/mine' : null); const [search, setSearch] = useState('');
  const prods = usePublicApi<Paged<any>>(open ? `/catalog/products${qs({ q: search, pageSize: 20 })}` : null);
  const [f, setF] = useState({ storeId: '', productId: '', variantId: '', price: '', quantityAvailable: '', discountPercent: '', deliveryAvailable: false, availability: 'IN_STOCK', note: '' });
  const detail = usePublicApi<any>(f.productId ? `/catalog/products/${f.productId}` : null);
  const go = useAction(async () => { await api('/prices', { body: { storeId: f.storeId || stores.data?.[0]?.id, productId: f.productId, variantId: f.variantId || undefined, price: Number(f.price), availability: f.availability, quantityAvailable: f.quantityAvailable ? Number(f.quantityAvailable) : undefined, deliveryAvailable: f.deliveryAvailable, discountPercent: f.discountPercent ? Number(f.discountPercent) : undefined, note: f.note || undefined } }); onClose(); });
  return (
    <Modal open={open} title="Narx qo‘shish" onClose={onClose}><div className="space-y-3">
      {(stores.data?.length ?? 0) > 1 && <Field label="Do‘kon"><select className="input" value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })}>{stores.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
      <Field label="Mahsulot" hint="Katalogda yo‘q bo‘lsa, avval “Mahsulotlarim” bo‘limida qo‘shing."><input className="input" placeholder="Qidirish…" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
      <select className="input" size={4} value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value, variantId: '' })} aria-label="Mahsulot tanlash">{prods.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}</select>
      {detail.data?.variants.length > 0 && <Field label="Qadoq varianti (ixtiyoriy)"><select className="input" value={f.variantId} onChange={(e) => setF({ ...f, variantId: e.target.value })}><option value="">Asosiy birlik ({detail.data.unit.code})</option>{detail.data.variants.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>}
      <div className="grid grid-cols-2 gap-3"><Field label={`Narx (so‘m${detail.data && !f.variantId ? ' / ' + detail.data.unit.code : ''})`}><input className="input" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field><Field label="Chegirma %"><input className="input" inputMode="decimal" value={f.discountPercent} onChange={(e) => setF({ ...f, discountPercent: e.target.value })} /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Qoldiq (bo‘sh = cheksiz)"><input className="input" inputMode="decimal" value={f.quantityAvailable} onChange={(e) => setF({ ...f, quantityAvailable: e.target.value })} /></Field><Field label="Mavjudlik"><select className="input" value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })}><option value="IN_STOCK">Bor</option><option value="LOW_STOCK">Oz qolgan</option><option value="OUT_OF_STOCK">Tugagan</option></select></Field></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.deliveryAvailable} onChange={(e) => setF({ ...f, deliveryAvailable: e.target.checked })} />Yetkazib beraman</label>
      <ErrorBox error={go.error} /><button className="btn btn-primary w-full" disabled={go.busy || !f.productId || !(Number(f.price) > 0)} onClick={() => void go.run()}>Saqlash</button></div></Modal>
  );
}

function PriceManage({ r, onClose }: { r: any; onClose: () => void }) {
  const [price, setPrice] = useState(''); const [stock, setStock] = useState(''); const [tiers, setTiers] = useState<Array<{ minQuantity: string; unitPrice: string }>>([]);
  const ledger = useApi<any[]>(r ? `/prices/${r.id}/stock` : null); const cur = usePublicApi<any[]>(r ? `/catalog/prices/${r.id}/tiers` : null);
  const upd = useAction(async () => { await api(`/prices/${r.id}`, { method: 'PATCH', body: { price: Number(price) } }); onClose(); });
  const adj = useAction(async (mode: 'set' | 'delta') => { await api(`/prices/${r.id}/stock`, { body: { [mode]: Number(stock), reason: mode === 'set' ? 'ADJUST' : 'RESTOCK' } }); setStock(''); ledger.reload(); });
  const saveTiers = useAction(async () => { await api(`/prices/${r.id}/tiers`, { method: 'PUT', body: { tiers: tiers.filter((t) => t.minQuantity && t.unitPrice).map((t) => ({ minQuantity: Number(t.minQuantity), unitPrice: Number(t.unitPrice) })) } }); cur.reload(); });
  const evid = useAction(async (f: File) => { const up = await uploadFile(f, 'EVIDENCE'); await api(`/prices/${r.id}/evidence`, { body: { fileId: up.id } }); });
  const shown = tiers.length ? tiers : (cur.data ?? []).map((t) => ({ minQuantity: String(t.minQuantity), unitPrice: String(t.unitPrice) }));
  return (
    <Modal open={!!r} title={r ? r.product.name : ''} onClose={onClose}>{r && <div className="space-y-5">
      <div><h3 className="mb-1 font-bold">Narxni o‘zgartirish</h3><div className="flex gap-2"><input className="input" inputMode="decimal" placeholder={String(r.price)} value={price} onChange={(e) => setPrice(e.target.value)} /><button className="btn btn-primary" disabled={upd.busy || !(Number(price) > 0)} onClick={() => void upd.run()}>Saqlash</button></div>
        <p className="mt-1 text-xs text-ink-muted">O‘rtacha narxdan keskin farq qilsa, narx moderator tekshiruviga tushadi.</p></div>
      <div><h3 className="mb-1 font-bold">Ombor qoldig‘i: {r.quantityAvailable ?? 'cheksiz'}</h3><div className="flex flex-wrap gap-2"><input className="input !w-32" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} /><button className="btn btn-ghost" disabled={adj.busy || stock === ''} onClick={() => void adj.run('delta')}>± Qo‘shish/ayirish</button><button className="btn btn-ghost" disabled={adj.busy || stock === ''} onClick={() => void adj.run('set')}>= Belgilash</button></div>
        <ul className="mt-2 max-h-28 overflow-y-auto text-xs text-ink-muted">{ledger.data?.map((m) => <li key={m.id}>{ago(m.createdAt)} · {m.reason} · {Number(m.delta) > 0 ? '+' : ''}{String(m.delta)} → {String(m.balanceAfter ?? '')}</li>)}</ul></div>
      <div><h3 className="mb-1 font-bold">Ulgurji narxlar</h3>{shown.map((t, i) => <div key={i} className="mb-2 grid grid-cols-2 gap-2"><input className="input" placeholder="Miqdordan" inputMode="decimal" value={t.minQuantity} onChange={(e) => setTiers(shown.map((x, j) => (j === i ? { ...x, minQuantity: e.target.value } : x)))} /><input className="input" placeholder="Narx" inputMode="decimal" value={t.unitPrice} onChange={(e) => setTiers(shown.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} /></div>)}
        <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setTiers([...shown, { minQuantity: '', unitPrice: '' }])}>+ Qatlam</button><button className="btn btn-primary" disabled={saveTiers.busy} onClick={() => void saveTiers.run()}>Saqlash</button></div></div>
      <label className="btn btn-ghost w-full cursor-pointer">📎 Narx dalili (chek, foto)<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void evid.run(e.target.files[0])} /></label>
      <ErrorBox error={upd.error ?? adj.error ?? saveTiers.error ?? evid.error} /></div>}</Modal>
  );
}
