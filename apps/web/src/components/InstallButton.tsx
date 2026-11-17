'use client';
import { useEffect, useState } from 'react';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
declare global { interface Window { __bnInstall?: InstallEvent | null } }

/** Always-available "download the app" button. Android/desktop: native install prompt. iPhone: short instructions. Hidden once installed. */
export function InstallButton({ className = '' }: { className?: string }) {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setEv(window.__bnInstall ?? null);
    const h = () => setEv(window.__bnInstall ?? null);
    window.addEventListener('bn-install', h);
    const done = () => { setStandalone(true); setEv(null); };
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('bn-install', h); window.removeEventListener('appinstalled', done); };
  }, []);

  if (standalone) return null;
  const click = async () => {
    if (ev) { await ev.prompt(); await ev.userChoice; window.__bnInstall = null; setEv(null); } else setHelp(true);
  };
  return (
    <>
      <button type="button" onClick={click} className={`btn btn-ghost w-full ${className}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>
        Ilovani yuklab olish
      </button>
      {help && (
        <p className="mt-2 rounded-xl bg-brand-50 p-3 text-sm text-ink-soft" role="status">
          {ios ? <>iPhone: Safari’da <b>Ulashish</b> tugmasi → <b>«Bosh ekranga qo‘shish»</b>.</> : <>Brauzer menyusi (⋮) → <b>«Ilovani o‘rnatish»</b> yoki <b>«Bosh ekranga qo‘shish»</b>.</>}
        </p>
      )}
    </>
  );
}
