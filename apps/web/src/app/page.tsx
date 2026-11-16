'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Brand } from '@/components/Logo';
import { CategoryArt, ProductImage } from '@/components/ui/kit';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth-context';
import { money } from '@/lib/fmt';
import { usePublicApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
const FEATURES = [
  ['chart', 'Haqiqiy narxlar', 'Bozor va do‘konlardan yig‘ilgan narxlar'],
  ['scale', 'Taqqoslash', 'Eng maqbul narxni toping'],
  ['map', 'Xaritada', 'Eng yaqin sotuvchini toping'],
  ['shield', 'Ishonchli sotuvchilar', 'Tasdiqlangan do‘konlar'],
];
export default function Home() {
  const router = useRouter(); const { user } = useAuth(); const [q, setQ] = useState('');
  const cats = usePublicApi<any[]>('/catalog/categories');
  const prods = usePublicApi<Paged<any>>('/catalog/products?pageSize=8&sort=newest');
  const go = (e: FormEvent) => { e.preventDefault(); router.push(`/catalog${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); };
  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,#f1f8f3,#fbf7ee_45%)]">
      <header className="sticky top-0 z-40 border-b border-cream-300 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="BozorNarx"><Brand /></Link>
          <nav className="hidden items-center gap-6 text-[15px] font-semibold text-ink-soft md:flex" aria-label="Asosiy">
            <Link href="/catalog" className="hover:text-brand-700">Katalog</Link><Link href="/map" className="hover:text-brand-700">Xarita</Link>
          </nav>
          <div className="flex gap-2">{user ? <Link href="/dashboard" className="btn btn-primary !min-h-[42px] !px-5">Kabinet</Link> : <><Link href="/login" className="btn btn-ghost !min-h-[42px] !px-4">Kirish</Link><Link href="/register" className="btn btn-primary !min-h-[42px] !px-4">Ro‘yxatdan o‘tish</Link></>}</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-5">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-6 py-10 text-white shadow-card sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full bg-emerald-300/25 blur-3xl" />
          <div className="relative max-w-xl">
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">Bozor narxlari<br /><span className="text-accent-400">bir joyda</span></h1>
            <p className="mt-4 max-w-md text-lg text-emerald-50/90">Eng yaqin bozor va do‘konlarni toping, narxlarni solishtiring va qulay sotib oling.</p>
            <form onSubmit={go} className="mt-7 flex max-w-lg gap-2 rounded-2xl bg-white p-2 shadow-xl" role="search">
              <input className="min-w-0 flex-1 rounded-xl px-3 text-[16px] text-ink outline-none placeholder:text-ink-muted" placeholder="Mahsulot nomi, sotuvchi yoki bozor…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidiruv" />
              <button className="btn btn-accent !min-h-[48px] !px-5" aria-label="Qidirish"><Icon name="search" size={20} /></button>
            </form>
          </div>
          <div className="pointer-events-none absolute bottom-0 right-6 hidden items-end lg:flex">
            {/* eslint-disable @next/next/no-img-element */}
            <img src="/assets/products/pomidor.svg" alt="" className="h-40 w-40 drop-shadow-2xl" /><img src="/assets/products/sabzi.svg" alt="" className="-ml-6 h-64 w-64 drop-shadow-2xl" /><img src="/assets/products/olma.svg" alt="" className="-ml-8 h-44 w-44 drop-shadow-2xl" />
          </div>
        </section>
        <ul className="relative z-10 mx-auto -mt-8 grid max-w-6xl gap-3 px-2 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([i, t, s]) => <li key={t} className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white p-4 shadow-card"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon name={i} size={24} /></span><span><b className="block">{t}</b><span className="text-sm text-ink-soft">{s}</span></span></li>)}
        </ul>
        <section className="mt-12"><div className="mb-4 flex items-end justify-between"><h2 className="text-2xl font-extrabold">Mashhur kategoriyalar</h2><Link href="/catalog" className="text-sm font-bold text-brand-700">Barchasi →</Link></div>
          <ul className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {(cats.data ?? []).slice(0, 6).map((c) => <li key={c.id}><Link href={`/catalog?categoryId=${c.id}`} className="block rounded-2xl border border-cream-300 bg-white p-3 text-center shadow-card transition hover:-translate-y-0.5"><CategoryArt name={c.name} className="mx-auto h-20 w-20" /><span className="mt-1 block text-sm font-bold">{c.name}</span></Link></li>)}
          </ul>
          {cats.loading && <p className="text-sm text-ink-muted">Yuklanmoqda…</p>}
        </section>
        <section className="mt-12"><div className="mb-4 flex items-end justify-between"><h2 className="text-2xl font-extrabold">Yangi narxlar</h2><Link href="/catalog" className="text-sm font-bold text-brand-700">Katalog →</Link></div>
          {prods.data && prods.data.items.length === 0 && <p className="rounded-2xl bg-white p-6 text-ink-soft shadow-card">Hozircha mahsulot yo‘q. Sotuvchilar narx kiritgach shu yerda ko‘rinadi.</p>}
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {prods.data?.items.map((p) => <li key={p.id}><Link href={`/catalog/${p.slug}`} className="block overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-card transition hover:-translate-y-0.5">
              <ProductImage id={p.imageId} alt={p.name} name={p.name} category={p.category.name} className="h-36 w-full" />
              <div className="p-3"><b className="block truncate">{p.name}</b>{p.cheapest ? <span className="text-lg font-extrabold text-brand-800">{money(p.cheapest.perBase)}<span className="text-xs font-medium text-ink-muted"> /{p.cheapest.baseUnit}</span></span> : <span className="text-sm text-ink-muted">Narx yo‘q</span>}</div></Link></li>)}
          </ul>
        </section>
        <section className="mt-12 grid gap-4 rounded-3xl bg-white p-6 shadow-card md:grid-cols-2"><div><h2 className="text-2xl font-extrabold">Sotuvchimisiz?</h2><p className="mt-2 text-ink-soft">Do‘kon oching, narxlarni yangilab turing va mijozlarni shartnoma asosida qabul qiling.</p></div><div className="flex items-center gap-3 md:justify-end"><Link href="/register" className="btn btn-primary">Do‘kon ochish</Link><Link href="/map" className="btn btn-ghost">Xaritani ko‘rish</Link></div></section>
      </main>
    </div>
  );
}
