'use client';
import clsx from 'clsx';
import { categoryArt, productArt } from '@/lib/productArt';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiError } from '@/lib/api';

export function Spinner({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-3 py-10 text-ink-muted"><span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />{label}</div>;
}

export function ErrorBox({ error, retry }: { error: ApiError | string | null; retry?: () => void }) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.message;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
      {msg}
      {retry && <button onClick={retry} className="ml-3 font-semibold underline">Qayta urinish</button>}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-4xl" aria-hidden>🧺</div>
      <p className="text-lg font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-md text-ink-soft">{hint}</p>}
      {action}
    </div>
  );
}

const TONES = { ok: 'bg-brand-100 text-brand-800', warn: 'bg-amber-100 text-amber-800', bad: 'bg-red-100 text-red-700', muted: 'bg-cream-200 text-ink-soft', info: 'bg-sky-100 text-sky-800' } as const;
export type Tone = keyof typeof TONES;
export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', TONES[tone])}>{children}</span>;
}
export const statusTone = (s: string): Tone =>
  ['COMPLETED', 'APPROVED', 'VERIFIED', 'ACCEPTED', 'FULLY_SIGNED', 'ACTIVE', 'RESOLVED', 'DELIVERED', 'TRUSTED'].includes(s) ? 'ok'
  : ['CANCELLED', 'REJECTED', 'EXPIRED', 'SUSPENDED', 'DISPUTED', 'SUSPICIOUS'].includes(s) ? 'bad'
  : ['PENDING', 'PENDING_REVIEW', 'COUNTERED', 'OPEN', 'IN_REVIEW', 'APPEALED', 'OUTDATED'].includes(s) ? 'warn' : 'info';

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold text-brand-800 sm:text-3xl">{title}</h1>{sub && <p className="mt-1 text-ink-soft">{sub}</p>}</div>
      {action}
    </div>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {error && <span className="field-error block">{error}</span>}
    </label>
  );
}

export function Stat({ label, value, sub, tone, onClick }: { label: string; value: ReactNode; sub?: string; tone?: 'accent' | 'brand'; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center justify-between text-sm text-ink-muted"><span>{label}</span>{onClick && <span aria-hidden className="text-brand-700">›</span>}</div>
      <div className={clsx('mt-1 text-2xl font-extrabold', tone === 'accent' ? 'text-accent-600' : 'text-brand-800')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </>
  );
  if (!onClick) return <div className="card p-4">{body}</div>;
  return <button type="button" onClick={onClick} className="card w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" aria-label={`${label}: ${String(value)}. Ro‘yxatni ochish`}>{body}</button>;
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-center gap-3" aria-label="Sahifalar">
      <button className="btn btn-ghost !min-h-[40px] !px-4" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Oldingi</button>
      <span className="text-sm text-ink-soft">{page} / {pages}</span>
      <button className="btn btn-ghost !min-h-[40px] !px-4" disabled={page >= pages} onClick={() => onPage(page + 1)}>Keyingi ›</button>
    </nav>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string; badge?: number }>; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-cream-200 p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={clsx('whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition', value === t.id ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-soft hover:text-ink')}>
          {t.label}{t.badge ? <span className="ml-2 rounded-full bg-accent-500 px-2 py-0.5 text-xs text-white">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', h);
    // The phone's Back button / edge swipe closes the dialog instead of leaving the screen.
    window.history.pushState({ ...(window.history.state ?? {}), bnModal: true }, '', window.location.href);
    let poppedByUser = false;
    const onPop = () => { poppedByUser = true; closeRef.current(); };
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('keydown', h);
      window.removeEventListener('popstate', onPop);
      if (!poppedByUser && window.history.state?.bnModal) window.history.back();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-brand-800">{title}</h2><button onClick={onClose} aria-label="Yopish" className="rounded-lg p-2 text-2xl leading-none text-ink-muted hover:bg-cream-200">×</button></div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, title, text, danger, busy, onYes, onNo }: { open: boolean; title: string; text: string; danger?: boolean; busy?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onNo}>
      <p className="mb-5 text-ink-soft">{text}</p>
      <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onNo}>Yo‘q</button><button className={clsx('btn', danger ? 'bg-danger text-white hover:bg-red-700' : 'btn-primary')} disabled={busy} onClick={onYes}>Ha</button></div>
    </Modal>
  );
}

export function ProductImage({ id, alt, name, category, className }: { id: string | null | undefined; alt: string; name?: string; category?: string | null; className?: string }) {
  // A seller's uploaded photo always wins and is left untouched. Otherwise: real demo photo from lib/photos.ts (Unsplash), cropped to
  // fill the box (object-cover), lazy-loaded; if missing or it fails to load, a neutral placeholder is shown (never a drawing).
  const [failed, setFailed] = useState(false);
  // eslint-disable-next-line @next/next/no-img-element
  if (id) return <img src={`/api/files/${id}/public`} alt={alt} loading="lazy" className={clsx('object-cover', className)} />;
  const src = productArt(name ?? alt, category);
  if (!src || failed) return <div role="img" aria-label={alt} className={clsx('bg-cream-200', className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={clsx('bg-cream-200 object-cover', className)} />;
}

export function CategoryArt({ name, className }: { name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = categoryArt(name);
  if (!src || failed) return <div role="img" aria-label={name} className={clsx('bg-cream-200', className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className={clsx('bg-cream-200 object-cover', className)} />;
}

export function LinkCard({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="card block p-4 transition hover:-translate-y-0.5 hover:border-brand-300">{children}</Link>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-cream-100 text-ink-muted"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-cream-200">{children}</tbody>
      </table>
    </div>
  );
}
