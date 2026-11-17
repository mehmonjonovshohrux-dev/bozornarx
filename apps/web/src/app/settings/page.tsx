'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { InstallButton } from '@/components/InstallButton';
import { PageTitle } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth-context';
import { clearApiCache } from '@/lib/hooks';

const Item = ({ href, title, hint }: { href: string; title: string; hint: string }) => (
  <Link href={href} className="card flex items-center justify-between gap-3 p-4 hover:shadow-md"><span><b className="block">{title}</b><span className="text-sm text-ink-muted">{hint}</span></span><span aria-hidden className="text-brand-700">›</span></Link>
);

export default function SettingsPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const [done, setDone] = useState(false);
  return (
    <AppShell>
      <PageTitle title="Sozlamalar" sub="Hisob, xavfsizlik va ilova" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Item href="/profile" title="Profil" hint="Ism va hisob ma’lumotlari" />
        <Item href="/security" title="Xavfsizlik va ilova qulfi" hint="PIN, barmoq izi, faol seanslar" />
        <Item href="/notifications" title="Bildirishnomalar" hint="Barcha xabarlar" />
        <Item href="/guide" title="Yo‘riqnomalar" hint="Rolingiz bo‘yicha qadamlar" />
        <Item href="/faq" title="Ko‘p beriladigan savollar" hint="Tezkor javoblar" />
        <Item href="/about" title="Ilova haqida" hint="Versiya, maqsad, huquqiy hujjatlar" />
        <Item href="/terms" title="Foydalanish shartlari" hint="Ommaviy oferta (demo)" />
        <Item href="/privacy" title="Maxfiylik siyosati" hint="Ma’lumotlar qanday qayta ishlanadi" />
      </div>
      <section className="card mt-4 space-y-3 p-4">
        <h2 className="font-bold">Ilova</h2>
        <InstallButton />
        <button className="btn btn-ghost w-full sm:w-auto" onClick={() => { clearApiCache(); setDone(true); }}>Vaqtinchalik xotirani tozalash</button>
        {done && <p className="text-sm text-emerald-800" role="status">Tozalandi. Ma’lumotlar qayta yuklanadi.</p>}
        <button className="btn btn-ghost w-full text-danger sm:w-auto" onClick={() => void logout().then(() => router.replace('/login'))}>Chiqish</button>
      </section>
    </AppShell>
  );
}
