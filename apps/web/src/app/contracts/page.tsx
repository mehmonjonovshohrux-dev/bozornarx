'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, Empty, ErrorBox, Field, Modal, PageTitle, Pager, Spinner, Table, Tabs, statusTone } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { TermsForm } from '@/components/TermsForm';
import { useAuth } from '@/lib/auth-context';
import { CONTRACT_STATUS, day } from '@/lib/fmt';
import { qs, useAction, useApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tab = 'buyer' | 'seller' | 'archive';
export default function Contracts() {
  const { user } = useAuth();
  const isStaff = !!user?.roles?.some((r: string) => r === 'SUPER_ADMIN' || r === 'MODERATOR');
  const isSeller = !isStaff && !!user?.permissions.includes('stores.manage');
  const [tab, setTab] = useState<Tab>('buyer'); const [page, setPage] = useState(1); const [open, setOpen] = useState(false);
  const q = useApi<Paged<any>>(`/contracts${qs({ as: tab === 'seller' ? 'seller' : 'buyer', archive: tab === 'archive', page, pageSize: 15 })}`);
  const tabs: Array<{ id: Tab; label: string }> = [{ id: 'buyer', label: isStaff ? 'Barcha shartnomalar' : 'Xaridor sifatida' }, ...(isSeller ? [{ id: 'seller' as Tab, label: 'Sotuvchi sifatida' }] : []), { id: 'archive', label: 'Imzolanganlar arxivi' }];
  return (
    <AppShell>
      <PageTitle title="Shartnomalar" sub={isStaff ? 'Barcha shartnomalar (faqat ko‘rish). Raqamni bossangiz tafsilotlari ochiladi.' : 'Buyurtma tasdiqlanganda shartnoma avtomatik yaratiladi. Qo‘lda ham tuzish mumkin.'} action={isSeller && <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Yangi shartnoma</button>} />
      <Tabs tabs={tabs} value={tab} onChange={(t) => { setTab(t); setPage(1); }} />
      <ErrorBox error={q.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Shartnomalar yo‘q" />}
      {q.data && q.data.items.length > 0 && <Table head={['Raqam', isStaff ? 'Do‘kon · Xaridor' : 'Do‘kon / Xaridor', 'Buyurtma', 'Holat', 'Muddat']}>{q.data.items.map((c) => (
        <tr key={c.id}><td className="px-4 py-3"><Link className="font-semibold text-brand-700 underline" href={`/contracts/${c.id}`}>{c.number}</Link></td>
          <td className="px-4 py-3">{isStaff ? `${c.storeName} · ${c.buyerName}` : tab === 'seller' ? c.buyerName : c.storeName}</td><td className="px-4 py-3">{c.orderNumber ?? '—'}</td>
          <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{CONTRACT_STATUS[c.status] ?? c.status}</Badge></td><td className="px-4 py-3 text-ink-muted">{day(c.signedAt ?? c.expiresAt)}</td></tr>))}</Table>}
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
      <NewContract open={open} onClose={() => setOpen(false)} />
    </AppShell>
  );
}

function NewContract({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stores = useApi<any[]>(open ? '/stores/mine' : null);
  const [type, setType] = useState('SALE'); const [store, setStore] = useState(''); const [email, setEmail] = useState('');
  const go = useAction(async (terms: any) => { const c = await api<{ id: string }>('/contracts', { body: { type, sellerStoreId: store || stores.data?.[0]?.id, buyerEmail: email, terms } }); location.href = `/contracts/${c.id}`; });
  return (
    <Modal open={open} title="Yangi shartnoma" onClose={onClose}>
      <div className="mb-3 space-y-3">
        <Field label="Turi"><select className="input" value={type} onChange={(e) => setType(e.target.value)}>{['SALE', 'DELIVERY', 'WHOLESALE', 'SUPPLY', 'PARTNERSHIP', 'SERVICE'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Do‘kon"><select className="input" value={store} onChange={(e) => setStore(e.target.value)}>{stores.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Xaridor emaili (ro‘yxatdan o‘tgan)"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      </div>
      <TermsForm busy={go.busy} error={go.error} onSubmit={(t) => void go.run(t)} submitLabel="Qoralama yaratish" />
    </Modal>
  );
}
