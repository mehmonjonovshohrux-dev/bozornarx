'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from './AppShell';
import { Brand } from './Logo';
import { Spinner } from './ui/kit';

/** Signed-in users get the full app shell; guests get a light public header (catalog, map and stores are public). */
export function PageShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <AppShell>{children}</AppShell>;
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-cream-300 bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" aria-label="BozorNarx"><Brand /></Link>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link href="/catalog" className="hidden px-3 py-2 text-ink-soft sm:block">Katalog</Link>
            <Link href="/map" className="hidden px-3 py-2 text-ink-soft sm:block">Xarita</Link>
            <Link href="/login" className="btn btn-ghost !min-h-[40px] !px-4">Kirish</Link>
            <Link href="/register" className="btn btn-primary !min-h-[40px] !px-4">Ro‘yxatdan o‘tish</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
    </div>
  );
}
