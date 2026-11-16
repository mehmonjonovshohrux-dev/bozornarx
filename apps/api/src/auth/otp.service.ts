import { Injectable } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { Inject } from '@nestjs/common';
import { AppError } from '../common/app-error';
import { ENV, Env } from '../config/env';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  checkOtp,
  checkResend,
  generateOtp,
  hashOtp,
} from '../domain/otp.core';
import { PrismaService } from '../prisma/prisma.service';

export interface IssuedOtp {
  code: string; // returned only to be put into the email; never logged, never sent to the client
  expiresInSec: number;
  resendAfterSec: number;
}

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService, @Inject(ENV) private readonly env: Env) {}

  async issue(user: { id: string; email: string }, purpose: OtpPurpose): Promise<IssuedOtp> {
    const now = new Date();
    const recent = await this.prisma.emailVerification.findMany({
      where: { userId: user.id, purpose, createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) } },
      select: { createdAt: true },
    });
    const gate = checkResend(
      recent.map((r) => r.createdAt),
      now,
    );
    if (!gate.ok) {
      throw new AppError(
        429,
        gate.reason === 'COOLDOWN' ? 'OTP_COOLDOWN' : 'OTP_HOURLY_LIMIT',
        gate.reason === 'COOLDOWN' ? `Yangi kod uchun ${gate.retryAfterSec} soniya kuting.` : 'Soatiga yuborish limiti tugadi. Keyinroq urinib ko‘ring.',
        { retryAfterSec: gate.retryAfterSec },
      );
    }

    const code = generateOtp();
    await this.prisma.$transaction([
      // only the newest code is valid
      this.prisma.emailVerification.updateMany({ where: { userId: user.id, purpose, consumedAt: null }, data: { consumedAt: now } }),
      this.prisma.emailVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          purpose,
          codeHash: hashOtp(code, { userId: user.id, purpose, pepper: this.env.OTP_HASH_PEPPER }),
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        },
      }),
    ]);
    return { code, expiresInSec: OTP_TTL_MS / 1000, resendAfterSec: OTP_RESEND_COOLDOWN_MS / 1000 };
  }

  /** If the email could not be sent, kill the code so the user can ask again at once. */
  async discardLatest(userId: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.emailVerification.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  }

  /** Throws AppError unless `code` is the valid, unused, unexpired code for this user and purpose. Consumes it on success. */
  async verify(userId: string, purpose: OtpPurpose, code: string): Promise<void> {
    const now = new Date();
    const record = await this.prisma.emailVerification.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const result = checkOtp(record, code, { userId, purpose, pepper: this.env.OTP_HASH_PEPPER }, now);

    if (result.ok && record) {
      // Atomic single-use: only one concurrent request can flip consumedAt from null.
      const claimed = await this.prisma.emailVerification.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: now } });
      if (claimed.count === 1) return;
      throw new AppError(400, 'INVALID_CODE', 'Kod noto‘g‘ri yoki eskirgan.');
    }
    if (result.ok) throw new AppError(400, 'INVALID_CODE', 'Kod noto‘g‘ri yoki eskirgan.');

    switch (result.reason) {
      case 'MISMATCH':
        if (record) await this.prisma.emailVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
        throw new AppError(400, 'INVALID_CODE', 'Kod noto‘g‘ri.', { attemptsLeft: result.attemptsLeft, maxAttempts: OTP_MAX_ATTEMPTS });
      case 'EXPIRED':
        throw new AppError(400, 'CODE_EXPIRED', 'Kod muddati tugagan. Yangi kod so‘rang.');
      case 'TOO_MANY_ATTEMPTS':
        throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Urinishlar soni tugadi. Yangi kod so‘rang.');
      default:
        throw new AppError(400, 'INVALID_CODE', 'Kod noto‘g‘ri yoki eskirgan.');
    }
  }
}
