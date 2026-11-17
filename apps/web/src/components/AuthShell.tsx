import Link from 'next/link';
import type { ReactNode } from 'react';
import { BasketMark, Wordmark } from './Logo';
import { InstallButton } from './InstallButton';

export function AuthShell({ title, subtitle, children, footer }: { title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] sm:pt-10">
      <div className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full bg-brand-100/80 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -left-16 top-1/3 h-56 w-56 rounded-full bg-accent-500/10 blur-3xl" aria-hidden />
      <header className="relative mb-6 flex flex-col items-center text-center">
        <Link href="/" aria-label="BozorNarx bosh sahifa" className="flex flex-col items-center">
          <span className="grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br from-white to-brand-50 shadow-card ring-1 ring-brand-100"><BasketMark size={72} animated /></span>
          <Wordmark className="mt-3 text-[30px]" />
        </Link>
        <p className="mt-1 text-sm text-ink-soft">Bozor narxlari — bir joyda</p>
      </header>
      <section className="card relative px-5 py-7 sm:px-8">
        {title && <h1 className="text-2xl font-extrabold text-brand-800">{title}</h1>}
        {subtitle && <p className="mt-1.5 text-ink-soft">{subtitle}</p>}
        <div className={title ? 'mt-6' : ''}>{children}</div>
      </section>
      <div className="relative mt-4"><InstallButton /></div>
      {footer && <footer className="relative mt-5 text-center text-sm text-ink-soft">{footer}</footer>}
    </main>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="field-error" role="alert">
      {message}
    </p>
  ) : null;
}
