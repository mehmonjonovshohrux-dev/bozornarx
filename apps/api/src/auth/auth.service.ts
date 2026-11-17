import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/app-error';
import { ENV, Env } from '../config/env';
import { ROLES, Role } from '../domain/permissions';
import { MAIL_PORT, MailPort, MailTemplate } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailOnlyDto, LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from './auth.schemas';
import { OtpService } from './otp.service';

export interface ClientCtx {
  ip: string | null;
  userAgent: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  sessionId: string;
}

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Argon2id, OWASP minimum profile (19 MiB, 2 iterations, 1 lane).
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const fmtTime = () => new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

@Injectable()
export class AuthService {
  private readonly log = new Logger('auth');
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ───────────── registration and email verification ─────────────

  async register(dto: RegisterDto, ctx: ClientCtx) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing?.emailVerifiedAt) throw new AppError(409, 'EMAIL_TAKEN', 'Bu email bilan hisob allaqachon mavjud. Kirishga urinib ko‘ring.');
    if (dto.phone) {
      const phoneOwner = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (phoneOwner && phoneOwner.id !== existing?.id && phoneOwner.phoneVerifiedAt) {
        throw new AppError(409, 'PHONE_TAKEN', 'Bu telefon raqami band.');
      }
    }

    if (!(await this.prisma.role.findUnique({ where: { name: dto.role }, select: { id: true } }))) {
      throw new AppError(500, 'REFERENCE_DATA_MISSING', 'Tizim sozlanmagan (rollar yo‘q). Administrator bilan bog‘laning.');
    }

    // Someone else's registration is still waiting for its code: do not let a new request replace it.
    if (existing) {
      const live = await this.prisma.emailVerification.findFirst({
        where: { userId: existing.id, purpose: 'REGISTER', consumedAt: null, expiresAt: { gt: new Date() } },
        select: { expiresAt: true },
      });
      if (live) {
        throw new AppError(409, 'REGISTRATION_IN_PROGRESS', 'Bu email uchun tasdiqlash jarayoni davom etmoqda. Emailga kelgan kodni kiriting yoki kodning muddati tugashini kuting.', {
          retryAfterSec: Math.max(1, Math.ceil((live.expiresAt.getTime() - Date.now()) / 1000)),
        });
      }
    }

    const passwordHash = await hash(dto.password, ARGON);
    const pending = { passwordHash, fullName: dto.fullName, phone: dto.phone ?? null, roleName: dto.role };
    let user: User;
    if (existing) {
      // The users row (and its password) is NOT touched; the new details wait until the code is confirmed.
      await this.prisma.pendingRegistration.upsert({ where: { userId: existing.id }, create: { userId: existing.id, ...pending }, update: { ...pending, createdAt: new Date() } });
      user = existing;
    } else {
      try {
        const unusable = await hash(randomBytes(32).toString('hex'), ARGON); // nobody knows this password
        user = await this.prisma.user.create({
          data: { email: dto.email, passwordHash: unusable, pending: { create: pending } },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new AppError(409, 'EMAIL_TAKEN', 'Bu email bilan hisob mavjud.');
        }
        throw e;
      }
    }

    await this.audit.record({ actorId: user.id, action: 'AUTH_REGISTER', entityType: 'user', entityId: user.id, after: { role: dto.role }, ip: ctx.ip, userAgent: ctx.userAgent });
    return this.sendCode(user, 'REGISTER', 'verify_email', dto.fullName);
  }

  async resendVerification(dto: EmailOnlyDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { profile: true } });
    if (!user || user.emailVerifiedAt) {
      // Same answer as success: do not reveal which emails are registered.
      return { email: dto.email, expiresInSec: 300, resendAfterSec: 60 };
    }
    return this.sendCode(user, 'REGISTER', 'verify_email', user.profile?.fullName);
  }

  async verifyEmail(dto: VerifyEmailDto, ctx: ClientCtx) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.emailVerifiedAt) throw new AppError(400, 'INVALID_CODE', 'Kod noto‘g‘ri yoki eskirgan.');

    const pending = await this.prisma.pendingRegistration.findUnique({ where: { userId: user.id } });
    if (!pending) throw new AppError(400, 'INVALID_CODE', 'Kod noto‘g‘ri yoki eskirgan.');
    await this.otp.verify(user.id, 'REGISTER', dto.code);

    const role = await this.prisma.role.findUnique({ where: { name: pending.roleName } });
    if (!role) throw new AppError(500, 'REFERENCE_DATA_MISSING', 'Tizim sozlanmagan (rollar yo‘q).');
    // Phone is applied only if nobody verified it meanwhile.
    const phoneTaken = pending.phone ? await this.prisma.user.findFirst({ where: { phone: pending.phone, phoneVerifiedAt: { not: null }, id: { not: user.id } }, select: { id: true } }) : null;
    const [verified] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: pending.passwordHash,
          phone: pending.phone && !phoneTaken ? pending.phone : null,
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
          profile: { upsert: { create: { fullName: pending.fullName }, update: { fullName: pending.fullName } } },
          roles: { deleteMany: {}, create: { roleId: role.id } },
        },
      }),
      this.prisma.pendingRegistration.delete({ where: { userId: user.id } }),
    ]);
    await this.audit.record({ actorId: user.id, action: 'AUTH_EMAIL_VERIFIED', entityType: 'user', entityId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });
    void this.safeMail('welcome', verified.email, { url: `${this.env.APP_URL}/dashboard` });
    return this.createSession(verified, ctx);
  }

  // ───────────── login, refresh, logout, sessions ─────────────

  async login(dto: LoginDto, ctx: ClientCtx) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { profile: true } });
    const now = new Date();

    if (user?.lockedUntil && user.lockedUntil > now) {
      throw new AppError(429, 'ACCOUNT_LOCKED', 'Ko‘p marta noto‘g‘ri urinish. Birozdan keyin qayta urinib ko‘ring.', {
        retryAfterSec: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000),
      });
    }

    // Always run one hash verification so response time does not reveal whether the email exists.
    const ok = await verify(user?.passwordHash ?? (await this.getDummyHash()), dto.password).catch(() => false);
    if (!user || !ok) {
      if (user) await this.registerFailedLogin(user, ctx);
      await this.audit.record({ actorId: user?.id ?? null, action: 'AUTH_LOGIN_FAILED', entityType: 'user', entityId: user?.id ?? null, ip: ctx.ip, userAgent: ctx.userAgent });
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email yoki parol noto‘g‘ri.');
    }
    if (user.status === 'SUSPENDED' || user.status === 'DELETED') throw new AppError(403, 'ACCOUNT_DISABLED', 'Hisob faol emas.');
    if (!user.emailVerifiedAt) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Emailingiz tasdiqlanmagan.', { email: user.email });

    if (user.failedLogins > 0 || user.lockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

    const priorSessions = await this.prisma.session.count({ where: { userId: user.id } });
    const knownDevice = ctx.userAgent ? await this.prisma.session.findFirst({ where: { userId: user.id, deviceHash: sha256(ctx.userAgent) }, select: { id: true } }) : null;
    const tokens = await this.createSession(user, ctx);
    await this.audit.record({ actorId: user.id, action: 'AUTH_LOGIN', entityType: 'session', entityId: tokens.sessionId, ip: ctx.ip, userAgent: ctx.userAgent });

    if (priorSessions > 0 && !knownDevice) {
      void this.safeMail('new_device', user.email, { name: user.profile?.fullName, device: (ctx.userAgent ?? '').slice(0, 160), ip: ctx.ip ?? '', when: fmtTime() });
    }
    return tokens;
  }

  async refresh(refreshToken: string, ctx: ClientCtx) {
    const hash = sha256(refreshToken);
    const now = new Date();
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });

    if (!session) {
      // A token that was already rotated away being presented again means it leaked: revoke everything for that user.
      const stale = await this.prisma.session.findFirst({ where: { prevRefreshHash: hash } });
      if (stale) {
        await this.prisma.session.updateMany({ where: { userId: stale.userId, revokedAt: null }, data: { revokedAt: now } });
        await this.audit.record({ actorId: stale.userId, action: 'AUTH_REFRESH_REUSE', entityType: 'user', entityId: stale.userId, ip: ctx.ip, userAgent: ctx.userAgent });
        throw new AppError(401, 'TOKEN_REUSED', 'Xavfsizlik sababli barcha seanslar yopildi. Qayta kiring.');
      }
      throw new AppError(401, 'INVALID_REFRESH', 'Seans topilmadi. Qayta kiring.');
    }
    if (session.revokedAt || session.expiresAt < now || session.user.status !== 'ACTIVE') {
      throw new AppError(401, 'SESSION_REVOKED', 'Seans tugagan. Qayta kiring.');
    }

    const newRefresh = randomBytes(48).toString('base64url');
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: sha256(newRefresh), prevRefreshHash: hash, lastUsedAt: now, expiresAt: this.refreshExpiry(now) },
    });
    const roles = await this.rolesOf(session.userId);
    return this.signTokens(session.userId, session.id, roles, newRefresh);
  }

  async logout(sessionId: string, userId: string, ctx: ClientCtx) {
    await this.prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ actorId: userId, action: 'AUTH_LOGOUT', entityType: 'session', entityId: sessionId, ip: ctx.ip, userAgent: ctx.userAgent });
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
    });
    return rows.map((r) => ({ ...r, current: r.id === currentSessionId }));
  }

  async revokeSession(userId: string, sessionId: string, ctx: ClientCtx) {
    // userId in the filter = a user can only ever revoke their own sessions (no IDOR).
    const r = await this.prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (r.count === 0) throw new AppError(404, 'NOT_FOUND', 'Seans topilmadi.');
    await this.audit.record({ actorId: userId, action: 'AUTH_SESSION_REVOKED', entityType: 'session', entityId: sessionId, ip: ctx.ip, userAgent: ctx.userAgent });
  }

  // ───────────── password reset ─────────────

  async forgotPassword(dto: EmailOnlyDto) {
    const answer = { expiresInSec: 300, resendAfterSec: 60 };
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { profile: true } });
    // Identical answer whether or not the account exists.
    if (!user || !user.emailVerifiedAt || user.status !== 'ACTIVE') return answer;
    try {
      await this.sendCode(user, 'PASSWORD_RESET', 'password_reset', user.profile?.fullName);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      this.log.warn(`password reset code not sent (${e.code})`);
    }
    return answer;
  }

  /** Signed-in person changes their own password: the current one must be right; every OTHER device is signed out. */
  async changePassword(userId: string, sessionId: string, current: string, next: string, ctx: ClientCtx) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi.');
    if (!(await verify(user.passwordHash, current).catch(() => false))) throw new AppError(400, 'WRONG_PASSWORD', 'Joriy parol noto‘g‘ri.');
    if (current === next) throw new AppError(400, 'SAME_PASSWORD', 'Yangi parol joriy paroldan farq qilsin.');
    const passwordHash = await hash(next, ARGON);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } }),
      this.prisma.session.updateMany({ where: { userId, revokedAt: null, id: { not: sessionId } }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.record({ actorId: userId, action: 'AUTH_PASSWORD_CHANGED', entityType: 'user', entityId: userId, ip: ctx.ip, userAgent: ctx.userAgent });
    void this.safeMail('login_alert', user.email, { name: user.profile?.fullName, title: 'Parol o‘zgartirildi', message: 'Hisobingiz paroli o‘zgartirildi. Boshqa qurilmalardagi seanslar yopildi.', when: fmtTime() });
  }

  async resetPassword(dto: ResetPasswordDto, ctx: ClientCtx) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { profile: true } });
    if (!user || !user.emailVerifiedAt) throw new AppError(400, 'INVALID_CODE', 'Kod noto‘g‘ri yoki eskirgan.');

    await this.otp.verify(user.id, 'PASSWORD_RESET', dto.code);
    const passwordHash = await hash(dto.newPassword, ARGON);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash, failedLogins: 0, lockedUntil: null } }),
      this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }), // sign out everywhere
    ]);
    await this.audit.record({ actorId: user.id, action: 'AUTH_PASSWORD_RESET', entityType: 'user', entityId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });
    void this.safeMail('login_alert', user.email, {
      name: user.profile?.fullName,
      title: 'Parol o‘zgartirildi',
      message: 'Hisobingiz paroli o‘zgartirildi va barcha seanslar yopildi.',
      when: fmtTime(),
    });
  }

  // ───────────── helpers ─────────────

  private async sendCode(user: { id: string; email: string }, purpose: 'REGISTER' | 'PASSWORD_RESET', template: MailTemplate, name?: string | null) {
    const issued = await this.otp.issue(user, purpose);
    try {
      await this.mail.send(template, user.email, { name: name ?? '', code: issued.code, expiresMin: issued.expiresInSec / 60 });
    } catch (e) {
      await this.otp.discardLatest(user.id, purpose);
      throw e;
    }
    return { email: user.email, expiresInSec: issued.expiresInSec, resendAfterSec: issued.resendAfterSec };
  }

  /** Notification emails must never break the main action. Failures are logged without addresses. */
  private async safeMail(template: MailTemplate, to: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.mail.send(template, to, data);
    } catch {
      this.log.warn(`notification email not sent (template=${template})`);
    }
  }

  private async registerFailedLogin(user: User & { profile: { fullName: string } | null }, ctx: ClientCtx) {
    const failed = user.failedLogins + 1;
    if (failed >= MAX_FAILED_LOGINS) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } });
      await this.audit.record({ actorId: user.id, action: 'AUTH_ACCOUNT_LOCKED', entityType: 'user', entityId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });
      void this.safeMail('login_alert', user.email, {
        name: user.profile?.fullName,
        title: 'Hisobga kirishga ko‘p urinish',
        message: `Noto‘g‘ri parol ${MAX_FAILED_LOGINS} marta kiritildi. Hisob ${LOCK_MINUTES} daqiqaga vaqtincha bloklandi.`,
        when: fmtTime(),
      });
    } else {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: failed } });
    }
  }

  private getDummyHash(): Promise<string> {
    let h = this.dummyHash;
    if (!h) {
      h = hash(randomBytes(16).toString('hex'), ARGON);
      this.dummyHash = h;
    }
    return h;
  }

  private refreshExpiry(from: Date): Date {
    return new Date(from.getTime() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private async rolesOf(userId: string): Promise<Role[]> {
    const rows = await this.prisma.userRole.findMany({ where: { userId }, select: { role: { select: { name: true } } } });
    return rows.map((r) => r.role.name).filter((n): n is Role => (ROLES as readonly string[]).includes(n));
  }

  private async createSession(user: User, ctx: ClientCtx): Promise<TokenPair> {
    const refresh = randomBytes(48).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(refresh),
        deviceHash: ctx.userAgent ? sha256(ctx.userAgent) : null,
        userAgent: ctx.userAgent ? ctx.userAgent.slice(0, 255) : null,
        ip: ctx.ip,
        expiresAt: this.refreshExpiry(new Date()),
      },
    });
    return this.signTokens(user.id, session.id, await this.rolesOf(user.id), refresh);
  }

  private async signTokens(userId: string, sessionId: string, roles: Role[], refreshToken: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: sessionId, roles }, { expiresIn: this.env.ACCESS_TOKEN_TTL_SEC });
    return { accessToken, refreshToken, expiresInSec: this.env.ACCESS_TOKEN_TTL_SEC, sessionId };
  }
}
