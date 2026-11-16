import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('Email manzil noto‘g‘ri');

const password = z
  .string()
  .min(8, 'Parol kamida 8 ta belgi bo‘lsin')
  .max(128)
  .regex(/[A-Za-z]/, 'Parolda kamida bitta harf bo‘lsin')
  .regex(/\d/, 'Parolda kamida bitta raqam bo‘lsin');

const code = z.string().regex(/^\d{6}$/, 'Kod 6 ta raqamdan iborat');

const phone = z
  .string()
  .transform((s) => s.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+998\d{9}$/, 'Telefon +998XXXXXXXXX ko‘rinishida bo‘lsin'));

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Ism kamida 2 ta belgi').max(80),
  email,
  phone: phone.optional(),
  password,
  role: z.enum(['BUYER', 'SELLER']),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Shartlarga rozilik berish shart' }) }),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({ email, code });
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;

export const emailOnlySchema = z.object({ email });
export type EmailOnlyDto = z.infer<typeof emailOnlySchema>;

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export type LoginDto = z.infer<typeof loginSchema>;

export const resetPasswordSchema = z.object({ email, code, newPassword: password });
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200).optional() });
export type RefreshDto = z.infer<typeof refreshSchema>;

export const phoneSendSchema = z.object({ phone });
export const phoneVerifySchema = z.object({ phone, code });
