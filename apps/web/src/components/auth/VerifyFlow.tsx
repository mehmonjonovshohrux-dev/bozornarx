'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, authApi } from '@/lib/api';
import { BasketMark } from '../Logo';
import { OtpInput } from './OtpInput';

interface Props {
  email: string;
  expiresInSec: number;
  resendAfterSec: number;
  /** show the basket -> envelope intro (right after registration). Skipped with reduced motion. */
  intro?: boolean;
  onChangeEmail: () => void;
  onVerified: () => void;
}

type Step = 'intro' | 'code' | 'success';

/**
 * Email verification experience: basket -> envelope rises and opens -> email shown -> 6-digit code
 * -> green leaves burst on success. All state is real: the code is checked by the API, nothing is simulated.
 */
export function VerifyFlow({ email, expiresInSec, resendAfterSec, intro = true, onChangeEmail, onVerified }: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(intro && !reduce ? 'intro' : 'code');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTick, setErrorTick] = useState(0);
  const [cooldown, setCooldown] = useState(resendAfterSec);
  const [expiresIn, setExpiresIn] = useState(expiresInSec);
  const [info, setInfo] = useState<string | null>(null);

  // intro plays once, then hands over to the code step
  useEffect(() => {
    if (step !== 'intro') return;
    const t = window.setTimeout(() => setStep('code'), 2600);
    return () => window.clearTimeout(t);
  }, [step]);

  // one-second ticker for the resend countdown and the code lifetime
  useEffect(() => {
    if (step !== 'code') return;
    const id = window.setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
      setExpiresIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step]);

  const submit = useCallback(
    async (value: string) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await authApi.verifyEmail(email, value);
        setStep('success');
        window.setTimeout(onVerified, reduce ? 900 : 1700);
      } catch (e) {
        const err = e as ApiError;
        const left = typeof err.details?.attemptsLeft === 'number' ? ` (${err.details.attemptsLeft} ta urinish qoldi)` : '';
        setError(err.message + (err.code === 'INVALID_CODE' ? left : ''));
        setErrorTick((n) => n + 1);
        setCode('');
      } finally {
        setBusy(false);
      }
    },
    [busy, email, onVerified, reduce],
  );

  async function resend() {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await authApi.resend(email);
      setCooldown(r.resendAfterSec);
      setExpiresIn(r.expiresInSec);
      setCode('');
      setInfo('Yangi kod yuborildi.');
    } catch (e) {
      const err = e as ApiError;
      const wait = typeof err.details?.retryAfterSec === 'number' ? err.details.retryAfterSec : null;
      if (wait) setCooldown(wait);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const mmss = `${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}`;

  return (
    <div className="mx-auto w-full max-w-md text-center" aria-live="polite">
      <AnimatePresence mode="wait">
        {step === 'intro' && <IntroScene key="intro" email={email} />}

        {step === 'code' && (
          <motion.div key="code" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <MiniEnvelope />
            <h2 className="mt-4 text-2xl font-extrabold text-brand-800">Emailingizni tasdiqlang</h2>
            <p className="mt-2 text-ink-soft">
              6 xonali kod <span className="font-semibold text-ink break-all">{email}</span> manziliga yuborildi.
            </p>

            <div className="mt-6">
              <OtpInput value={code} onChange={setCode} onComplete={submit} disabled={busy} errorTick={errorTick} hasError={!!error} />
            </div>

            <div className="mt-4 min-h-[44px]" role={error ? 'alert' : undefined}>
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              {!error && info && <p className="text-sm font-medium text-brand-700">{info}</p>}
              {!error && !info && expiresIn > 0 && <p className="text-sm text-ink-muted">Kod {mmss} davomida amal qiladi</p>}
              {expiresIn === 0 && <p className="text-sm font-medium text-warn">Kod muddati tugadi. Yangi kod so‘rang.</p>}
            </div>

            <button type="button" className="btn btn-primary mt-2 w-full" disabled={busy || code.length !== 6} onClick={() => submit(code)}>
              {busy ? 'Tekshirilmoqda…' : 'Tasdiqlash'}
            </button>

            <div className="mt-5 flex flex-col items-center gap-2 text-sm">
              <button type="button" onClick={resend} disabled={cooldown > 0 || busy} className="font-semibold text-brand-700 disabled:text-ink-muted">
                {cooldown > 0 ? `Kodni qayta yuborish (${cooldown} s)` : 'Kodni qayta yuborish'}
              </button>
              <button type="button" onClick={onChangeEmail} className="text-ink-soft underline-offset-2 hover:underline">
                Emailni o‘zgartirish
              </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && <SuccessScene key="success" reduce={!!reduce} />}
      </AnimatePresence>
    </div>
  );
}

/** Basket -> envelope slides out -> flap opens -> letter with the address appears. About 2.4 s. */
function IntroScene({ email }: { email: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="flex flex-col items-center">
      <div className="relative h-52 w-56" style={{ perspective: 700 }}>
        {/* envelope rises out of the basket */}
        <motion.div
          className="absolute left-1/2 top-10 h-[84px] w-[132px] -translate-x-1/2"
          initial={{ y: 70, scale: 0.55, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.7, type: 'spring', stiffness: 120, damping: 14 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* letter inside, slides up after the flap opens */}
          <motion.div
            className="absolute inset-x-3 top-1 z-[1] h-16 rounded-md border border-brand-200 bg-white p-2 text-left shadow-sm"
            initial={{ y: 0 }}
            animate={{ y: -34 }}
            transition={{ delay: 1.55, duration: 0.5, ease: 'easeOut' }}
          >
            <div className="h-1.5 w-12 rounded bg-brand-300" />
            <div className="mt-1.5 h-1.5 w-16 rounded bg-cream-300" />
            <div className="mt-1.5 h-1.5 w-10 rounded bg-cream-300" />
          </motion.div>
          {/* envelope body */}
          <div className="absolute inset-0 z-[2] rounded-lg border border-brand-200 bg-brand-50 shadow-card" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}>
            <div className="absolute inset-x-0 bottom-0 h-[62%] rounded-b-lg bg-brand-100" style={{ clipPath: 'polygon(0 0, 50% 55%, 100% 0, 100% 100%, 0 100%)' }} />
          </div>
          {/* flap */}
          <motion.div
            className="absolute inset-x-0 top-0 z-[3] h-[52px] origin-top rounded-t-lg bg-brand-200"
            style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', backfaceVisibility: 'hidden' }}
            initial={{ rotateX: 0 }}
            animate={{ rotateX: -178, zIndex: 0 }}
            transition={{ delay: 1.2, duration: 0.45, ease: 'easeInOut' }}
          />
          <div className="absolute left-1/2 top-[34px] z-[4] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-accent-500 shadow" />
        </motion.div>

        <motion.div className="absolute bottom-0 left-1/2 -translate-x-1/2" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
          <BasketMark size={104} />
        </motion.div>
      </div>

      <motion.p className="mt-2 text-lg font-semibold text-brand-800" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8, duration: 0.4 }}>
        Kod yuborildi
      </motion.p>
      <motion.p className="mt-1 max-w-[18rem] break-all text-sm text-ink-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0, duration: 0.4 }}>
        {email}
      </motion.p>
    </motion.div>
  );
}

