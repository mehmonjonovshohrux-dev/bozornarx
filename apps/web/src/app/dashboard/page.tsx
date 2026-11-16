'use client';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ErrorBox, PageTitle, Spinner, Stat, Badge } from '@/components/ui/kit';
import { authApi, type SessionInfo } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL, money, dt } from '@/lib/fmt';
import { useApi, useAction } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <AppShell>
      <PageTitle title={`Salom, ${user?.profile?.fullName?.split(' ')[0] ?? ''}!`} sub={user?.roles.map((r) => ROLE_LABEL[r] ?? r).join(' · ')} />
      <div className="space-y-6">
        {user?.permissions.includes('orders.create') && <BuyerHome />}
        {user?.permissions.includes('stores.manage') && <SellerHome />}
        {user?.permissions.includes('stats.view') && !user.permissions.includes('users.manage') && <ModeratorHome />}
        {user?.permissions.includes('users.manage') && <AdminHome />}
        <Sessions />
      </div>
    </AppShell>
  );
}

function BuyerHome() {
  const q = useApi<any>('/me/stats');
  if (q.loading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  const d = q.data;
  const active = Object.entries(d.orders as Record<string, number>).filter(([s]) => !['COMPLETED', 'CANCELLED'].includes(s)).reduce((a, [, n]) => a + n, 0);
  return (
    <section aria-label="Xaridor">
      <h2 className="mb-3 text-lg font-bold">Xaridor</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/orders"><Stat label="Faol buyurtmalar" value={active} /></Link>
        <Link href="/offers"><Stat label="Ochiq takliflar" value={d.openOffers} /></Link>
        <Link href="/favorites"><Stat label="Sevimlilar" value={d.favorites} /></Link>
        <Link href="/alerts"><Stat label="Narx ogohlantirishlari" value={d.activeAlerts} /></Link>
      </div>
    </section>
  );
}

function SellerHome() {
  const stores = useApi<any[]>('/stores/mine');
  const first = stores.data?.[0];
  const stats = useApi<any>(first ? `/stores/${first.id}/stats` : null);
  if (stores.loading) return <Spinner />;
  if (!first) return <section className="card p-5"><h2 className="text-lg font-bold">Sotuvchi</h2><p className="mt-1 text-ink-soft">Savdoni boshlash uchun do‘kon oching.</p><Link href="/seller" className="btn btn-primary mt-3">Do‘kon ochish</Link></section>;
  const s = stats.data;
  return (
    <section aria-label="Sotuvchi">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">Sotuvchi · {first.name} <Badge tone={first.status === 'VERIFIED' ? 'ok' : 'warn'}>{first.status === 'VERIFIED' ? 'Tasdiqlangan' : 'Tekshiruvda'}</Badge></h2>
      {s && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/seller/orders"><Stat label="Yangi buyurtmalar" value={s.orders.CREATED ?? 0} tone="accent" /></Link>
        <Stat label="30 kunlik savdo" value={money(s.revenue30d)} sub={`${s.completed30d} ta yakunlangan`} />
        <Link href="/seller/prices?stale=true"><Stat label="Eskirgan narxlar" value={s.prices.stale} sub={`jami ${s.prices.total}`} /></Link>
        <Link href="/seller/offers"><Stat label="Kutilayotgan takliflar" value={s.pendingOffers} /></Link>
      </div>}
    </section>
  );
}

function ModeratorHome() {
  const q = useApi<any>('/admin/moderator/stats');
  if (q.loading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  const qs = q.data.queues;
  return (
    <section aria-label="Moderator"><h2 className="mb-3 text-lg font-bold">Moderatsiya navbati</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries({ products: 'Mahsulotlar', prices: 'Narxlar', stores: 'Do‘konlar', reviews: 'Sharhlar', contracts: 'Shartnomalar', disputes: 'Nizolar', complaints: 'Shikoyatlar' }).map(([k, l]) => <Link key={k} href="/moderation"><Stat label={l} value={qs[k] ?? 0} tone={qs[k] ? 'accent' : 'brand'} /></Link>)}
      </div>
      <p className="mt-2 text-sm text-ink-muted">Siz 7 kunda {q.data.myActions7d} ta qaror qabul qildingiz.</p>
    </section>
  );
}

function AdminHome() {
  const q = useApi<any>('/admin/stats');
  if (q.loading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  const d = q.data;
  return (
    <section aria-label="Admin"><h2 className="mb-3 text-lg font-bold">Platforma</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faol foydalanuvchilar" value={d.users.active} />
        <Stat label="Faol narxlar" value={d.livePrices} />
        <Stat label="30 kunlik hajm" value={money(d.volume30d)} sub={`${d.completed30d} ta bitim`} />
        <Link href="/admin"><Stat label="Ochiq nizolar / shikoyatlar" value={`${d.openDisputes} / ${d.openComplaints}`} tone="accent" /></Link>
      </div>
    </section>
  );
}

function Sessions() {
  const q = useApi<SessionInfo[]>('/auth/sessions');
  const revoke = useAction(async (id: string) => { await authApi.revokeSession(id); q.reload(); });
  return (
    <section className="card p-5"><h2 className="text-lg font-bold">Faol seanslar</h2>
      <ErrorBox error={q.error ?? revoke.error} />
      {q.loading && <Spinner />}
      <ul className="mt-2 divide-y divide-cream-300">
        {q.data?.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{s.userAgent ?? 'Noma’lum qurilma'}</p><p className="text-xs text-ink-muted">{s.ip ?? ''} · {dt(s.lastUsedAt)}</p></div>
            {s.current ? <Badge tone="ok">Shu qurilma</Badge> : <button className="text-sm font-semibold text-danger" disabled={revoke.busy} onClick={() => void revoke.run(s.id)}>Chiqarish</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
