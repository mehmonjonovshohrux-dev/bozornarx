'use client';
import { useRef, useState } from 'react';
import { AppShell, roleOf } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { PasswordInput } from '@/components/PasswordInput';
import { ErrorBox, Field, PageTitle } from '@/components/ui/kit';
import { api, authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL, dt } from '@/lib/fmt';
import { useAction } from '@/lib/hooks';

/** Square-crops and shrinks the chosen picture to 256x256 JPEG in the browser (small upload, no huge photos stored). */
async function toAvatarBase64(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Faqat PNG, JPG yoki WEBP rasm tanlang.');
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Rasmni qayta ishlab bo‘lmadi.');
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export default function ProfilePage() {
  const { user, reload } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useAction(async () => { await api('/me', { method: 'PATCH', body: { fullName: (name ?? '').trim() } }); await reload(); setSaved(true); });
  const pick = useAction(async (f: File) => {
    const dataBase64 = await toAvatarBase64(f).catch((e: Error) => { throw new Error(e.message); });
    const up = await api<{ id: string }>('/files', { body: { kind: 'AVATAR', dataBase64 } });
    await api('/me/avatar', { method: 'PUT', body: { fileId: up.id } });
    await reload();
  });
  const drop = useAction(async () => { await api('/me/avatar', { method: 'DELETE' }); await reload(); });
  if (!user) return <AppShell><PageTitle title="Profil" /></AppShell>;
  const current = name ?? user.profile?.fullName ?? '';
  const role = roleOf(user.roles);
  return (
    <AppShell>
      <PageTitle title="Profil" sub="Hisobingiz ma’lumotlari" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-4 p-4">
          <div className="flex items-center gap-4">
            <Avatar url={user.profile?.avatarUrl} name={current || user.email} size={88} />
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick.run(f); }} />
              <button className="btn btn-ghost !min-h-[38px] !px-4 !text-sm" disabled={pick.busy} onClick={() => fileRef.current?.click()}>{pick.busy ? 'Yuklanmoqda…' : user.profile?.avatarUrl ? 'Rasmni almashtirish' : 'Rasm yuklash'}</button>
              {user.profile?.avatarUrl && <button className="btn btn-ghost !min-h-[38px] !px-4 !text-sm !text-danger" disabled={drop.busy} onClick={() => void drop.run()}>O‘chirish</button>}
            </div>
          </div>
          <ErrorBox error={pick.error ?? drop.error} />
          <Field label="To‘liq ism"><input className="input" value={current} onChange={(e) => { setName(e.target.value); setSaved(false); }} maxLength={100} /></Field>
          <ErrorBox error={save.error} />
          {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">Saqlandi.</p>}
          <button className="btn btn-primary w-full" disabled={save.busy || current.trim().length < 2 || current.trim() === (user.profile?.fullName ?? '')} onClick={() => void save.run()}>Saqlash</button>
        </section>
        <div className="space-y-4">
          <section className="card space-y-2 p-4 text-sm">
            <Row k="Rol" v={ROLE_LABEL[role]} />
            <Row k="Email" v={`${user.email}${user.emailVerifiedAt ? ' (tasdiqlangan)' : ' (tasdiqlanmagan)'}`} />
            <Row k="Telefon" v={user.phone ?? 'kiritilmagan'} />
            <Row k="Ro‘yxatdan o‘tgan" v={dt(user.createdAt)} />
            <p className="pt-2 text-xs text-ink-muted">Bitta hisob — bitta rol. Email va telefonni o‘zgartirish xavfsizlik tekshiruvini talab qiladi, shuning uchun bu yerda o‘zgartirilmaydi.</p>
          </section>
          <PasswordCard />
        </div>
      </div>
    </AppShell>
  );
}

function PasswordCard() {
  const [cur, setCur] = useState(''); const [n1, setN1] = useState(''); const [n2, setN2] = useState('');
  const [ok, setOk] = useState(false); const [local, setLocal] = useState<string | null>(null);
  const go = useAction(async () => {
    setOk(false); setLocal(null);
    if (n1.length < 8 || !/[A-Za-z]/.test(n1) || !/\d/.test(n1)) { setLocal('Yangi parol kamida 8 ta belgi, harf va raqamdan iborat bo‘lsin.'); return; }
    if (n1 !== n2) { setLocal('Yangi parollar bir xil emas.'); return; }
    await authApi.changePassword(cur, n1);
    setCur(''); setN1(''); setN2(''); setOk(true);
  });
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-bold">Parolni o‘zgartirish</h2>
      <Field label="Joriy parol"><PasswordInput className="input" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
      <Field label="Yangi parol"><PasswordInput className="input" autoComplete="new-password" value={n1} onChange={(e) => setN1(e.target.value)} /></Field>
      <Field label="Yangi parolni takrorlang"><PasswordInput className="input" autoComplete="new-password" value={n2} onChange={(e) => setN2(e.target.value)} /></Field>
      {local && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger" role="alert">{local}</p>}
      <ErrorBox error={go.error} />
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">Parol o‘zgartirildi. Boshqa qurilmalardagi seanslar yopildi.</p>}
      <button className="btn btn-primary w-full" disabled={go.busy || !cur || !n1 || !n2} onClick={() => void go.run()}>Parolni o‘zgartirish</button>
    </section>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-3 border-b border-cream-200 pb-2 last:border-0"><span className="text-ink-muted">{k}</span><b className="text-right">{v}</b></div>;
