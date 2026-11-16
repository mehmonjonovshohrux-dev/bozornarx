'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Empty, ErrorBox, PageTitle, Spinner, Tabs } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ago } from '@/lib/fmt';
import { onRealtime } from '@/lib/realtime';
import { useApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
function Chats() {
  const { user } = useAuth(); const router = useRouter(); const sp = useSearchParams();
  const [as, setAs] = useState<'buyer' | 'seller'>(user?.permissions.includes('stores.manage') && !user.permissions.includes('orders.create') ? 'seller' : 'buyer');
  const q = useApi<Paged<any>>(`/chat/conversations?as=${as}`);
  const store = sp.get('store');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (store) api<{ id: string }>('/chat/conversations', { body: { storeId: store } }).then((c) => router.replace(`/chat/${c.id}`)).catch((e) => setErr(e.message)); }, [store, router]);
  useEffect(() => onRealtime((ev) => { if (ev === 'message' || ev === 'read') q.reload(); }), [q]);
  return (
    <>
      <PageTitle title="Chat" sub="Do‘konlar bilan real vaqtda yozishing." />
      {user?.permissions.includes('stores.manage') && user.permissions.includes('orders.create') && <Tabs tabs={[{ id: 'buyer', label: 'Men yozganlar' }, { id: 'seller', label: 'Do‘konimga yozganlar' }]} value={as} onChange={setAs} />}
      <ErrorBox error={err ?? q.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Suhbatlar yo‘q" hint="Mahsulot sahifasida “Sotuvchiga yozish” tugmasini bosing." />}
      <ul className="space-y-2">{q.data?.items.map((c) => (
        <li key={c.id}><Link href={`/chat/${c.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-brand-300">
          <div className="min-w-0"><p className="font-bold">{as === 'buyer' ? c.store.name : c.buyerName ?? 'Xaridor'}</p><p className="truncate text-sm text-ink-soft">{c.last ? `${c.last.mine ? 'Siz: ' : ''}${c.last.body ?? '📎 Fayl'}` : 'Xabar yo‘q'}</p></div>
          <div className="text-right text-xs text-ink-muted">{c.lastMessageAt && ago(c.lastMessageAt)}{c.unread > 0 && <p className="mt-1 rounded-full bg-accent-500 px-2 py-0.5 font-bold text-white">{c.unread}</p>}</div></Link></li>))}</ul>
    </>
  );
}
export default function ChatPage() { return <AppShell><Suspense fallback={<Spinner />}><Chats /></Suspense></AppShell>; }
