'use client';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Empty, ErrorBox, Field, Modal, PageTitle, Spinner, Stat } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { STORE_STATUS, money } from '@/lib/fmt';
import { uploadFile, useAction, useApi, usePublicApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function SellerHome() {
  const stores = useApi<any[]>('/stores/mine'); const [open, setOpen] = useState(false);
  return (
    <AppShell>
      <PageTitle title="Sotuvchi paneli" action={<button className="btn btn-primary" onClick={() => setOpen(true)}>+ Do‘kon ochish</button>} />
      <ErrorBox error={stores.error} retry={stores.reload} />{stores.loading && !stores.data && <Spinner />}
      {stores.data?.length === 0 && <Empty title="Hali do‘kon yo‘q" hint="Do‘kon oching, hujjat yuklang. Moderator tasdiqlagach, narxlaringiz avtomatik ko‘rinadi." />}
      <div className="space-y-6">{stores.data?.map((s) => <StoreCard key={s.id} s={s} reload={stores.reload} />)}</div>
      <StoreForm open={open} onClose={() => { setOpen(false); stores.reload(); }} />
    </AppShell>
  );
}

function StoreCard({ s, reload }: { s: any; reload: () => void }) {
  const st = useApi<any>(`/stores/${s.id}/stats`);
  const [docType, setDocType] = useState('Guvohnoma');
  const doc = useAction(async (f: File) => { const up = await uploadFile(f, 'STORE_DOC'); await api(`/stores/${s.id}/documents`, { body: { type: docType, fileId: up.id } }); reload(); });
  const d = st.data;
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold text-brand-800">{s.name}</h2><Badge tone={s.status === 'VERIFIED' ? 'ok' : s.status === 'PENDING' ? 'warn' : 'bad'}>{STORE_STATUS[s.status] ?? s.status}</Badge></div>
      <p className="text-sm text-ink-muted">{s.region.name}{s.market ? ` · ${s.market.name}` : ''}</p>
      {s.status === 'PENDING' && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Tekshiruv kutilmoqda. Tasdiqlangunga qadar narxlaringiz moderatsiyadan o‘tadi.</p>}
      {d && <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="30 kunlik savdo" value={money(d.revenue30d)} sub={`${d.completed30d} bitim`} /><Stat label="Reyting" value={d.rating ? `${d.rating} ⭐` : '—'} sub={`${d.reviews} sharh`} /><Stat label="Narxlar" value={d.prices.total} sub={`${d.prices.stale} eskirgan · ${d.prices.pendingModeration} tekshiruvda`} /><Stat label="O‘qilmagan xabar" value={d.unreadMessages} sub={`${d.openDisputes} ochiq nizo`} /></div>}
      <div className="mt-4"><h3 className="mb-1 font-semibold">Hujjatlar</h3>
        <ul className="text-sm">{s.documents.map((x: any) => <li key={x.id}>{x.type} — <Badge tone={x.status === 'APPROVED' ? 'ok' : x.status === 'REJECTED' ? 'bad' : 'warn'}>{x.status}</Badge></li>)}{s.documents.length === 0 && <li className="text-ink-muted">Hujjat yuklanmagan.</li>}</ul>
        <div className="mt-2 flex flex-wrap gap-2"><input className="input !w-48" value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Hujjat turi" /><label className="btn btn-ghost cursor-pointer">📎 Hujjat yuklash<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void doc.run(e.target.files[0])} /></label></div><ErrorBox error={doc.error} /></div>
    </section>
  );
}

function StoreForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: '', regionId: '', marketId: '', description: '', lat: '', lng: '' });
  const regions = usePublicApi<any[]>(open ? '/catalog/regions' : null);
  const markets = usePublicApi<any[]>(open && f.regionId ? `/catalog/markets?regionId=${f.regionId}` : null);
  const go = useAction(async () => { await api('/stores', { body: { name: f.name, regionId: f.regionId, marketId: f.marketId || undefined, description: f.description || undefined, lat: f.lat ? Number(f.lat) : undefined, lng: f.lng ? Number(f.lng) : undefined } }); onClose(); });
  return (
    <Modal open={open} title="Yangi do‘kon" onClose={onClose}><div className="space-y-3">
      <Field label="Nomi"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Hudud"><select className="input" value={f.regionId} onChange={(e) => setF({ ...f, regionId: e.target.value, marketId: '' })}><option value="">Tanlang…</option>{regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
      <Field label="Bozor (ixtiyoriy)"><select className="input" value={f.marketId} onChange={(e) => setF({ ...f, marketId: e.target.value })}><option value="">—</option>{markets.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
      <Field label="Tavsif"><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Kenglik (lat)"><input className="input" inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} /></Field><Field label="Uzunlik (lng)"><input className="input" inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} /></Field></div>
      <ErrorBox error={go.error} /><button className="btn btn-primary w-full" disabled={go.busy || f.name.trim().length < 2 || !f.regionId} onClick={() => void go.run()}>Do‘kon ochish</button></div></Modal>
  );
}
