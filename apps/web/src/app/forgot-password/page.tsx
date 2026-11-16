'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { OtpInput } from '@/components/auth/OtpInput';
import { ApiError, authApi } from '@/lib/api';

type Step = 'email' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await authApi.forgot(email.trim().toLowerCase());
      setCooldown(r.resendAfterSec);
      setStep('reset');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi.');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await authApi.reset({ email: email.trim().toLowerCase(), code, newPassword: password });
      setStep('done');
    } catch (e) {
      const err = e as ApiError;
      const fields = err.details?.fields as Array<{ message: string }> | undefined;
      setError(fields?.[0]?.message ?? err.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={step === 'done' ? 'Parol o‘zgartirildi' : 'Parolni tiklash'}
      subtitle={step === 'email' ? 'Emailingizga 6 xonali kod yuboramiz.' : step === 'reset' ? 'Emailga kelgan kodni va yangi parolni kiriting.' : undefined}
      footer={
        <Link href="/login" className="font-semibold text-brand-700">
          Kirishga qaytish
        </Link>
      }
    >
      {step === 'email' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required inputMode="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy || !email}>
            {busy ? 'Yuborilmoqda…' : 'Kod yuborish'}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <div className="space-y-5">
          <p className="text-sm text-ink-soft">
            Agar <span className="font-semibold text-ink break-all">{email}</span> ro‘yxatdan o‘tgan bo‘lsa, kod yuborildi.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={busy} hasError={!!error} errorTick={error ? 1 : 0} />
          <div>
            <label className="label" htmlFor="newPassword">
              Yangi parol
            </label>
            <input id="newPassword" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1.5 text-xs text-ink-muted">Kamida 8 belgi, harf va raqam bilan.</p>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy || code.length !== 6 || password.length < 8} onClick={() => void reset()}>
            {busy ? 'Saqlanmoqda…' : 'Parolni o‘zgartirish'}
          </button>
          <button type="button" className="w-full text-sm font-semibold text-brand-700 disabled:text-ink-muted" disabled={cooldown > 0 || busy} onClick={() => void sendCode()}>
            {cooldown > 0 ? `Kodni qayta yuborish (${cooldown} s)` : 'Kodni qayta yuborish'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4 text-center">
          <p className="text-ink-soft">Yangi parol saqlandi. Xavfsizlik uchun barcha qurilmalardagi seanslar yopildi.</p>
          <Link href="/login" className="btn btn-primary w-full">
            Kirish
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
