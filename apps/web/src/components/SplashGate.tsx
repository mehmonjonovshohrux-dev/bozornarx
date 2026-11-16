'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BasketMark, Wordmark } from './Logo';

type Mode = 'pending' | 'long' | 'short' | 'none';

/**
 * Original BozorNarx splash. When it shows:
 *  - installed app (standalone window): once per app session; long version the very first time, short afterwards
 *  - ordinary browser tab: only the first visit ever, so it never gets in the way
 * The splash works offline: it uses no network resource.
 * The server renders a plain cream cover (#bn-boot) so the page never flashes before this decision is made.
 */
export function SplashGate() {
  const [mode, setMode] = useState<Mode>('pending');
  const reduce = useReducedMotion();

  useEffect(() => {
    let standalone = false;
    let seen = false;
    let shownThisSession = false;
    try {
      standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      seen = localStorage.getItem('bn_seen') === '1';
      shownThisSession = sessionStorage.getItem('bn_splash') === '1';
    } catch {
      /* storage blocked: treat as already seen so we never loop */
      seen = true;
      shownThisSession = true;
    }

    const show = standalone ? !shownThisSession : !seen;
    const next: Mode = !show ? 'none' : seen ? 'short' : 'long';
    try {
      sessionStorage.setItem('bn_splash', '1');
      localStorage.setItem('bn_seen', '1');
    } catch {
      /* ignore */
    }
    setMode(next);

    const boot = document.getElementById('bn-boot');
    if (next === 'none') {
      boot?.setAttribute('data-hide', 'true');
      return;
    }
    // reduced motion: a still logo for a moment, no animation
    const ms = reduce ? 700 : next === 'long' ? 2300 : 1000;
    const t = window.setTimeout(() => setMode('none'), ms);
    return () => window.clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    if (mode === 'none') document.getElementById('bn-boot')?.setAttribute('data-hide', 'true');
  }, [mode]);

  const visible = mode === 'long' || mode === 'short';
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-cream-100"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          role="status"
          aria-label="BozorNarx yuklanmoqda"
        >
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-100/70 blur-3xl" aria-hidden />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-accent-400/15 blur-3xl" aria-hidden />

          <BasketMark size={mode === 'long' ? 132 : 112} animated={mode === 'long' && !reduce} />

          <motion.div
            className="mt-5 text-4xl"
            initial={reduce || mode === 'short' ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: mode === 'long' ? 1.0 : 0, duration: 0.45 }}
          >
            <Wordmark />
          </motion.div>

          {mode === 'long' && (
            <motion.p
              className="mt-2 text-[15px] font-medium text-ink-soft"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.5 }}
            >
              Bozor narxlari — bir joyda
            </motion.p>
          )}

          <div className="mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-cream-300" aria-hidden>
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 via-fresh-500 to-accent-500"
              initial={reduce ? { width: '100%' } : { width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: mode === 'long' ? 2.0 : 0.85, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
