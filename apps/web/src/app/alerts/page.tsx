'use client';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Badge, Empty, ErrorBox, PageTitle, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { dt, money } from '@/lib/fmt';
import { useAction, useApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Alerts() {
  const q = useApi<any[]>('/alerts');
  const toggle = useAction(async (id: string, active: boolean) => { await api(`/alerts/${id}/toggle`, { body: { active } }); q.reload(); });
  const del = useAction(async (id: string) => { await api(`/alerts/${id}`, { method: 'DELETE' }); q.reload(); });
  return (
    <AppShell><PageTitle title="Narx ogohlantirishlari" sub="Yangi ogohlantirish mahsulot sahifasidan yaratiladi. Shart bajarilganda bildirishnoma olasiz (sozlamalar: Bildirishnomalar bo‘limida)." />
      <ErrorBox error={q.error ?? toggle.error ?? del.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.length === 0 && <Empty title="Ogohlantirishlar yo‘q" action={<Link href="/catalog" className="btn btn-primary mt-2">Katalog</Link>} />}
      <ul className="space-y-3">{q.data?.map((a) => (
        <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div><Link href={`/catalog/${a.product.slug}`} className="font-bold hover:underline">{a.product.name}</Link><p className="text-sm text-ink-soft">{a.direction === 'BELOW' ? 'Narx pastga tushsa' : 'Narx oshsa'}: {money(a.targetPrice)} / {a.unitCode}</p>{a.lastTriggeredAt && <p className="text-xs text-ink-muted">Oxirgi xabar: {dt(a.lastTriggeredAt)}</p>}</div>
          <div className="flex items-center gap-3"><Badge tone={a.active ? 'ok' : 'muted'}>{a.active ? 'Faol' : 'O‘chirilgan'}</Badge>
            <button className="text-sm font-semibold text-brand-700" onClick={() => void toggle.run(a.id, !a.active)}>{a.active ? 'To‘xtatish' : 'Yoqish'}</button><button className="text-sm font-semibold text-danger" onClick={() => void del.run(a.id)}>O‘chirish</button></div>
        </li>))}</ul>
    </AppShell>
  );
}
