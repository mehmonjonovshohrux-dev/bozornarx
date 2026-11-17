'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PageShell } from '@/components/PageShell';
import { Empty, ErrorBox, PageTitle, Pager, ProductImage, Spinner, Badge } from '@/components/ui/kit';
import { Icon } from '@/components/ui/Icon';
import { money } from '@/lib/fmt';
import { qs, usePublicApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Cat { id: string; name: string; children: Cat[] }
const flat = (c: Cat[], d = 0): Array<{ id: string; name: string }> => c.flatMap((x) => [{ id: x.id, name: `${'— '.repeat(d)}${x.name}` }, ...flat(x.children, d + 1)]);

function Catalog() {
  const sp = useSearchParams();
  const [f, setF] = useState({ q: sp.get('q') ?? '', categoryId: sp.get('categoryId') ?? '', regionId: '', sort: 'newest', delivery: '', verifiedOnly: '', availability: '', minPrice: '', maxPrice: '' });
  const [page, setPage] = useState(1);
  const cats = usePublicApi<Cat[]>('/catalog/categories');
  const regions = usePublicApi<any[]>('/catalog/regions');
  const list = usePublicApi<Paged<any>>(`/catalog/products${qs({ ...f, page, pageSize: 12 })}`);
  const set = (k: keyof typeof f, v: string) => { setF((o) => ({ ...o, [k]: v })); setPage(1); };
  return (
    <>
      <PageTitle title="Narxlar katalogi" sub="Mahsulotlarni qidiring va do‘konlar narxini solishtiring." />
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit space-y-3 p-4" aria-label="Filtrlar">
          <input className="input" type="search" placeholder="Mahsulot, brend, shtrix-kod…" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Qidiruv" />
          <select className="input" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-label="Kategoriya"><option value="">Barcha kategoriyalar</option>{flat(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="input" value={f.regionId} onChange={(e) => set('regionId', e.target.value)} aria-label="Hudud"><option value="">Barcha hududlar</option>{regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input className="input" inputMode="numeric" placeholder="Narx dan" value={f.minPrice} onChange={(e) => set('minPrice', e.target.value)} /><input className="input" inputMode="numeric" placeholder="gacha" value={f.maxPrice} onChange={(e) => set('maxPrice', e.target.value)} /></div>
          <select className="input" value={f.availability} onChange={(e) => set('availability', e.target.value)} aria-label="Mavjudlik"><option value="">Mavjudlik: hammasi</option><option value="IN_STOCK">Omborda bor</option><option value="LOW_STOCK">Oz qolgan</option></select>
          <select className="input" value={f.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Saralash"><option value="newest">Yangilari</option><option value="name">Nomi bo‘yicha</option><option value="price_asc">Arzonlari avval</option><option value="price_desc">Qimmatlari avval</option></select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.delivery === 'true'} onChange={(e) => set('delivery', e.target.checked ? 'true' : '')} className="h-5 w-5" />Yetkazib berish bor</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.verifiedOnly === 'true'} onChange={(e) => set('verifiedOnly', e.target.checked ? 'true' : '')} className="h-5 w-5" />Faqat tasdiqlangan do‘konlar</label>
          <button className="btn btn-ghost w-full" onClick={() => { setF({ q: '', categoryId: '', regionId: '', sort: 'newest', delivery: '', verifiedOnly: '', availability: '', minPrice: '', maxPrice: '' }); setPage(1); }}>Tozalash</button>
        </aside>
        <section>
          <ErrorBox error={list.error} retry={list.reload} />
          {list.loading && <Spinner />}
          {list.data && list.data.items.length === 0 && <Empty title="Hech narsa topilmadi" hint="Filtrlarni o‘zgartirib ko‘ring." />}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.data?.items.map((p) => (
              <li key={p.id}>
                <Link href={`/catalog/${p.slug}`} className="card block overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-300">
                  <ProductImage id={p.imageId} alt={p.name} name={p.name} category={p.category.name} className="aspect-square w-full" />
                  <div className="p-4">
                    <p className="text-xs text-ink-muted">{p.category.name}</p>
                    <h3 className="font-bold text-ink">{p.name}</h3>
                    {p.cheapest ? <p className="mt-2 text-lg font-extrabold text-brand-700">{money(p.cheapest.perBase)} <span className="text-xs font-medium text-ink-muted">/ {p.cheapest.baseUnit}</span></p> : <p className="mt-2 text-sm text-ink-muted">Hozircha narx yo‘q</p>}
                    <div className="mt-2 flex items-center justify-between"><Badge tone="muted">{p.offersCount} ta taklif</Badge><span className="inline-flex items-center gap-1 text-xs font-bold text-brand-700"><Icon name="scale" size={14} />Solishtirish</span></div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {list.data && <Pager page={page} pages={list.data.pages ?? 1} onPage={setPage} />}
        </section>
      </div>
    </>
  );
}
export default function CatalogPage() { return <PageShell><Suspense fallback={<Spinner />}><Catalog /></Suspense></PageShell>; }
