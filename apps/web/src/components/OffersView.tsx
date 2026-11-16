'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Field, Modal, Pager, Spinner, statusTone } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { OFFER_STATUS, dt, money } from '@/lib/fmt';
import { qs, useAction, useApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function OffersView({ as }: { as: 'buyer' | 'seller' }) {
  const [page, setPage] = useState(1);
  const q = useApi<Paged<any>>(`/offers${qs({ as, page, pageSize: 15 })}`);
  const [counter, setCounter] = useState<any>(null); const [price, setPrice] = useState('');
  const respond = useAction(async (id: string, action: string, counterUnitPrice?: number) => { await api(`/offers/${id}/respond`, { body: { action, counterUnitPrice } }); setCounter(null); q.reload(); });
  const accept = useAction(async (id: string) => { const r = await api<{ orderId?: string }>(`/offers/${id}/accept-counter`, { method: 'POST', body: {} }); q.reload(); if (r?.orderId) location.href = `/orders/${r.orderId}`; });
  const cancel = useAction(async (id: string) => { await api(`/offers/${id}/cancel`, { method: 'POST', body: {} }); q.reload(); });
  return (
    <>
      <ErrorBox error={q.error ?? respond.error ?? accept.error ?? cancel.error} retry={q.reload} />
      {q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Takliflar yo‘q" hint={as === 'buyer' ? 'Mahsulot sahifasida “Sotib olish → Narx taklif qilish” orqali taklif yuboring.' : undefined} />}
      <ul className="space-y-3">
        {q.data?.items.map((o) => (
          <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-bold">{o.product?.name ?? 'Mahsulot'} <span className="font-normal text-ink-muted">· {o.storeName}</span></p>
              <p className="text-sm text-ink-soft">{o.quantity} {o.unit} · taklif {money(o.offeredUnitPrice)} (e’lon {money(o.listedPrice)})</p>
              {o.counterUnitPrice && <p className="text-sm font-semibold text-accent-600">Qarshi taklif: {money(o.counterUnitPrice)}</p>}
              {o.message && <p className="text-sm text-ink-muted">“{o.message}”</p>}<p className="text-xs text-ink-muted">{dt(o.createdAt)} · muddat {dt(o.expiresAt)}</p></div>
            <div className="flex flex-col items-end gap-2">
              <Badge tone={statusTone(o.status)}>{OFFER_STATUS[o.status] ?? o.status}</Badge>
              {o.orderId && <Link className="text-sm font-semibold text-brand-700 underline" href={`/orders/${o.orderId}`}>Buyurtma</Link>}
              {as === 'seller' && o.status === 'PENDING' && <div className="flex gap-2"><button className="btn btn-primary !min-h-[38px] !px-3" disabled={respond.busy} onClick={() => void respond.run(o.id, 'ACCEPT')}>Qabul</button><button className="btn btn-ghost !min-h-[38px] !px-3" onClick={() => { setCounter(o); setPrice(''); }}>Qarshi narx</button><button className="btn btn-ghost !min-h-[38px] !px-3 !text-danger" disabled={respond.busy} onClick={() => void respond.run(o.id, 'REJECT')}>Rad</button></div>}
              {as === 'buyer' && o.status === 'COUNTERED' && <button className="btn btn-primary !min-h-[38px]" disabled={accept.busy} onClick={() => void accept.run(o.id)}>Qarshi taklifni qabul qilish</button>}
              {as === 'buyer' && ['PENDING', 'COUNTERED'].includes(o.status) && <button className="text-sm font-semibold text-danger" disabled={cancel.busy} onClick={() => void cancel.run(o.id)}>Bekor qilish</button>}
            </div>
          </li>
        ))}
      </ul>
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
      <Modal open={!!counter} title="Qarshi narx" onClose={() => setCounter(null)}>
        <Field label="Narx (so‘m / birlik)" hint={counter ? `Xaridor taklifi: ${money(counter.offeredUnitPrice)}, e’lon: ${money(counter.listedPrice)}` : undefined}><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <button className="btn btn-primary mt-4 w-full" disabled={respond.busy || !(Number(price) > 0)} onClick={() => void respond.run(counter.id, 'COUNTER', Number(price))}>Yuborish</button>
      </Modal>
    </>
  );
}
