'use client';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Empty, ErrorBox, Field, PageTitle, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { day } from '@/lib/fmt';
import { useAction, useApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Discounts() {
  const stores = useApi<any[]>('/stores/mine'); const [sel, setSel] = useState('');
  const sid = sel || stores.data?.[0]?.id;
  const list = useApi<any[]>(sid ? `/stores/${sid}/discounts` : null);
  const [f, setF] = useState({ code: '', percent: '', minAmount: '', endsAt: '', usageLimit: '' });
  const add = useAction(async () => { await api(`/stores/${sid}/discounts`, { body: { code: f.code, percent: Number(f.percent), minAmount: f.minAmount ? Number(f.minAmount) : undefined, endsAt: f.endsAt || undefined, usageLimit: f.usageLimit ? Number(f.usageLimit) : undefined } }); setF({ code: '', percent: '', minAmount: '', endsAt: '', usageLimit: '' }); list.reload(); });
  const toggle = useAction(async (id: string, active: boolean) => { await api(`/stores/${sid}/discounts/${id}`, { method: 'PATCH', body: { active } }); list.reload(); });
  const del = useAction(async (id: string) => { await api(`/stores/${sid}/discounts/${id}`, { method: 'DELETE' }); list.reload(); });
  return (
    <AppShell><PageTitle title="Chegirma kodlari" sub="Xaridor buyurtma berishda kodni kiritadi; chegirma shu do‘kon buyurtmasiga qo‘llanadi." />
      {(stores.data?.length ?? 0) > 1 && <select className="input mb-4 !w-auto" value={sid} onChange={(e) => setSel(e.target.value)}>{stores.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      <section className="card mb-5 grid gap-3 p-4 sm:grid-cols-5">
        <Field label="Kod"><input className="input uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field><Field label="Foiz"><input className="input" inputMode="decimal" value={f.percent} onChange={(e) => setF({ ...f, percent: e.target.value })} /></Field>
        <Field label="Min. summa"><input className="input" inputMode="decimal" value={f.minAmount} onChange={(e) => setF({ ...f, minAmount: e.target.value })} /></Field><Field label="Tugash sanasi"><input className="input" type="date" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></Field>
        <Field label="Limit"><input className="input" inputMode="numeric" value={f.usageLimit} onChange={(e) => setF({ ...f, usageLimit: e.target.value })} /></Field>
        <div className="sm:col-span-5"><ErrorBox error={add.error ?? toggle.error ?? del.error} /><button className="btn btn-primary mt-2" disabled={add.busy || f.code.length < 3 || !(Number(f.percent) > 0) || !sid} onClick={() => void add.run()}>Kod yaratish</button></div></section>
      {list.loading && !list.data && <Spinner />}{list.data?.length === 0 && <Empty title="Chegirma kodlari yo‘q" />}
      <ul className="space-y-2">{list.data?.map((d) => <li key={d.id} className="card flex flex-wrap items-center justify-between gap-3 p-4"><div><b className="font-mono">{d.code}</b> — {Number(d.percent)}%{d.minAmount && Number(d.minAmount) > 0 ? ` (${Number(d.minAmount)} so‘mdan)` : ''}<p className="text-xs text-ink-muted">{d.endsAt ? `${day(d.endsAt)} gacha` : 'Muddatsiz'} · ishlatilgan {d.usedCount ?? 0}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</p></div>
        <div className="flex items-center gap-3"><Badge tone={d.active ? 'ok' : 'muted'}>{d.active ? 'Faol' : 'O‘chiq'}</Badge><button className="text-sm font-semibold text-brand-700" onClick={() => void toggle.run(d.id, !d.active)}>{d.active ? 'O‘chirish' : 'Yoqish'}</button><button className="text-sm font-semibold text-danger" onClick={() => void del.run(d.id)}>Olib tashlash</button></div></li>)}</ul>
    </AppShell>
  );
}
