'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ModerationQueue } from '@/components/ModerationQueue';
import { PageTitle, Tabs } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth-context';
import { money, day } from '@/lib/fmt';
import { useApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
type T = 'stores' | 'products' | 'prices' | 'reviews' | 'complaints' | 'contracts' | 'disputes';
const AR = [{ action: 'APPROVE', label: 'Tasdiqlash' }, { action: 'REJECT', label: 'Rad etish', danger: true }];

export default function Moderation() {
  const { user } = useAuth(); const [tab, setTab] = useState<T>('stores');
  const stats = useApi<any>('/admin/moderator/stats'); const qn = stats.data?.queues ?? {};
  const can = (p: string) => user?.permissions.includes(p);
  const tabs = ([
    ['stores', 'Do‘konlar', can('stores.moderate')], ['products', 'Mahsulotlar', can('catalog.manage')], ['prices', 'Narxlar', can('prices.moderate')], ['reviews', 'Sharhlar', can('reviews.moderate')],
    ['complaints', 'Shikoyatlar', can('complaints.review')], ['contracts', 'Shartnomalar', can('contracts.review')], ['disputes', 'Nizolar', can('disputes.resolve')],
  ] as Array<[T, string, boolean | undefined]>).filter((t) => t[2]).map(([id, label]) => ({ id, label, badge: qn[id] as number | undefined }));
  return (
    <AppShell><PageTitle title="Moderatsiya" sub="Har bir qaror sabab bilan saqlanadi va audit jurnaliga yoziladi." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'stores' && <ModerationQueue path="/moderation/stores" postBase="/moderation/stores" params={{ status: 'PENDING' }} empty="Tekshiruv kutayotgan do‘kon yo‘q" actions={AR}
        render={(s) => <><b>{s.name}</b> <span className="text-sm text-ink-muted">· {s.region?.name} · {s.owner?.profile?.fullName ?? s.owner?.email}</span><p className="text-sm text-ink-muted">Hujjatlar: {s.documents?.length ?? 0} · {day(s.createdAt)}</p></>} />}
      {tab === 'products' && <ModerationQueue path="/moderation/products" postBase="/moderation/products" params={{ status: 'PENDING' }} empty="Tekshiruv kutayotgan mahsulot yo‘q" actions={AR}
        render={(p) => <><b>{p.name}</b> <span className="text-sm text-ink-muted">· {p.category?.name} · {p.unit?.code}</span>{p.description && <p className="text-sm text-ink-soft">{p.description}</p>}</>} />}
      {tab === 'prices' && <ModerationQueue path="/moderation/prices" postBase="/moderation/prices" params={{ status: 'PENDING' }} empty="Tekshiruv kutayotgan narx yo‘q" actions={AR}
        render={(r) => <><b>{r.product.name}</b> — {money(r.price)} / {r.unit} <span className="text-sm text-ink-muted">· {r.store.name} · {r.region}</span><p className="text-sm">{r.regionMedian ? `Hudud mediani: ${money(r.regionMedian)}` : 'Taqqoslash uchun ma’lumot yo‘q'}{r.suspicious && <b className="ml-2 text-danger">⚠ Shubhali farq</b>} · dalil: {r.evidenceCount}</p></>} />}
      {tab === 'reviews' && <ModerationQueue path="/admin/reviews" postBase="/admin/reviews" params={{ status: 'PENDING' }} empty="Tekshiruv kutayotgan sharh yo‘q" actions={AR}
        render={(r) => <><b>{r.store}</b> {'⭐'.repeat(r.rating)}<p className="text-sm text-ink-soft">{r.comment ?? '—'}</p><p className="text-xs text-ink-muted">{r.author}</p></>} />}
      {tab === 'complaints' && <ModerationQueue path="/admin/complaints" postBase="/admin/complaints" params={{ status: 'OPEN' }} reasonKey="note" actionKey="status" empty="Ochiq shikoyat yo‘q"
        actions={[{ action: 'RESOLVED', label: 'Hal qilindi' }, { action: 'REJECTED', label: 'Asossiz', danger: true }]}
        render={(c) => <><b>{c.targetType}</b> <span className="text-xs text-ink-muted">{c.targetId}</span><p className="text-sm">{c.reason}</p>{c.details && <p className="text-sm text-ink-soft">{c.details}</p>}<p className="text-xs text-ink-muted">{c.filedBy} · {day(c.createdAt)}</p></>} />}
      {tab === 'contracts' && <ModerationQueue path="/moderation/contracts" postBase="/moderation/contracts" empty="Tekshiruv kutayotgan shartnoma yo‘q" actions={AR}
        render={(c) => <><Link className="font-bold text-brand-700 underline" href={`/contracts/${c.id}`}>{c.number}</Link> <span className="text-sm text-ink-muted">· {c.sellerStore.name} → {c.buyer.email}</span></>} />}
      {tab === 'disputes' && <DisputesQueue />}
    </AppShell>
  );
}

function DisputesQueue() {
  const q = useApi<any>('/disputes?status=OPEN&pageSize=20'); const r = useApi<any>('/disputes?status=IN_REVIEW&pageSize=20'); const a = useApi<any>('/disputes?status=APPEALED&pageSize=20');
  const rows = [...(q.data?.items ?? []), ...(r.data?.items ?? []), ...(a.data?.items ?? [])];
  return <ul className="space-y-2">{rows.length === 0 && <li className="card p-6 text-center text-ink-muted">Ochiq nizo yo‘q</li>}{rows.map((d: any) => <li key={d.id}><Link className="card flex items-center justify-between p-4 hover:border-brand-300" href={`/disputes/${d.id}`}><span><b>{d.order?.number}</b> · {d.order?.store?.name}</span><span className="text-sm text-ink-muted">{d.status}</span></Link></li>)}</ul>;
}
