'use client';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageTitle } from '@/components/ui/kit';

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-3 border-b border-cream-200 py-2 last:border-0"><span className="text-ink-muted">{k}</span><b className="text-right">{v}</b></div>;

export default function AboutPage() {
  return (
    <AppShell>
      <PageTitle title="Ilova haqida" sub="BozorNarx" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4 text-sm leading-relaxed text-ink-soft">
          <h2 className="mb-2 font-bold text-ink">Maqsad</h2>
          <p>BozorNarx mahalliy bozorlardagi narxlarni ochiq ko‘rsatadi, xaridorga eng maqbul takliflarni topishga yordam beradi va sotuvchi bilan elektron shartnoma orqali xavfsiz savdoni ta’minlaydi.</p>
          <h2 className="mb-2 mt-4 font-bold text-ink">Asosiy imkoniyatlar</h2>
          <ul className="list-disc space-y-1 pl-5"><li>Narxlarni kuzatish, tarix va solishtirish</li><li>Do‘konlar xaritasi</li><li>Buyurtma, taklif va chat</li><li>Shartnoma va har bir shaxsning o‘z elektron imzosi</li><li>Nizolarni ko‘rib chiqish va moderatsiya</li><li>Telefonga o‘rnatiladigan ilova, PIN va barmoq izi qulfi</li></ul>
        </section>
        <section className="card p-4 text-sm">
          <h2 className="mb-2 font-bold">Texnik ma’lumot</h2>
          <Row k="Versiya" v="0.1 (demo)" />
          <Row k="Veb" v="Next.js, TypeScript, Tailwind" />
          <Row k="Server" v="NestJS, Prisma" />
          <Row k="Ma’lumotlar bazasi" v="PostgreSQL" />
          <Row k="Rollar" v="Xaridor, Sotuvchi, Moderator, Super Admin" />
          <Row k="Imzo rejimi" v="Demo (oddiy elektron imzo)" />
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">Hozir ilova sinov (demo) rejimida: haqiqiy to‘lov yo‘q, imzo E-IMZO emas. Haqiqiy ishga tushirishdan oldin yurist ko‘rigi va rasmiy ro‘yxatdan o‘tish talab qilinadi.</p>
          <div className="mt-3 flex flex-wrap gap-3"><Link className="font-semibold text-brand-700 underline" href="/terms">Foydalanish shartlari</Link><Link className="font-semibold text-brand-700 underline" href="/privacy">Maxfiylik siyosati</Link></div>
        </section>
      </div>
    </AppShell>
  );
}
