'use client';

import { PasswordInput } from '@/components/PasswordInput';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthShell, FieldError } from '@/components/AuthShell';
import { VerifyFlow } from '@/components/auth/VerifyFlow';
import { ApiError, authApi, type CodeSent } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Ism kamida 2 ta belgi bo‘lsin').max(80),
  email: z.string().trim().toLowerCase().email('Email manzil noto‘g‘ri'),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\+998\d{9}$/.test(v.replace(/[\s()-]/g, '')), 'Telefon +998XXXXXXXXX ko‘rinishida bo‘lsin'),
  password: z
    .string()
    .min(8, 'Parol kamida 8 ta belgi bo‘lsin')
    .regex(/[A-Za-z]/, 'Parolda kamida bitta harf bo‘lsin')
    .regex(/\d/, 'Parolda kamida bitta raqam bo‘lsin'),
  role: z.enum(['BUYER', 'SELLER']),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Davom etish uchun rozilik bering' }) }),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { reload } = useAuth();
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'BUYER', fullName: '', email: '', phone: '', password: '' },
  });
  const { register, handleSubmit, watch, setValue, formState } = form;
  const role = watch('role');
  const { errors, isSubmitting } = formState;

  async function onSubmit(v: FormValues) {
    setServerError(null);
    try {
      const phone = v.phone ? v.phone.replace(/[\s()-]/g, '') : undefined;
      setSent(await authApi.register({ fullName: v.fullName, email: v.email, phone, password: v.password, role: v.role, acceptTerms: true }));
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi.');
    }
  }

  return (
    <AuthShell
      footer={
        !sent && (
          <>
            Hisobingiz bormi?{' '}
            <Link href="/login" className="font-semibold text-brand-700">
              Kirish
            </Link>
          </>
        )
      }
    >
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.form
            key="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.28 }}
            className="space-y-4"
          >
            <div>
              <h1 className="text-2xl font-extrabold text-brand-800">Ro‘yxatdan o‘tish</h1>
              <p className="mt-1 text-ink-soft">Hisob yarating va email orqali tasdiqlang.</p>
            </div>

            <div role="radiogroup" aria-label="Hisob turi" className="grid grid-cols-2 gap-2 rounded-xl bg-cream-100 p-1">
              {(
                [
                  ['BUYER', 'Xaridor'],
                  ['SELLER', 'Sotuvchi'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={role === value}
                  onClick={() => setValue('role', value)}
                  className={`min-h-[44px] rounded-lg text-[15px] font-semibold transition ${role === value ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-soft'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label className="label" htmlFor="fullName">
                Ism va familiya
              </label>
              <input id="fullName" autoComplete="name" className={`input ${errors.fullName ? 'input-error' : ''}`} {...register('fullName')} />
              <FieldError message={errors.fullName?.message} />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" type="email" inputMode="email" autoComplete="email" className={`input ${errors.email ? 'input-error' : ''}`} {...register('email')} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Telefon raqam <span className="font-normal text-ink-muted">(ixtiyoriy)</span>
              </label>
              <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" className={`input ${errors.phone ? 'input-error' : ''}`} {...register('phone')} />
              <FieldError message={errors.phone?.message} />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Parol
              </label>
              <PasswordInput id="password" autoComplete="new-password" className={`input ${errors.password ? 'input-error' : ''}`} {...register('password')} />
              <p className="mt-1.5 text-xs text-ink-muted">Kamida 8 belgi, harf va raqam bilan.</p>
              <FieldError message={errors.password?.message} />
            </div>

            <label className="flex items-start gap-3 text-sm text-ink-soft">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#047857]" {...register('acceptTerms')} />
              <span><Link href="/terms" target="_blank" className="font-semibold text-brand-700">Foydalanish shartlari</Link> va <Link href="/privacy" target="_blank" className="font-semibold text-brand-700">maxfiylik siyosati</Link>ga, shaxsiy ma’lumotlarim shu hujjatda ko‘rsatilgan maqsadlarda qayta ishlanishiga roziman.</span>
            </label>
            <FieldError message={errors.acceptTerms?.message} />

            {serverError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger" role="alert">
                {serverError}
              </p>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Yuborilmoqda…' : 'Ro‘yxatdan o‘tish'}
            </button>
          </motion.form>
        ) : (
          <VerifyFlow
            key="verify"
            email={sent.email}
            expiresInSec={sent.expiresInSec}
            resendAfterSec={sent.resendAfterSec}
            intro
            onChangeEmail={() => setSent(null)}
            onVerified={async () => {
              await reload();
              router.replace('/dashboard');
            }}
          />
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
