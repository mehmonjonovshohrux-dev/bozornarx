// Pure OTP rules. No database, no framework, so every rule can be unit-tested.
// The service layer loads records, calls these functions, and writes the result inside a transaction.
// The code itself is never stored or logged: only an HMAC (keyed with a server-side pepper) is kept.

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000; // code lives 5 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // at most one code per 60 seconds
export const OTP_MAX_ATTEMPTS = 5; // wrong guesses before the code is dead
export const OTP_MAX_SENDS_PER_HOUR = 5;

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

export interface OtpContext {
  userId: string;
  purpose: string;
  pepper: string;
}

export function hashOtp(code: string, ctx: OtpContext): string {
  return createHmac('sha256', ctx.pepper).update(`${ctx.userId}:${ctx.purpose}:${code}`).digest('hex');
}

export interface OtpRecord {
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'CONSUMED' | 'TOO_MANY_ATTEMPTS' }
  | { ok: false; reason: 'MISMATCH'; attemptsLeft: number };

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

/** Decide whether `code` is accepted. On MISMATCH the caller must increment `attempts` in the database. */
export function checkOtp(record: OtpRecord | null, code: string, ctx: OtpContext, now: Date): OtpCheck {
  if (!record) return { ok: false, reason: 'NOT_FOUND' };
  if (record.consumedAt) return { ok: false, reason: 'CONSUMED' };
  if (now.getTime() >= record.expiresAt.getTime()) return { ok: false, reason: 'EXPIRED' };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    return { ok: false, reason: 'MISMATCH', attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - record.attempts - 1) };
  }
  if (safeEqualHex(record.codeHash, hashOtp(code, ctx))) return { ok: true };
  return { ok: false, reason: 'MISMATCH', attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - record.attempts - 1) };
}

export type ResendCheck = { ok: true } | { ok: false; reason: 'COOLDOWN'; retryAfterSec: number } | { ok: false; reason: 'HOURLY_LIMIT'; retryAfterSec: number };

/** `previousSends` = createdAt of codes sent to this user for this purpose, any order. */
export function checkResend(previousSends: readonly Date[], now: Date): ResendCheck {
  const times = previousSends.map((d) => d.getTime()).sort((a, b) => b - a);
  const last = times[0];
  if (last !== undefined) {
    const wait = last + OTP_RESEND_COOLDOWN_MS - now.getTime();
    if (wait > 0) return { ok: false, reason: 'COOLDOWN', retryAfterSec: Math.ceil(wait / 1000) };
  }
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const inHour = times.filter((t) => t > hourAgo);
  if (inHour.length >= OTP_MAX_SENDS_PER_HOUR) {
    const oldest = inHour[inHour.length - 1] as number;
    return { ok: false, reason: 'HOURLY_LIMIT', retryAfterSec: Math.ceil((oldest + 60 * 60 * 1000 - now.getTime()) / 1000) };
  }
  return { ok: true };
}
