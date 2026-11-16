'use client';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Confirm, Empty, ErrorBox, Field, Modal, PageTitle, Pager, ProductImage, Spinner, statusTone } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { MOD_STATUS } from '@/lib/fmt';
import { qs, uploadFile, useAction, useApi, usePublicApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
const flat = (c: any[], d = 0): Array<{ id: string; name: string }> => c.flatMap((x) => [{ id: x.id, name: `${'— '.repeat(d)}${x.name}` }, ...flat(x.children, d + 1)]);

export default function SellerProducts() {
  const [page, setPage] = useState(1); const [edit, setEdit] = useState<any>(null); const [creating, setCreating] = useState(false); const [del, setDel] = useState<any>(null);
  const q = useApi<Paged<any>>(`/products/mine${qs({ page, pageSize: 12 })}`);
  const rm = useAction(async (id: string) => { await api(`/products/${id}`, { method: 'DELETE' }); setDel(null); q.reload(); });
  const arch = useAction(async (id: string) => { await api(`/products/${id}/archive`, { method: 'POST', body: {} }); q.reload(); });
  return (
    <AppShell>
      <PageTitle title="Mahsulotlarim" sub="Yangi mahsulot moderator tasdig‘idan keyin katalogda ko‘rinadi." action={<button className="btn btn-primary" onClick={() => setCreating(true)}>+ Mahsulot</button>} />
      <ErrorBox error={q.error ?? rm.error ?? arch.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Hali mahsulot qo‘shmagansiz" />}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{q.data?.items.map((p) => (
        <li key={p.id} className="card overflow-hidden"><ProductImage id={p.images?.[0]?.fileKey} alt={p.name} className="h-32 w-full" />
          <div className="p-4"><div className="flex items-center justify-between gap-2"><b>{p.name}</b><Badge tone={statusTone(p.status)}>{MOD_STATUS[p.status] ?? p.status}</Badge></div><p className="text-sm text-ink-muted">{p.category.name} · {p.unit.code}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold"><button className="text-brand-700" onClick={() => setEdit(p)}>Tahrirlash</button><button className="text-ink-soft" onClick={() => void arch.run(p.id)}>Arxivlash</button><button className="text-danger" onClick={() => setDel(p)}>O‘chirish</button></div></div></li>))}</ul>
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
      <ProductForm open={creating} onClose={() => { setCreating(false); q.reload(); }} />
      <ProductEdit p={edit} onClose={() => { setEdit(null); q.reload(); }} />
      <Confirm open={!!del} title="Mahsulotni o‘chirish" text={`“${del?.name}” o‘chiriladi. Narxlar tarixi saqlanib qoladi.`} danger busy={rm.busy} onYes={() => void rm.run(del.id)} onNo={() => setDel(null)} />
    </AppShell>
  );
}

function ProductForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cats = usePublicApi<any[]>(open ? '/catalog/categories' : null); const units = usePublicApi<any[]>(open ? '/catalog/units' : null);
  const [f, setF] = useState({ name: '', categoryId: '', unitId: '', brand: '', description: '' });
  const go = useAction(async () => { await api('/products', { body: { name: f.name, categoryId: f.categoryId, unitId: f.unitId, brand: f.brand || undefined, description: f.description || undefined } }); setF({ name: '', categoryId: '', unitId: '', brand: '', description: '' }); onClose(); });
  return (
    <Modal open={open} title="Yangi mahsulot" onClose={onClose}><div className="space-y-3">
      <Field label="Nomi"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Kategoriya"><select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}><option value="">Tanlang…</option>{flat(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Asosiy o‘lchov birligi"><select className="input" value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })}><option value="">Tanlang…</option>{units.data?.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}</select></Field>
      <Field label="Brend"><input className="input" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></Field>
      <Field label="Tavsif"><textarea className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <ErrorBox error={go.error} /><button className="btn btn-primary w-full" disabled={go.busy || f.name.trim().length < 2 || !f.categoryId || !f.unitId} onClick={() => void go.run()}>Yuborish</button></div></Modal>
  );
}

