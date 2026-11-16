import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from './Logo';

export function AuthShell({ title, subtitle, children, footer }: { title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-10 pt-6 sm:pt-10">
      <div className="pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl" aria-hidden />
      <header className="relative mb-6 flex items-center justify-between">
        <Link href="/" aria-label="BozorNarx bosh sahifa">
          <Brand />
        </Link>
      </header>
      <section className="card relative px-5 py-7 sm:px-8">
        {title && <h1 className="text-2xl font-extrabold text-brand-800">{title}</h1>}
        {subtitle && <p className="mt-1.5 text-ink-soft">{subtitle}</p>}
        <div className={title ? 'mt-6' : ''}>{children}</div>
      </section>
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
