import Link from 'next/link';
import type { ReactNode } from 'react';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm font-semibold text-brand-700">← BozorNarx</Link>
      <h1 className="mt-3 font-display text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-xs text-ink-muted">Oxirgi yangilanish: {updated}</p>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="note">
        <b>DEMO / SHABLON.</b> Bu matn sinov (demo) rejimi uchun tayyorlangan. Haqiqiy savdoni boshlashdan oldin uni O‘zbekiston Respublikasida faoliyat yurituvchi malakali yurist ko‘rib chiqishi va kompaniya rekvizitlari bilan to‘ldirishi shart.
      </p>
      <div className="mt-5 space-y-5 text-sm leading-relaxed text-ink-soft">{children}</div>
    </main>
  );
}
export const Sec = ({ t, children }: { t: string; children: ReactNode }) => (<section><h2 className="mb-1 text-base font-bold text-ink">{t}</h2><div className="space-y-2">{children}</div></section>);
