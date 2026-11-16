'use client';
import { AppShell, roleOf } from '@/components/AppShell';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { BuyerDashboard } from '@/components/dashboards/BuyerDashboard';
import { ModeratorDashboard } from '@/components/dashboards/ModeratorDashboard';
import { SellerDashboard } from '@/components/dashboards/SellerDashboard';
import { Badge, ErrorBox, Spinner } from '@/components/ui/kit';
import { authApi, type SessionInfo } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { dt } from '@/lib/fmt';
import { useApi, useAction } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** One account = one role, so each person gets exactly the dashboard of their role (see the role concept designs). */
export default function DashboardPage() {
  const { user } = useAuth();
  const role = roleOf(user?.roles);
  return (
    <AppShell>
      <div className="space-y-6">
        {role === 'BUYER' && <BuyerDashboard />}
        {role === 'SELLER' && <SellerDashboard />}
        {role === 'MODERATOR' && <ModeratorDashboard />}
        {role === 'SUPER_ADMIN' && <AdminDashboard />}
        <Sessions />
      </div>
    </AppShell>
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
