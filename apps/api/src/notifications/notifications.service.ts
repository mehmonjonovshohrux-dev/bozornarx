import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import webpush from 'web-push';
import { ENV, Env } from '../config/env';
import { MAIL_PORT, MailModule, MailPort, MailTemplate } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsHub } from './events.hub';

export interface NotifyInput {
  type: string; // PRICE_DROP, ORDER_STATUS, CONTRACT_WAITING, CHAT_MESSAGE, MODERATION, ...
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
  /** path inside the web app, opened when the notification is clicked */
  url?: string;
}
export interface MailOpt {
  template: MailTemplate;
  data: Record<string, unknown>;
}

export const NOTIF_CATEGORIES = ['ORDERS', 'CONTRACTS', 'PRICES', 'CHAT', 'DISPUTES', 'SYSTEM'] as const;
export type NotifCategory = (typeof NOTIF_CATEGORIES)[number];
export function categoryOf(type: string): NotifCategory {
  if (type.startsWith('ORDER') || type.startsWith('OFFER') || type === 'SALE' || type === 'PAYMENT') return 'ORDERS';
  if (type.startsWith('CONTRACT') || type.startsWith('SIGN') || type === 'NEW_VERSION' || type === 'SUBMITTED') return 'CONTRACTS';
  if (type.startsWith('PRICE')) return 'PRICES';
  if (type.startsWith('CHAT')) return 'CHAT';
  if (type === 'DISPUTE' || type === 'COMPLAINT') return 'DISPUTES';
  return 'SYSTEM';
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger('notifications');
  private readonly pushOn: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: EventsHub,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.pushOn = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
    if (this.pushOn) webpush.setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    else this.log.warn('web push is off (VAPID_* not set); in-app and email notifications still work');
  }

  pushEnabled(): boolean {
    return this.pushOn;
  }
  vapidPublicKey(): string | null {
    return this.pushOn ? this.env.VAPID_PUBLIC_KEY! : null;
  }

  /** Never throws: a failed notification must not break the business action that caused it. */
  async notify(userId: string, n: NotifyInput, opts: { email?: MailOpt; skipPush?: boolean } = {}): Promise<void> {
    try {
      const pref = await this.prisma.notificationPreference.findUnique({ where: { userId_category: { userId, category: categoryOf(n.type) } } });
      const wantInApp = pref?.inApp ?? true;
      const wantPhone = pref?.phone ?? true;
      if (!wantInApp && !wantPhone) return; // the person switched this category off completely
      const row = await this.prisma.notification.create({
        data: { userId, type: n.type, title: n.title, body: n.body, data: { ...(n.data ?? {}), url: n.url ?? '/dashboard' } as Prisma.InputJsonValue },
        select: { id: true, type: true, title: true, body: true, data: true, createdAt: true },
      });
      this.hub.emit(userId, 'notification', row);
      if (this.pushOn && wantPhone && !opts.skipPush && !this.hub.online(userId)) await this.push(userId, n);
      if (opts.email) {
        const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
        if (u?.emailVerifiedAt) await this.mail.send(opts.email.template, u.email, opts.email.data).catch(() => this.log.warn(`email not sent (template=${opts.email!.template})`));
      }
    } catch {
      this.log.error(`notify failed type=${n.type}`);
    }
  }

  private async push(userId: string, n: NotifyInput): Promise<void> {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url ?? '/dashboard' });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined); // browser unsubscribed
        }
      }),
    );
  }
}

@Global()
@Module({ imports: [MailModule], providers: [EventsHub, NotificationsService], exports: [EventsHub, NotificationsService] })
export class NotificationsCoreModule {}
