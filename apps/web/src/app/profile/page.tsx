'use client';
import { useState } from 'react';
import { AppShell, roleOf } from '@/components/AppShell';
import { ErrorBox, Field, PageTitle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL, dt } from '@/lib/fmt';
import { useAction } from '@/lib/hooks';

export default function ProfilePage() {
  const { user, reload } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useAction(async () => { await api('/me', { method: 'PATCH', body: { fullName: (name ?? '').trim() } }); await reload(); setSaved(true); });
  if (!user) return <AppShell><PageTitle title="Profil" /></AppShell>;
  const current = name ?? user.profile?.fullName ?? '';
  const role = roleOf(user.roles);
  return (
    <AppShell>
      <PageTitle title="Profil" sub="Hisobingiz ma’lumotlari" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <Field label="To‘liq ism"><input className="input" value={current} onChange={(e) => { setName(e.target.value); setSaved(false); }} maxLength={100} /></Field>
          <ErrorBox error={save.error} />
          {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">Saqlandi.</p>}
          <button className="btn btn-primary w-full" disabled={save.busy || current.trim().length < 2 || current.trim() === (user.profile?.fullName ?? '')} onClick={() => void save.run()}>Saqlash</button>
        </section>
        <section className="card space-y-2 p-4 text-sm">
          <Row k="Rol" v={ROLE_LABEL[role]} />
          <Row k="Email" v={`${user.email}${user.emailVerifiedAt ? ' (tasdiqlangan)' : ' (tasdiqlanmagan)'}`} />
          <Row k="Telefon" v={user.phone ?? 'kiritilmagan'} />
          <Row k="Ro‘yxatdan o‘tgan" v={dt(user.createdAt)} />
          <p className="pt-2 text-xs text-ink-muted">Bitta hisob — bitta rol. Email va telefonni o‘zgartirish xavfsizlik tekshiruvini talab qiladi, shuning uchun bu yerda o‘zgartirilmaydi.</p>
        </section>
      </div>
    </AppShell>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-3 border-b border-cream-200 pb-2 last:border-0"><span className="text-ink-muted">{k}</span><b className="text-right">{v}</b></div>;
