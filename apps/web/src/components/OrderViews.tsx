'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Field, Modal, Pager, Spinner, Table, statusTone } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { CONTRACT_STATUS, ORDER_STATUS, day, dt, money } from '@/lib/fmt';
import { qs, uploadFile, useAction, useApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function OrderList({ as }: { as: 'buyer' | 'seller' }) {
  const [page, setPage] = useState(1); const [status, setStatus] = useState('');
  const q = useApi<Paged<any>>(`/orders${qs({ as, status, page, pageSize: 15 })}`);
  return (
    <>
      <select className="input mb-4 !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Holat"><option value="">Barcha holatlar</option>{Object.entries(ORDER_STATUS).filter(([k]) => k !== 'PENDING' && k !== 'REJECTED').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Buyurtmalar yo‘q" />}
      {q.data && q.data.items.length > 0 && (
        <Table head={['Raqam', as === 'buyer' ? 'Do‘kon' : 'Xaridor', 'Holat', 'Summa', 'Sana']}>
          {q.data.items.map((o) => (
            <tr key={o.id} className="hover:bg-cream-50"><td className="px-4 py-3 font-semibold"><Link className="text-brand-700 underline" href={`/orders/${o.id}`}>{o.number}</Link></td>
              <td className="px-4 py-3">{as === 'buyer' ? o.store.name : o.buyerName ?? '—'}</td><td className="px-4 py-3"><Badge tone={statusTone(o.status)}>{ORDER_STATUS[o.status] ?? o.status}</Badge></td>
              <td className="px-4 py-3">{money(o.totalAmount)}</td><td className="px-4 py-3 text-ink-muted">{day(o.createdAt)}</td></tr>
          ))}
        </Table>
      )}
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
    </>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const o = useApi<any>(`/orders/${id}`);
  const [modal, setModal] = useState<null | 'cancel' | 'review' | 'dispute' | 'ship'>(null);
  const act = useAction(async (to: string, extra: Record<string, unknown> = {}) => { await api(`/orders/${id}/transition`, { body: { to, ...extra } }); setModal(null); o.reload(); });
  const cash = useAction(async () => { await api(`/orders/${id}/payments/cash-received`, { method: 'POST', body: {} }); o.reload(); });
  const evidence = useAction(async (f: File) => { const up = await uploadFile(f, 'EVIDENCE'); await api(`/orders/${id}/delivery-evidence`, { body: { fileId: up.id } }); o.reload(); });
  if (o.loading && !o.data) return <Spinner />;
  if (o.error) return <ErrorBox error={o.error} retry={o.reload} />;
  const d = o.data; const seller = d.myRole === 'seller';
  const canCash = seller && d.paymentMethod === 'CASH_ON_DELIVERY' && !d.settled && ['DELIVERED', 'ACCEPTED'].includes(d.status);
  const LABEL: Record<string, string> = { CONFIRMED: 'Tasdiqlash', PROCESSING: 'Tayyorlashni boshlash', READY: 'Tayyor', SHIPPED: 'Yo‘lga chiqarish', DELIVERED: 'Yetkazildi', ACCEPTED: 'Qabul qildim', COMPLETED: 'Yakunlash', CANCELLED: 'Bekor qilish' };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold text-brand-800">{d.number}</h1><p className="text-ink-muted">{d.store.name} · {dt(d.createdAt)}</p></div>
        <Badge tone={statusTone(d.status)}>{ORDER_STATUS[d.status] ?? d.status}</Badge>
      </div>
      <ErrorBox error={act.error ?? cash.error ?? evidence.error} />
      <div className="flex flex-wrap gap-2">
        {d.actions.map((a: string) => a === 'CANCELLED' ? <button key={a} className="btn btn-ghost !text-danger" onClick={() => setModal('cancel')}>Bekor qilish</button>
          : a === 'SHIPPED' ? <button key={a} className="btn btn-primary" onClick={() => setModal('ship')}>{LABEL[a]}</button>
          : <button key={a} className="btn btn-primary" disabled={act.busy} onClick={() => void act.run(a)}>{LABEL[a] ?? a}</button>)}
        {canCash && <button className="btn btn-accent" disabled={cash.busy} onClick={() => void cash.run()}>💵 Naqd to‘lov olindi</button>}
        {!seller && d.status === 'COMPLETED' && <button className="btn btn-ghost" onClick={() => setModal('review')}>⭐ Sharh qoldirish</button>}
        {d.myRole !== 'staff' && !['COMPLETED', 'CANCELLED', 'DISPUTED', 'CREATED'].includes(d.status) && <button className="btn btn-ghost" onClick={() => setModal('dispute')}>⚖️ Nizo ochish</button>}
        {seller && ['SHIPPED', 'DELIVERED', 'READY'].includes(d.status) && <label className="btn btn-ghost cursor-pointer">📎 Yetkazish dalili<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void evidence.run(e.target.files[0])} /></label>}
        <Link className="btn btn-ghost" href={`/chat?store=${d.store.id}`}>💬 Chat</Link>
        {['DELIVERED', 'ACCEPTED', 'COMPLETED'].includes(d.status) && <a className="btn btn-ghost" href={`/api/orders/${id}/delivery-act`} target="_blank" rel="noreferrer">📄 Dalolatnoma (PDF)</a>}
      </div>
      <section className="card p-4"><h2 className="mb-2 font-bold">Mahsulotlar</h2>
        <ul className="divide-y divide-cream-200">{d.items.map((i: any) => <li key={i.id} className="flex justify-between gap-3 py-2"><span>{i.product.name}{i.variant ? ` (${i.variant})` : ''} × {i.quantity} {i.unit}</span><span className="font-semibold">{money(i.lineTotal)}</span></li>)}</ul>
        <dl className="mt-3 space-y-1 border-t border-cream-200 pt-3 text-sm">
          {d.discountAmount > 0 && <div className="flex justify-between"><dt>Chegirma {d.couponCode && `(${d.couponCode})`}</dt><dd>−{money(d.discountAmount)}</dd></div>}
          {d.deliveryFee > 0 && <div className="flex justify-between"><dt>Yetkazib berish</dt><dd>{money(d.deliveryFee)}</dd></div>}
          <div className="flex justify-between text-lg font-extrabold"><dt>Jami</dt><dd>{money(d.totalAmount)}</dd></div></dl></section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4 text-sm"><h2 className="mb-2 font-bold">Yetkazib berish va to‘lov</h2>
          <p>{d.deliveryMethod === 'DELIVERY' ? `🚚 ${d.deliveryAddress}` : 'O‘zi olib ketadi'}</p><p>To‘lov: {d.paymentMethod === 'CARD' ? 'Karta' : 'Naqd'} — {d.settled ? <b className="text-brand-700">to‘langan</b> : 'to‘lanmagan'}</p>
          {d.note && <p className="text-ink-muted">Izoh: {d.note}</p>}{d.buyer && <p className="mt-2">Xaridor: {d.buyer.name} {d.buyer.phone && `· ${d.buyer.phone}`}</p>}</section>
        <section className="card p-4 text-sm"><h2 className="mb-2 font-bold">Shartnoma</h2>
          {d.contract ? <p><Link className="font-semibold text-brand-700 underline" href={`/contracts/${d.contract.id}`}>{d.contract.number}</Link> — <Badge tone={statusTone(d.contract.status)}>{CONTRACT_STATUS[d.contract.status] ?? d.contract.status}</Badge></p> : <p className="text-ink-muted">Sotuvchi tasdiqlagach shartnoma avtomatik yaratiladi.</p>}
          {d.disputes.map((x: any) => <p key={x.id} className="mt-2"><Link className="text-brand-700 underline" href={`/disputes/${x.id}`}>Nizo</Link> — {x.status}</p>)}</section>
      </div>
      <section className="card p-4"><h2 className="mb-2 font-bold">Tarix</h2><ol className="space-y-1 text-sm">{d.events.map((e: any) => <li key={e.id}><span className="text-ink-muted">{dt(e.createdAt)}</span> — {ORDER_STATUS[e.toState] ?? e.toState}{e.note ? `: ${e.note}` : ''}</li>)}</ol></section>
      <NoteModal open={modal === 'cancel'} title="Buyurtmani bekor qilish" label="Sabab" required busy={act.busy} onClose={() => setModal(null)} onOk={(note) => void act.run('CANCELLED', { note })} />
      <ShipModal open={modal === 'ship'} busy={act.busy} onClose={() => setModal(null)} onOk={(x) => void act.run('SHIPPED', x)} />
      <ReviewModal open={modal === 'review'} orderId={id} onClose={() => { setModal(null); o.reload(); }} />
      <DisputeModal open={modal === 'dispute'} orderId={id} onClose={() => setModal(null)} />
    </div>
  );
}

function NoteModal({ open, title, label, required, busy, onClose, onOk }: { open: boolean; title: string; label: string; required?: boolean; busy?: boolean; onClose: () => void; onOk: (v: string) => void }) {
  const [v, setV] = useState('');
  return <Modal open={open} title={title} onClose={onClose}><Field label={label}><textarea className="input" rows={3} value={v} onChange={(e) => setV(e.target.value)} /></Field><button className="btn btn-primary mt-4 w-full" disabled={busy || (required && v.trim().length < 3)} onClick={() => onOk(v.trim())}>Tasdiqlash</button></Modal>;
}
function ShipModal({ open, busy, onClose, onOk }: { open: boolean; busy?: boolean; onClose: () => void; onOk: (x: { carrier?: string; trackingRef?: string }) => void }) {
  const [c, setC] = useState(''); const [t, setT] = useState('');
  return <Modal open={open} title="Yetkazib berish ma’lumoti" onClose={onClose}><div className="space-y-3"><Field label="Kuryer / transport"><input className="input" value={c} onChange={(e) => setC(e.target.value)} /></Field><Field label="Kuzatuv raqami"><input className="input" value={t} onChange={(e) => setT(e.target.value)} /></Field><button className="btn btn-primary w-full" disabled={busy} onClick={() => onOk({ carrier: c || undefined, trackingRef: t || undefined })}>Yo‘lga chiqdi</button></div></Modal>;
}
function ReviewModal({ open, orderId, onClose }: { open: boolean; orderId: string; onClose: () => void }) {
  const [r, setR] = useState(5); const [c, setC] = useState('');
  const a = useAction(async () => { await api(`/orders/${orderId}/review`, { body: { rating: r, comment: c || undefined } }); onClose(); });
  return <Modal open={open} title="Sotuvchini baholang" onClose={onClose}><div className="space-y-3"><div className="flex gap-1" role="radiogroup" aria-label="Baho">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={r === n} onClick={() => setR(n)} className={`text-3xl ${n <= r ? '' : 'opacity-30'}`}>⭐</button>)}</div><Field label="Izoh"><textarea className="input" rows={3} value={c} onChange={(e) => setC(e.target.value)} /></Field><ErrorBox error={a.error} /><button className="btn btn-primary w-full" disabled={a.busy} onClick={() => void a.run()}>Yuborish</button><p className="text-xs text-ink-muted">Sharh moderator tekshiruvidan so‘ng ko‘rinadi.</p></div></Modal>;
}
function DisputeModal({ open, orderId, onClose }: { open: boolean; orderId: string; onClose: () => void }) {
  const [reason, setReason] = useState(''); const [desc, setDesc] = useState(''); const [id, setId] = useState<string | null>(null);
  const a = useAction(async () => { const d = await api<{ id: string }>('/disputes', { body: { orderId, reason, details: desc || undefined } }); setId(d.id); });
  return <Modal open={open} title="Nizo ochish" onClose={onClose}>{id ? <p>Nizo ochildi. <Link className="font-bold text-brand-700 underline" href={`/disputes/${id}`}>Ko‘rish</Link></p> : <div className="space-y-3"><Field label="Sabab"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Field label="Tavsif"><textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field><ErrorBox error={a.error} /><button className="btn btn-primary w-full" disabled={a.busy || reason.trim().length < 5} onClick={() => void a.run()}>Nizo ochish</button></div>}</Modal>;
}
