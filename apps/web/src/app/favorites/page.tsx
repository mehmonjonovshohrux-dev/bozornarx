'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Empty, ErrorBox, PageTitle, Pager, ProductImage, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAction, useApi, qs, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Favorites() {
  const [page, setPage] = useState(1);
  const q = useApi<Paged<any>>(`/favorites${qs({ page, pageSize: 12 })}`);
  const rm = useAction(async (id: string) => { await api(`/favorites/${id}`, { method: 'DELETE' }); q.reload(); });
  return (
    <AppShell><PageTitle title="Sevimlilar" />
      <ErrorBox error={q.error ?? rm.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Sevimli mahsulotlar yo‘q" action={<Link href="/catalog" className="btn btn-primary mt-2">Katalog</Link>} />}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{q.data?.items.map((f) => (
        <li key={f.productId} className="card overflow-hidden"><Link href={`/catalog/${f.slug}`}><ProductImage id={f.imageId} alt={f.name} className="h-32 w-full" /><p className="px-4 pt-3 font-bold">{f.name}</p></Link>
          <button className="px-4 py-3 text-sm font-semibold text-danger" onClick={() => void rm.run(f.productId)}>Olib tashlash</button></li>))}</ul>
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
    </AppShell>
  );
}
