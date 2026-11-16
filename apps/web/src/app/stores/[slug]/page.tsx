'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ReportButton } from '@/components/ReportButton';
import { PageShell } from '@/components/PageShell';
import { Badge, ErrorBox, Pager, Spinner, Stat } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { day, money } from '@/lib/fmt';
import { qs, useAction, usePublicApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function StorePage() {
  const { slug } = useParams<{ slug: string }>(); const { user } = useAuth(); const router = useRouter();
  const s = usePublicApi<any>(`/catalog/stores/${slug}`);
  const [page, setPage] = useState(1);
  const id: string | undefined = s.data?.id;
  const reviews = usePublicApi<Paged<any>>(id ? `/stores/${id}/reviews${qs({ page, pageSize: 10 })}` : null);
  const prods = usePublicApi<Paged<any>>(id ? `/catalog/products${qs({ storeId: id, pageSize: 24 })}` : null);
  const chat = useAction(async () => { const c = await api<{ id: string }>('/chat/conversations', { body: { storeId: id } }); router.push(`/chat/${c.id}`); });
  if (s.loading && !s.data) return <PageShell><Spinner /></PageShell>;
  if (s.error) return <PageShell><ErrorBox error={s.error} /></PageShell>;
  const d = s.data;
  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold text-brand-800">{d.name}</h1><p className="text-ink-muted">{d.region.name}{d.market ? ` · ${d.market.name}` : ''} · {day(d.createdAt)} dan</p></div>
        <div className="flex items-center gap-2">{d.verified ? <Badge tone="ok">✓ Tasdiqlangan</Badge> : <Badge tone="warn">Tekshiruvda</Badge>}{user?.permissions.includes('chat.use') && <button className="btn btn-primary" disabled={chat.busy} onClick={() => void chat.run()}>💬 Yozish</button>}</div>
      </div>
      {d.description && <p className="mb-4 text-ink-soft">{d.description}</p>}
      <div className="mb-4"><ReportButton targetType="STORE" targetId={d.id} /></div>
      <div className="mb-5 grid grid-cols-3 gap-3"><Stat label="Reyting" value={d.rating ? `${d.rating} ⭐` : '—'} sub={`${d.reviewsCount} sharh`} /><Stat label="Faol narxlar" value={d.offersCount} /><Stat label="Holat" value={d.verified ? 'Tasdiqlangan' : 'Kutilmoqda'} /></div>
      <h2 className="mb-2 text-lg font-bold">Mahsulotlar</h2>
      <ul className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{prods.data?.items.map((p) => <li key={p.id}><Link className="card block p-3 hover:border-brand-300" href={`/catalog/${p.slug}`}><b>{p.name}</b><p className="text-sm text-ink-muted">{p.cheapest ? `${money(p.cheapest.perBase)} / ${p.cheapest.baseUnit}` : ''}</p></Link></li>)}</ul>
      <h2 className="mb-2 text-lg font-bold">Sharhlar</h2>
      {reviews.data?.items.length === 0 && <p className="text-ink-muted">Hali sharhlar yo‘q.</p>}
      <ul className="space-y-2">{reviews.data?.items.map((r) => <li key={r.id} className="card p-3"><p>{'⭐'.repeat(r.rating)} <span className="text-sm text-ink-muted">{r.author} · {day(r.createdAt)}</span></p>{r.comment && <p className="text-ink-soft">{r.comment}</p>}</li>)}</ul>
      {reviews.data && <Pager page={page} pages={reviews.data.pages ?? 1} onPage={setPage} />}
    </PageShell>
  );
}
