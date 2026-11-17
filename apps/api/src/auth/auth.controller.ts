import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { ZodPipe } from '../common/http';
import { ENV, Env } from '../config/env';
import { MockSmsService } from '../sms/sms.service';
import {
  EmailOnlyDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
  emailOnlySchema,
  changePasswordSchema,
  loginSchema,
  phoneSendSchema,
  phoneVerifySchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schemas';
import { AuthService, ClientCtx, TokenPair } from './auth.service';
import { AuthedRequest, JwtAuthGuard } from './guards';

const COOKIE = 'bn_rt';
const uuid = z.string().uuid();

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/**
 * Two kinds of clients:
 *  - web (header `x-client: web`): the refresh token lives in an httpOnly cookie and is NOT returned in the JSON body.
 *    The custom header cannot be sent cross-site without a CORS preflight, which is the CSRF defence for cookie auth.
 *  - mobile/other: the refresh token is returned in the JSON body and sent back in the body.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sms: MockSmsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private ctx(req: Request): ClientCtx {
    return { ip: req.ip ?? null, userAgent: (req.headers['user-agent'] as string | undefined) ?? null };
  }
  private isWeb(req: Request): boolean {
    return req.headers['x-client'] === 'web';
  }
  private sendTokens(req: Request, res: Response, t: TokenPair) {
    if (this.isWeb(req)) {
      res.cookie(COOKIE, t.refreshToken, {
        httpOnly: true,
        secure: this.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      });
      return { accessToken: t.accessToken, expiresInSec: t.expiresInSec };
    }
    return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresInSec: t.expiresInSec };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register and send a 6-digit email code (valid 5 minutes, resend after 60 s)' })
  register(@Body(new ZodPipe(registerSchema)) dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.ctx(req));
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(@Body(new ZodPipe(verifyEmailSchema)) dto: VerifyEmailDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.sendTokens(req, res, await this.auth.verifyEmail(dto, this.ctx(req)));
  }

  @Post('resend-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resendOtp(@Body(new ZodPipe(emailOnlySchema)) dto: EmailOnlyDto) {
    return this.auth.resendVerification(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body(new ZodPipe(loginSchema)) dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.sendTokens(req, res, await this.auth.login(dto, this.ctx(req)));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Body(new ZodPipe(refreshSchema)) dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.isWeb(req) ? readCookie(req, COOKIE) : dto.refreshToken;
    if (!token) throw new AppError(401, 'INVALID_REFRESH', 'Seans topilmadi. Qayta kiring.');
    try {
      return this.sendTokens(req, res, await this.auth.refresh(token, this.ctx(req)));
    } catch (e) {
      if (this.isWeb(req)) res.clearCookie(COOKIE, { path: '/' });
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.user.sessionId, req.user.id, this.ctx(req));
    res.clearCookie(COOKIE, { path: '/' });
    return { loggedOut: true };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async changePassword(@Req() req: AuthedRequest, @Body(new ZodPipe(changePasswordSchema)) b: z.infer<typeof changePasswordSchema>) {
    await this.auth.changePassword(req.user.id, req.user.sessionId, b.currentPassword, b.newPassword, this.ctx(req));
    return { changed: true };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sessions(@Req() req: AuthedRequest) {
    return this.auth.listSessions(req.user.id, req.user.sessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async revoke(@Param('id', new ZodPipe(uuid)) id: string, @Req() req: AuthedRequest) {
    await this.auth.revokeSession(req.user.id, id, this.ctx(req));
    return { revoked: true };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgot(@Body(new ZodPipe(emailOnlySchema)) dto: EmailOnlyDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reset(@Body(new ZodPipe(resetPasswordSchema)) dto: ResetPasswordDto, @Req() req: Request) {
    await this.auth.resetPassword(dto, this.ctx(req));
    return { passwordChanged: true };
  }

  // Phone OTP: no SMS provider is contracted yet. These routes exist so clients can be built against them,
  // and they answer 503 PROVIDER_NOT_CONFIGURED until a real provider adapter replaces MockSmsService.
  @Post('phone/send')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  phoneSend(@Body(new ZodPipe(phoneSendSchema)) _dto: z.infer<typeof phoneSendSchema>) {
    this.sms.assertConfigured();
  }

  @Post('phone/verify')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  phoneVerify(@Body(new ZodPipe(phoneVerifySchema)) _dto: z.infer<typeof phoneVerifySchema>) {
    this.sms.assertConfigured();
  }
}
