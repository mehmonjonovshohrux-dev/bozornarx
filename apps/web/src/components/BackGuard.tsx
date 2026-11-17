'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Pages where "Back" would otherwise close the installed app. There the first Back shows a hint, a second Back within 2 s leaves.
const ROOTS = new Set(['/', '/dashboard', '/login']);

/** Installed-app only (in a normal browser tab Back must behave normally). Every other screen uses the ordinary history Back / edge-swipe. */
export function BackGuard() {
  const path = usePathname();
  const [hint, setHint] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone || !ROOTS.has(path)) return;
    const sentinel = () => window.history.pushState({ ...(window.history.state ?? {}), bnRoot: true }, '', window.location.href);
    sentinel();
    const onPop = () => {
      const now = Date.now();
      if (now - last.current < 2000) { window.removeEventListener('popstate', onPop); window.history.back(); return; }
      last.current = now;
      setHint(true);
      setTimeout(() => setHint(false), 2000);
      sentinel();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [path]);

  if (!hint) return null;
  return <div role="status" className="fixed bottom-24 left-1/2 z-[95] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">Chiqish uchun yana bir marta orqaga bosing</div>;
}
