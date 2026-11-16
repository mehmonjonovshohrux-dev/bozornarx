import { Logger, Module } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { AppError } from '../common/app-error';
import { ENV, Env } from '../config/env';

export type MailTemplate =
  | 'verify_email'
  | 'welcome'
  | 'password_reset'
  | 'login_alert'
  | 'new_device'
  | 'contract'
  | 'order'
  | 'price_alert';

export const MAIL_PORT = Symbol('MAIL_PORT');

export interface MailPort {
  send(template: MailTemplate, to: string, data: Record<string, unknown>): Promise<void>;
}

/** MAIL_MODE=disabled: every send fails loudly. Not allowed in production (see env.ts). */
export class DisabledMail implements MailPort {
  async send(): Promise<void> {
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'Email xizmati sozlanmagan. Administrator bilan bog‘laning.');
  }
}

/**
 * Sends through the Google Apps Script web app (apps/mail-script/Code.gs).
 * The request is signed with HMAC-SHA256(secret, ts.nonce.body). The secret is never transmitted.
 * Email address and code travel only inside the HTTPS POST body, never in the URL, and are never logged.
 */
export class AppsScriptMail implements MailPort {
  private readonly log = new Logger('mail');
  constructor(private readonly url: string, private readonly secret: string) {}

  async send(template: MailTemplate, to: string, data: Record<string, unknown>): Promise<void> {
    const ts = Date.now();
    const nonce = randomBytes(16).toString('hex');
    const body = JSON.stringify({ template, to, data });
    const sig = createHmac('sha256', this.secret).update(`${ts}.${nonce}.${body}`).digest('hex');

    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ts, nonce, body, sig }),
        redirect: 'follow', // Apps Script answers through a 302 to script.googleusercontent.com
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      this.log.error(`apps script unreachable (template=${template})`);
      throw new AppError(503, 'MAIL_UNAVAILABLE', 'Email yuborib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.');
    }

    let json: { ok?: boolean; code?: string } | null = null;
    try {
      json = (await res.json()) as { ok?: boolean; code?: string };
    } catch {
      // Usually Google returned its sign-in HTML page: the web app is not deployed with "Anyone" access.
      this.log.error(`apps script returned a non-JSON response (http ${res.status}); check that the web app is deployed with access "Anyone"`);
      throw new AppError(502, 'MAIL_BAD_RESPONSE', 'Email xizmati noto‘g‘ri javob qaytardi.');
    }
    if (json?.ok === true) return;

    const code = typeof json?.code === 'string' ? json.code : 'UNKNOWN';
    this.log.error(`apps script refused (template=${template}, code=${code})`);
    if (code === 'QUOTA_EXCEEDED') throw new AppError(503, 'MAIL_QUOTA_EXCEEDED', 'Kunlik email limiti tugagan. Keyinroq urinib ko‘ring.');
    throw new AppError(502, 'MAIL_FAILED', 'Email yuborib bo‘lmadi.');
  }
}

@Module({
  providers: [
    {
      provide: MAIL_PORT,
      inject: [ENV],
      useFactory: (env: Env): MailPort =>
        env.MAIL_MODE === 'apps_script' ? new AppsScriptMail(env.GAS_URL as string, env.GAS_SECRET as string) : new DisabledMail(),
    },
  ],
  exports: [MAIL_PORT],
})
export class MailModule {}
