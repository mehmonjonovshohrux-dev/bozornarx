'use client';
import { useEffect, useState } from 'react';

/** Friendly banner while the (free, sleeping) server wakes up. Driven by 'bn-server' events from lib/api.ts. */
export function ServerStatus() {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    const h = (e: Event) => setWaking((e as CustomEvent<string>).detail === 'waking');
    window.addEventListener('bn-server', h);
    return () => window.removeEventListener('bn-server', h);
  }, []);
  if (!waking) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-brand-800 px-4 py-3 text-sm font-medium text-white shadow-xl" style={{ marginTop: 'env(safe-area-inset-top)' }}>
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
      Server uyg‘onmoqda… 30–50 soniya kuting, sahifa o‘zi davom etadi.
    </div>
  );
}
