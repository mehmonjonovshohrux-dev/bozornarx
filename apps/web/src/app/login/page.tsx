'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthShell, FieldError } from '@/components/AuthShell';
import { VerifyFlow } from '@/components/auth/VerifyFlow';
import { PasswordInput } from '@/components/PasswordInput';
import { ApiError, authApi, type CodeSent } from '@/lib/api';
import { safeNext } from '@/lib/fmt';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Email manzil noto‘g‘ri'),
  password: z.string().min(1, 'Parolni kiriting'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { reload, user, loading } = useAuth();
  // Already signed in (e.g. the app was reopened): go straight in, never show the login form or let Back return to it.
  useEffect(() => { if (!loading && user) router.replace(safeNext()); }, [loading, user, router]);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<CodeSent | null>(null);
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { errors, isSubmitting } = formState;

  async function onSubmit(v: FormValues) {
    setError(null);
    try {
      await authApi.login(v.email, v.password);
      await reload();
      router.replace(safeNext());
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
        // The password was right but the email was never confirmed: send a fresh code and continue verification.
        try {
          setVerify(await authApi.resend(v.email));
        } catch (e2) {
          setError(e2 instanceof ApiError ? e2.message : 'Xatolik yuz berdi.');
        }
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi.');
    }
  }

  if (verify) {
    return (
      <AuthShell>
        <VerifyFlow
          email={verify.email}
          expiresInSec={verify.expiresInSec}
          resendAfterSec={verify.resendAfterSec}
          intro={false}
          onChangeEmail={() => setVerify(null)}
          onVerified={async () => {
            await reload();
            router.replace(safeNext());
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Tizimga kirish"
      subtitle="Hisobingizga email va parol bilan kiring."
      footer={
        <>
          Hisobingiz yo‘qmi?{' '}
          <Link href="/register" className="font-semibold text-brand-700">
            Ro‘yxatdan o‘tish
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" type="email" inputMode="email" autoComplete="username" className={`input ${errors.email ? 'input-error' : ''}`} {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Parol
          </label>
          <PasswordInput id="password" autoComplete="current-password" className={`input ${errors.password ? 'input-error' : ''}`} {...register('password')} />
          <FieldError message={errors.password?.message} />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Kirilmoqda…' : 'Kirish'}
        </button>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand-700">
            Parolni unutdingizmi?
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