function MiniEnvelope() {
  return (
    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-brand-700" aria-hidden>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m3.5 7 8.5 6.5L20.5 7" />
      </svg>
    </div>
  );
}

/** Check mark draws itself while green leaves burst outwards. Fixed angles, no randomness, so it is stable. */
function SuccessScene({ reduce }: { reduce: boolean }) {
  const leaves = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2 + 0.3;
    return { x: Math.cos(angle) * (88 + (i % 3) * 18), y: Math.sin(angle) * (88 + (i % 3) * 18), r: (i * 47) % 160, delay: 0.25 + (i % 4) * 0.05, orange: i % 4 === 0 };
  });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6">
      <div className="relative grid h-32 w-32 place-items-center">
        {!reduce &&
          leaves.map((l, i) => (
            <motion.svg
              key={i}
              width="22"
              height="22"
              viewBox="0 0 24 24"
              className="absolute"
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
              animate={{ x: l.x, y: l.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.8], rotate: l.r }}
              transition={{ delay: l.delay, duration: 1.1, ease: 'easeOut' }}
              aria-hidden
            >
              <path d="M12 22C5 16 6 7 20 3c1 11-3 17-8 19Z" fill={l.orange ? '#f97316' : '#22c55e'} />
            </motion.svg>
          ))}
        <motion.div className="grid h-24 w-24 place-items-center rounded-full bg-brand-600 shadow-card" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M5 12.5 10 17.5 19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 0.45 }} />
          </svg>
        </motion.div>
      </div>
      <h2 className="mt-4 text-2xl font-extrabold text-brand-800">Email tasdiqlandi</h2>
      <p className="mt-1 text-ink-soft">Hisobingiz tayyor. Yo‘naltirilmoqda…</p>
    </motion.div>
  );
}
