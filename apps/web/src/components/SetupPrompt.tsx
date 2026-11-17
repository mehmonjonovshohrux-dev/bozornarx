'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getLock } from '@/lib/applock';
import { useAuth } from '@/lib/auth-context';

const skipKey = (uid: string) => `bn_setup_skip_${uid}`;

/** After the app is installed (or opened as an installed app) and signed in, offers to set up PIN / fingerprint once. Never blocks; "Keyinroq" is remembered. */
export function SetupPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const installed = standalone || localStorage.getItem('bn_installed') === '1';
    const check = () => {
      const lock = getLock();
      const skipped = localStorage.getItem(skipKey(user.id)) === '1';
      setShow(installed && !skipped && !(lock && lock.uid === user.id));
    };
    check();
    const onInstalled = () => { localStorage.setItem('bn_installed', '1'); setShow(!getLock() && localStorage.getItem(skipKey(user.id)) !== '1'); };
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('bn-lock-change', check);
    return () => { window.removeEventListener('appinstalled', onInstalled); window.removeEventListener('bn-lock-change', check); };
  }, [user]);

  if (!show || !user) return null;
  const later = () => { localStorage.setItem(skipKey(user.id), '1'); setShow(false); };
  return (
    <div className="fixed inset-x-3 bottom-24 z-[70] rounded-2xl border border-brand-200 bg-white p-4 shadow-xl lg:bottom-6 lg:left-auto lg:right-6 lg:w-96" role="dialog" aria-label="Xavfsizlikni sozlash">
      <p className="font-bold text-brand-800">Ilovani himoyalang</p>
      <p className="mt-1 text-sm text-ink-soft">PIN kod va barmoq izi o‘rnating: ilovani faqat siz ocha olasiz, har safar parol kiritish shart emas.</p>
      <div className="mt-3 flex gap-2">
        <Link href="/security" onClick={() => setShow(false)} className="btn btn-primary !min-h-[38px] !px-4 !text-sm">Hozir sozlash</Link>
        <button className="btn btn-ghost !min-h-[38px] !px-4 !text-sm" onClick={later}>Keyinroq</button>
      </div>
    </div>
  );
}
