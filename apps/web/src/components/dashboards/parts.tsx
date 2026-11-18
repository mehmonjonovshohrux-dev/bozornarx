'use client';
import { PHOTOS } from '@/lib/photos';
import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon';

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: { href: string; label: string } | null; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-3xl border border-cream-300 bg-white p-5 shadow-card', className)}>
      {(title || action) && <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[17px] font-extrabold text-ink">{title}</h2>{action && <Link href={action.href} className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">{action.label}<Icon name="right" size={15} /></Link>}</div>}
      {children}
    </section>
  );
}

const TONE = { green: 'bg-brand-50 text-brand-700', orange: 'bg-orange-50 text-accent-600', red: 'bg-red-50 text-danger', blue: 'bg-sky-50 text-sky-700', violet: 'bg-indigo-50 text-indigo-700', amber: 'bg-amber-50 text-amber-700' };
export function Kpi({ icon, label, value, sub, tone = 'green', href }: { icon: string; label: string; value: ReactNode; sub?: ReactNode; tone?: keyof typeof TONE; href?: string }) {
  const body = (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-cream-300 bg-white p-4 shadow-card transition hover:-translate-y-0.5">
      <span className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', TONE[tone])}><Icon name={icon} size={24} /></span>
      <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-ink-soft">{label}</span><span className="block truncate text-[22px] font-extrabold leading-tight text-ink">{value}</span>{sub && <span className="block truncate text-xs text-ink-muted">{sub}</span>}</span>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function Hero({ title, text, cta, art }: { title: string; text: string; cta?: { href: string; label: string }; art?: string[] }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-6 text-white shadow-card sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-emerald-300/20 blur-2xl" />
      <div className="relative max-w-md">
        <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-[15px] text-emerald-50/90">{text}</p>
        {cta && <Link href={cta.href} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-brand-800 shadow">{cta.label}<Icon name="arrow" size={16} /></Link>}
      </div>
      {art && <div className="pointer-events-none absolute bottom-0 right-3 hidden gap-0 sm:flex">{art.map((a, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={a} src={(PHOTOS[a] ?? '').replace('w=900', 'w=360')} alt="" loading="lazy" decoding="async" className={clsx('rounded-full border-4 border-white/80 object-cover shadow-xl', i === 1 ? 'h-40 w-40' : 'h-28 w-28 self-end')} />)}</div>}
    </div>
  );
}

export function Row({ children, href }: { children: ReactNode; href?: string }) {
  const c = 'flex items-center gap-3 border-t border-cream-200 py-2.5 first:border-t-0';
  return href ? <Link href={href} className={clsx(c, 'hover:bg-cream-50')}>{children}</Link> : <div className={c}>{children}</div>;
}
export const Dash = ({ children }: { children: ReactNode }) => <div className="space-y-5">{children}</div>;
export function Soft({ children }: { children: ReactNode }) { return <p className="rounded-xl bg-cream-100 p-3 text-sm text-ink-soft">{children}</p>; }
