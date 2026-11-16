'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Empty, ErrorBox, PageTitle, Pager, Spinner, Table, statusTone } from '@/components/ui/kit';
import { DISPUTE_STATUS, day, money } from '@/lib/fmt';
import { qs, useApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Disputes() {
  const [page, setPage] = useState(1);
  const q = useApi<Paged<any>>(`/disputes${qs({ page, pageSize: 15 })}`);
  return (
    <AppShell><PageTitle title="Nizolar markazi" sub="Nizoni buyurtma sahifasidan ochasiz. Moderator tomonlarning dalillarini ko‘rib hal qiladi." />
      <ErrorBox error={q.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Nizolar yo‘q" />}
      {q.data && q.data.items.length > 0 && <Table head={['Buyurtma', 'Do‘kon', 'Summa', 'Holat', 'Sana']}>{q.data.items.map((d) => (
        <tr key={d.id}><td className="px-4 py-3"><Link className="font-semibold text-brand-700 underline" href={`/disputes/${d.id}`}>{d.order?.number}</Link></td><td className="px-4 py-3">{d.order?.store?.name}</td><td className="px-4 py-3">{money(d.order?.totalAmount && Number(d.order.totalAmount))}</td>
          <td className="px-4 py-3"><Badge tone={statusTone(d.status)}>{DISPUTE_STATUS[d.status] ?? d.status}</Badge></td><td className="px-4 py-3 text-ink-muted">{day(d.createdAt)}</td></tr>))}</Table>}
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
    </AppShell>
  );
}
