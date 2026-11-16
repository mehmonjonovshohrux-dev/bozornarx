import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOtp,
  hashOtp,
  checkOtp,
  checkResend,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_SENDS_PER_HOUR,
  type OtpRecord,
} from './otp.core.ts';

const ctx = { userId: 'u1', purpose: 'REGISTER', pepper: 'p'.repeat(32) };
const t0 = new Date('2026-11-16T10:00:00Z');
const rec = (code: string, over: Partial<OtpRecord> = {}): OtpRecord => ({
  codeHash: hashOtp(code, ctx),
  attempts: 0,
  expiresAt: new Date(t0.getTime() + OTP_TTL_MS),
  consumedAt: null,
  createdAt: t0,
  ...over,
});

test('generated codes are 6 digits, including leading zeros', () => {
  for (let i = 0; i < 2000; i++) assert.match(generateOtp(), /^\d{6}$/);
});

test('hash depends on user, purpose, pepper and code', () => {
  const h = hashOtp('123456', ctx);
  assert.notEqual(h, hashOtp('123457', ctx));
  assert.notEqual(h, hashOtp('123456', { ...ctx, userId: 'u2' }));
  assert.notEqual(h, hashOtp('123456', { ...ctx, purpose: 'PASSWORD_RESET' }));
  assert.notEqual(h, hashOtp('123456', { ...ctx, pepper: 'q'.repeat(32) }));
  assert.doesNotMatch(h, /123456/);
});

test('correct code inside 5 minutes is accepted', () => {
  assert.deepEqual(checkOtp(rec('123456'), '123456', ctx, new Date(t0.getTime() + 4 * 60 * 1000)), { ok: true });
});

test('code expires at exactly 5 minutes', () => {
  const r = checkOtp(rec('123456'), '123456', ctx, new Date(t0.getTime() + OTP_TTL_MS));
  assert.deepEqual(r, { ok: false, reason: 'EXPIRED' });
});

test('wrong code reports attempts left, 5th wrong guess leaves 0', () => {
  assert.deepEqual(checkOtp(rec('123456'), '000000', ctx, t0), { ok: false, reason: 'MISMATCH', attemptsLeft: 4 });
  assert.deepEqual(checkOtp(rec('123456', { attempts: 4 }), '000000', ctx, t0), { ok: false, reason: 'MISMATCH', attemptsLeft: 0 });
});

test('after max attempts even the correct code is refused', () => {
  const r = checkOtp(rec('123456', { attempts: OTP_MAX_ATTEMPTS }), '123456', ctx, t0);
  assert.deepEqual(r, { ok: false, reason: 'TOO_MANY_ATTEMPTS' });
});

test('a consumed code cannot be used again (single use)', () => {
  const r = checkOtp(rec('123456', { consumedAt: t0 }), '123456', ctx, t0);
  assert.deepEqual(r, { ok: false, reason: 'CONSUMED' });
});

test('missing record and malformed input', () => {
  assert.deepEqual(checkOtp(null, '123456', ctx, t0), { ok: false, reason: 'NOT_FOUND' });
  const bad = checkOtp(rec('123456'), '12345a', ctx, t0);
  assert.equal(bad.ok, false);
  assert.equal(bad.ok === false && bad.reason, 'MISMATCH');
});

test('resend: first send is free, then 60s cooldown with remaining seconds', () => {
  assert.deepEqual(checkResend([], t0), { ok: true });
  const r = checkResend([t0], new Date(t0.getTime() + 20_000));
  assert.deepEqual(r, { ok: false, reason: 'COOLDOWN', retryAfterSec: 40 });
  assert.deepEqual(checkResend([t0], new Date(t0.getTime() + OTP_RESEND_COOLDOWN_MS)), { ok: true });
});

test('resend: hourly cap blocks the 6th code within an hour', () => {
  const sends = Array.from({ length: OTP_MAX_SENDS_PER_HOUR }, (_, i) => new Date(t0.getTime() + i * 61_000));
  const now = new Date(t0.getTime() + OTP_MAX_SENDS_PER_HOUR * 61_000);
  const r = checkResend(sends, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, 'HOURLY_LIMIT');
  const later = new Date(t0.getTime() + 61 * 60 * 1000 + 5 * 61_000);
  assert.deepEqual(checkResend(sends, later), { ok: true });
});