function ProductEdit({ p, onClose }: { p: any; onClose: () => void }) {
  const units = usePublicApi<any[]>(p ? '/catalog/units' : null);
  const detail = usePublicApi<any>(p ? `/catalog/products/${p.id}` : null);
  const [f, setF] = useState<any>(null); const [v, setV] = useState({ name: '', unitId: '', quantity: '' });
  const cur = f ?? { name: p?.name ?? '', brand: p?.brand ?? '', description: p?.description ?? '' };
  const save = useAction(async () => { await api(`/products/${p.id}`, { method: 'PATCH', body: { name: cur.name, brand: cur.brand || undefined, description: cur.description || undefined } }); onClose(); });
  const img = useAction(async (file: File) => { const up = await uploadFile(file, 'PRODUCT_IMAGE'); await api(`/products/${p.id}/images`, { body: { fileId: up.id } }); detail.reload(); });
  const delImg = useAction(async (id: string) => { await api(`/product-images/${id}`, { method: 'DELETE' }); detail.reload(); });
  const addV = useAction(async () => { await api(`/products/${p.id}/variants`, { body: { name: v.name, unitId: v.unitId, quantity: Number(v.quantity) } }); setV({ name: '', unitId: '', quantity: '' }); detail.reload(); });
  const delV = useAction(async (id: string) => { await api(`/variants/${id}`, { method: 'DELETE' }); detail.reload(); });
  const err = save.error ?? img.error ?? delImg.error ?? addV.error ?? delV.error;
  return (
    <Modal open={!!p} title={p ? `Tahrirlash: ${p.name}` : ''} onClose={() => { setF(null); onClose(); }}>{p && <div className="space-y-4">
      <Field label="Nomi"><input className="input" value={cur.name} onChange={(e) => setF({ ...cur, name: e.target.value })} /></Field>
      <Field label="Brend"><input className="input" value={cur.brand} onChange={(e) => setF({ ...cur, brand: e.target.value })} /></Field>
      <Field label="Tavsif"><textarea className="input" rows={3} value={cur.description} onChange={(e) => setF({ ...cur, description: e.target.value })} /></Field>
      <button className="btn btn-primary w-full" disabled={save.busy} onClick={() => void save.run()}>Saqlash</button>
      <div><h3 className="mb-2 font-bold">Rasmlar</h3><div className="flex flex-wrap gap-2">{detail.data?.images.map((i: any) => <div key={i.id} className="relative"><ProductImage id={i.fileId} alt="" className="h-20 w-20 rounded-xl" /><button className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-white" aria-label="Rasmni o‘chirish" onClick={() => void delImg.run(i.id)}>×</button></div>)}
        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-cream-300 text-2xl">＋<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void img.run(e.target.files[0])} /></label></div>
        <p className="mt-1 text-xs text-ink-muted">PNG, JPEG yoki WebP, 5 MB gacha.</p></div>
      <div><h3 className="mb-2 font-bold">Qadoq variantlari</h3><ul className="mb-2 text-sm">{detail.data?.variants.map((x: any) => <li key={x.id} className="flex justify-between py-1">{x.name} — {x.quantity} {x.unit}<button className="text-danger" onClick={() => void delV.run(x.id)}>O‘chirish</button></li>)}</ul>
        <div className="grid grid-cols-3 gap-2"><input className="input" placeholder="Nomi (5 kg qop)" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /><input className="input" placeholder="Miqdor" inputMode="decimal" value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} /><select className="input" value={v.unitId} onChange={(e) => setV({ ...v, unitId: e.target.value })} aria-label="Birlik"><option value="">Birlik</option>{units.data?.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select></div>
        <button className="btn btn-ghost mt-2 w-full" disabled={addV.busy || !v.name || !v.unitId || !(Number(v.quantity) > 0)} onClick={() => void addV.run()}>Variant qo‘shish</button></div>
      <ErrorBox error={err} /></div>}</Modal>
  );
}
