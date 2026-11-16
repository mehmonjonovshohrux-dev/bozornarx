'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Empty, ErrorBox, Field, Modal, PageTitle, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { money, PAYMENT_METHOD } from '@/lib/fmt';
import { useAction, useApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function CartPage() {
  const cart = useApi<any>('/cart');
  const [checkout, setCheckout] = useState<any>(null);
  const upd = useAction(async (id: string, quantity: number) => { await api(`/cart/items/${id}`, { method: 'PATCH', body: { quantity } }); cart.reload(); });
  const del = useAction(async (id: string) => { await api(`/cart/items/${id}`, { method: 'DELETE' }); cart.reload(); });
  return (
    <AppShell>
      <PageTitle title="Savat" sub="Har bir do‘kon uchun alohida buyurtma beriladi." />
      <ErrorBox error={cart.error ?? upd.error ?? del.error} retry={cart.reload} />
      {cart.loading && !cart.data && <Spinner />}
      {cart.data && cart.data.items.length === 0 && <Empty title="Savat bo‘sh" hint="Katalogdan mahsulot tanlang." action={<Link href="/catalog" className="btn btn-primary mt-2">Katalogga o‘tish</Link>} />}
      <div className="space-y-5">
        {cart.data?.stores.map((s: any) => (
          <section key={s.store.id} className="card p-4">
            <h2 className="mb-3 text-lg font-bold text-brand-800">{s.store.name}</h2>
            <ul className="divide-y divide-cream-200">
              {cart.data.items.filter((i: any) => i.store.id === s.store.id).map((i: any) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><Link href={`/catalog/${i.product.slug}`} className="font-semibold hover:underline">{i.product.name}</Link>{i.variant && <span className="text-sm text-ink-muted"> · {i.variant}</span>}
                    <p className="text-sm text-ink-muted">{money(i.unitPrice)} / {i.unit}</p>{!i.available && <Badge tone="bad">Hozir mavjud emas yoki yetarli emas</Badge>}</div>
                  <div className="flex items-center gap-2">
                    <input aria-label="Miqdor" className="input !w-24 !min-h-[40px]" inputMode="decimal" defaultValue={i.quantity} onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== i.quantity) void upd.run(i.id, v); }} />
                    <span className="w-24 text-right font-bold">{money(i.lineTotal)}</span>
                    <button className="p-2 text-danger" aria-label="O‘chirish" onClick={() => void del.run(i.id)}>🗑️</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="text-lg font-extrabold">Jami: {money(s.total)}</div>
              <button className="btn btn-accent" disabled={!s.allAvailable} onClick={() => setCheckout(s)}>Buyurtma berish</button></div>
          </section>
        ))}
      </div>
      <Checkout store={checkout} onClose={() => setCheckout(null)} />
    </AppShell>
  );
}

function Checkout({ store, onClose }: { store: any; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ deliveryMethod: 'PICKUP', deliveryAddress: '', note: '', couponCode: '', paymentMethod: 'CASH_ON_DELIVERY' });
  const go = useAction(async () => {
    const o = await api<{ id: string }>('/orders/checkout', { body: { storeId: store.store.id, ...f, deliveryAddress: f.deliveryMethod === 'DELIVERY' ? f.deliveryAddress : undefined, note: f.note || undefined, couponCode: f.couponCode || undefined } });
    router.push(`/orders/${o.id}`);
  });
  return (
    <Modal open={!!store} title={`Buyurtma: ${store?.store.name ?? ''}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Qabul qilish usuli"><select className="input" value={f.deliveryMethod} onChange={(e) => setF({ ...f, deliveryMethod: e.target.value })}><option value="PICKUP">O‘zim olib ketaman</option><option value="DELIVERY">Yetkazib berish</option></select></Field>
        {f.deliveryMethod === 'DELIVERY' && <Field label="Manzil"><textarea className="input" rows={2} value={f.deliveryAddress} onChange={(e) => setF({ ...f, deliveryAddress: e.target.value })} /></Field>}
        <Field label="To‘lov usuli" hint="Karta orqali to‘lov hozircha ulanmagan: naqd to‘lov ishlaydi."><select className="input" value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value })}><option value="CASH_ON_DELIVERY">{PAYMENT_METHOD.CASH_ON_DELIVERY}</option><option value="CARD" disabled>{PAYMENT_METHOD.CARD}</option></select></Field>
        <Field label="Chegirma kodi (ixtiyoriy)"><input className="input uppercase" value={f.couponCode} onChange={(e) => setF({ ...f, couponCode: e.target.value })} /></Field>
        <Field label="Izoh (ixtiyoriy)"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <ErrorBox error={go.error} />
        <button className="btn btn-primary w-full" disabled={go.busy || (f.deliveryMethod === 'DELIVERY' && f.deliveryAddress.trim().length < 5)} onClick={() => void go.run()}>Buyurtmani tasdiqlash</button>
      </div>
    </Modal>
  );
}
