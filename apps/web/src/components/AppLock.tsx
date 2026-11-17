'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { biometricUnlock, clearLock, getLock, verifyPin } from '@/lib/applock';
import { BasketMark, Wordmark } from './Logo';

const MAX_TRIES = 5;

/** Full-screen lock: shown when the app opens and after it was in the background longer than the chosen time. */
export function AppLock() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [tries, setTries] = useState(0);
  const [hasBio, setHasBio] = useState(false);
  const hiddenAt = useRef(0);

  const evaluate = useCallback(() => {
    const c = getLock();
    setHasBio(!!c?.cred);
    if (!user || !c || c.uid !== user.id) { setLocked(false); return; }
    let unlocked = false;
    try { unlocked = sessionStorage.getItem('bn_unlocked') === '1'; } catch { /* ignore */ }
    setLocked(!unlocked);
  }, [user]);

  useEffect(() => { evaluate(); }, [evaluate]);
  useEffect(() => {
    window.addEventListener('bn-lock-change', evaluate);
    return () => window.removeEventListener('bn-lock-change', evaluate);
  }, [evaluate]);

  useEffect(() => {
    const onVis = () => {
      const c = getLock();
      if (!c || !user || c.uid !== user.id) return;
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current >= c.autoSec * 1000) {
        try { sessionStorage.removeItem('bn_unlocked'); } catch { /* ignore */ }
        setPin(''); setMsg(''); setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [user]);

  const unlock = useCallback(() => {
    try { sessionStorage.setItem('bn_unlocked', '1'); } catch { /* ignore */ }
    setLocked(false); setPin(''); setMsg(''); setTries(0);
  }, []);

  const bio = useCallback(async () => { if (await biometricUnlock()) unlock(); else setMsg('Barmoq izi tasdiqlanmadi. PIN kiriting.'); }, [unlock]);
  useEffect(() => { if (locked && hasBio) void bio(); }, [locked, hasBio, bio]);

  const submit = useCallback(async (value: string) => {
    if (await verifyPin(value)) { unlock(); return; }
    const n = tries + 1;
    setTries(n); setPin('');
    if (n >= MAX_TRIES) {
      setMsg('Juda ko‘p xato urinish. Xavfsizlik uchun tizimdan chiqarildi.');
      clearLock();
      await logout().catch(() => undefined);
      setLocked(false);
      router.replace('/login');
      return;
    }
    setMsg(`PIN noto‘g‘ri. Qolgan urinish: ${MAX_TRIES - n}`);
  }, [tries, unlock, logout, router]);

  const press = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === (getLock()?.len ?? 4)) void submit(next);
  };

  if (!locked) return null;
  const len = getLock()?.len ?? 4;
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center bg-[linear-gradient(180deg,#f1f8f3,#fbf7ee)] px-6 pb-8 pt-[max(2rem,env(safe-area-inset-top))]" role="dialog" aria-modal="true" aria-label="Ilova qulfi">
      <div className="mt-6 flex flex-col items-center"><BasketMark size={64} /><Wordmark className="mt-2 text-[26px]" /></div>
      <p className="mt-6 font-semibold text-ink">PIN kodni kiriting</p>
      <div className="mt-4 flex gap-3" aria-live="polite">{Array.from({ length: len }).map((_, i) => <span key={i} className={`h-4 w-4 rounded-full border-2 border-brand-700 ${i < pin.length ? 'bg-brand-700' : ''}`} />)}</div>
      <p className="mt-3 h-5 text-sm text-danger" role="alert">{msg}</p>
      <div className="mt-4 grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)} className="h-16 rounded-2xl bg-white text-2xl font-semibold text-ink shadow-card active:bg-brand-50">{d}</button>)}
        {hasBio ? <button onClick={() => void bio()} aria-label="Barmoq izi bilan ochish" className="grid h-16 place-items-center rounded-2xl bg-brand-50 text-brand-700 active:bg-brand-100">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 11a3 3 0 0 0-3 3c0 2.5-.5 4.5-1.5 6M12 7a7 7 0 0 0-7 7c0 1.5-.2 3-.7 4.5M12 3a11 11 0 0 1 11 11c0 1.2-.1 2.3-.4 3.4M15 14c0 3-.7 5.2-2 7.2M9.500 5.2A7 7 0 0 1 19 14"/></svg>
        </button> : <span />}
        <button onClick={() => press('0')} className="h-16 rounded-2xl bg-white text-2xl font-semibold text-ink shadow-card active:bg-brand-50">0</button>
        <button onClick={() => { setPin((p) => p.slice(0, -1)); setMsg(''); }} aria-label="O‘chirish" className="h-16 rounded-2xl text-2xl text-ink-soft active:bg-white">⌫</button>
      </div>
      <button className="mt-auto pt-6 text-sm font-semibold text-brand-700" onClick={async () => { clearLock(); await logout().catch(() => undefined); setLocked(false); router.replace('/login'); }}>PIN esdan chiqdimi? Qayta kirish</button>
    </div>
  );
}
