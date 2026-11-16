'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, ErrorBox, Field, Spinner, statusTone } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DISPUTE_STATUS, dt } from '@/lib/fmt';
import { uploadFile, useAction, useApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const d = useApi<any>(`/disputes/${id}`);
  const [text, setText] = useState(''); const [outcome, setOutcome] = useState('COMPLETE'); const [res, setRes] = useState(''); const [appeal, setAppeal] = useState('');
  const refresh = () => d.reload();
  const note = useAction(async (fileId?: string) => { await api(`/disputes/${id}/notes`, { body: { text: text || undefined, fileId } }); setText(''); refresh(); });
  const file = useAction(async (f: File) => { const up = await uploadFile(f, 'EVIDENCE'); await note.run(up.id); });
  const take = useAction(async () => { await api(`/disputes/${id}/take`, { method: 'POST', body: {} }); refresh(); });
  const resolve = useAction(async () => { await api(`/disputes/${id}/resolve`, { body: { outcome, resolution: res } }); refresh(); });
  const doAppeal = useAction(async () => { await api(`/disputes/${id}/appeal`, { body: { reason: appeal } }); refresh(); });
  if (d.loading && !d.data) return <AppShell><Spinner /></AppShell>;
  if (d.error) return <AppShell><ErrorBox error={d.error} retry={d.reload} /></AppShell>;
  const x = d.data; const staff = x.myRole === 'staff'; const canResolveRole = user?.permissions.includes('disputes.resolve');
  const open = ['OPEN', 'IN_REVIEW', 'APPEALED'].includes(x.status);
  return (
    <AppShell>
      <Link href="/disputes" className="mb-3 block text-sm font-semibold text-brand-700">← Nizolar</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold text-brand-800">Nizo · <Link className="underline" href={`/orders/${x.orderId}`}>{x.orderNumber}</Link></h1><Badge tone={statusTone(x.status)}>{DISPUTE_STATUS[x.status] ?? x.status}</Badge></div>
      {x.resolution && <p className="mb-4 rounded-xl bg-brand-50 p-3 text-sm"><b>Qaror:</b> {x.resolution}</p>}
      <ErrorBox error={note.error ?? file.error ?? take.error ?? resolve.error ?? doAppeal.error} />
      <section className="card p-4"><h2 className="mb-3 font-bold">Yozishmalar va dalillar</h2>
        <ul className="space-y-3">{(x.evidence as any[]).map((e, i) => <li key={i} className="rounded-xl bg-cream-100 p-3 text-sm"><p className="text-xs text-ink-muted">{e.role === 'buyer' ? 'Xaridor' : e.role === 'seller' ? 'Sotuvchi' : 'Moderator'} · {dt(e.at)}</p>{e.text && <p className="whitespace-pre-wrap">{e.text}</p>}{e.fileId && <a className="font-semibold text-brand-700 underline" href={`/api/files/${e.fileId}`} target="_blank" rel="noreferrer">📎 Fayl</a>}</li>)}</ul>
        {open && <div className="mt-4 space-y-2"><Field label="Yangi yozuv"><textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={note.busy || text.trim().length < 2} onClick={() => void note.run()}>Yuborish</button><label className="btn btn-ghost cursor-pointer">📎 Fayl biriktirish<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void file.run(e.target.files[0])} /></label></div></div>}
      </section>
      {staff && canResolveRole && x.status === 'OPEN' && <button className="btn btn-primary mt-4" disabled={take.busy} onClick={() => void take.run()}>Ko‘rib chiqishga olish</button>}
      {staff && canResolveRole && ['IN_REVIEW', 'APPEALED'].includes(x.status) && <section className="card mt-4 space-y-3 p-4"><h2 className="font-bold">Qaror qabul qilish</h2>
        <Field label="Natija"><select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="COMPLETE">Xaridor tomonidan qabul qilingan deb yakunlash</option><option value="CANCEL">Buyurtmani bekor qilish (qoldiq omborga qaytadi)</option></select></Field>
        <Field label="Qaror matni"><textarea className="input" rows={3} value={res} onChange={(e) => setRes(e.target.value)} /></Field>
        <button className="btn btn-primary" disabled={resolve.busy || res.trim().length < 5} onClick={() => void resolve.run()}>Qarorni saqlash</button></section>}
      {x.canAppeal && <section className="card mt-4 space-y-3 p-4"><h2 className="font-bold">Apellyatsiya (bir marta, Super Admin ko‘radi)</h2><textarea className="input" rows={3} value={appeal} onChange={(e) => setAppeal(e.target.value)} aria-label="Sabab" /><button className="btn btn-ghost" disabled={doAppeal.busy || appeal.trim().length < 3} onClick={() => void doAppeal.run()}>Apellyatsiya berish</button></section>}
    </AppShell>
  );
}
