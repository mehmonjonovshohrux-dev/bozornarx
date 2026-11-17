'use client';

import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Registers the service worker, shows "update available" and an install prompt (Android/desktop), or iOS Add-to-Home-Screen hint. */
export function PwaClient() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) setWaiting(w);
          });
        });
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      try { if (localStorage.getItem('bn_install_dismissed') === '1') return; } catch { /* ignore */ }
      setInstall(e as InstallEvent);
    };
    const keep = (e: Event) => { e.preventDefault(); (window as unknown as { __bnInstall?: Event }).__bnInstall = e; window.dispatchEvent(new Event('bn-install')); };
    window.addEventListener('beforeinstallprompt', keep);
    window.addEventListener('beforeinstallprompt', onPrompt);

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = localStorage.getItem('bn_ios_hint') === '1'; } catch { /* ignore */ }
    if (isIos && !standalone && !dismissed) setIosHint(true);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('beforeinstallprompt', keep); };
  }, []);

  const dismiss = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } };

  if (!waiting && !install && !iosHint) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md space-y-2" role="region" aria-label="Ilova bildirishnomalari">
      {waiting && (
        <div className="card flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-medium">Yangi versiya tayyor.</p>
          <button className="btn btn-primary !min-h-[40px] !px-4 !py-2" onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}>Yangilash</button>
        </div>
      )}
      {install && (
        <div className="card flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-medium">BozorNarx’ni ilova sifatida o‘rnating.</p>
          <div className="flex gap-2">
            <button className="text-sm text-ink-muted" onClick={() => { dismiss('bn_install_dismissed'); setInstall(null); }}>Keyin</button>
            <button className="btn btn-accent !min-h-[40px] !px-4 !py-2" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}>O‘rnatish</button>
          </div>
        </div>
      )}
      {iosHint && (
        <div className="card px-4 py-3 text-sm">
          <p>iPhone’da o‘rnatish: <b>Ulashish</b> tugmasi → <b>«Osh ekranga qo‘shish»</b>.</p>
          <button className="mt-2 font-semibold text-brand-700" onClick={() => { dismiss('bn_ios_hint'); setIosHint(false); }}>Tushunarli</button>
        </div>
      )}
    </div>
  );
}
