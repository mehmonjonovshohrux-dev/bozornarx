import { Body, Controller, Delete, Get, Module, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { ZodPipe } from '../common/http';
import { Me, Secured, idParam, pageSchema, paged, PageQuery } from '../common/util';
import { PrismaService } from '../prisma/prisma.service';
import { EventsHub } from './events.hub';
import { NOTIF_CATEGORIES, NotificationsService } from './notifications.service';

const subSchema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(100) }) });
const unsubSchema = z.object({ endpoint: z.string().url().max(1000) });
const listQuery = pageSchema.extend({ unread: z.preprocess((v) => v === 'true', z.boolean()) });

const prefsSchema = z.object({ category: z.enum(NOTIF_CATEGORIES), inApp: z.boolean(), phone: z.boolean() });

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService, private readonly hub: EventsHub, private readonly svc: NotificationsService) {}

  @Get()
  @Secured()
  async list(@Me() u: AuthUser, @Query(new ZodPipe(listQuery)) q: PageQuery & { unread: boolean }) {
    const where = { userId: u.id, ...(q.unread ? { readAt: null } : {}) };
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: u.id, readAt: null } }),
    ]);
    return { ...paged(items, total, q), unread };
  }

  @Post('read-all')
  @Secured()
  async readAll(@Me() u: AuthUser) {
    const r = await this.prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }

  @Post(':id/read')
  @Secured()
  async read(@Me() u: AuthUser, @Req() req: Request) {
    const id = idParam.parse({ id: req.params.id }).id;
    const r = await this.prisma.notification.updateMany({ where: { id, userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }

  /** Server-sent events. The web client reads it with fetch() so it can send the Authorization header. */
  @Get('stream')
  @Secured()
  stream(@Me() u: AuthUser, @Req() req: Request, @Res() res: Response) {
    res.set({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.flushHeaders();
    res.write('event: ready\ndata: {}\n\n');
    const remove = this.hub.add(u.id, res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000); // keeps proxies from closing an idle stream
    req.on('close', () => {
      clearInterval(ping);
      remove();
    });
  }

  @Get('prefs')
  @Secured()
  async prefs(@Me() u: AuthUser) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId: u.id } });
    const by = new Map(rows.map((r) => [r.category, r]));
    return NOTIF_CATEGORIES.map((c) => ({ category: c, inApp: by.get(c)?.inApp ?? true, phone: by.get(c)?.phone ?? true }));
  }

  @Put('prefs')
  @Secured()
  async setPrefs(@Me() u: AuthUser, @Body(new ZodPipe(prefsSchema)) b: z.infer<typeof prefsSchema>) {
    await this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId: u.id, category: b.category } },
      create: { userId: u.id, category: b.category, inApp: b.inApp, phone: b.phone },
      update: { inApp: b.inApp, phone: b.phone },
    });
    return { saved: true };
  }

  @Get('push/config')
  pushConfig() {
    return { enabled: this.svc.pushEnabled(), publicKey: this.svc.vapidPublicKey() };
  }

  @Post('push/subscribe')
  @Secured()
  async subscribe(@Me() u: AuthUser, @Body(new ZodPipe(subSchema)) b: z.infer<typeof subSchema>) {
    if (!this.svc.pushEnabled()) throw new AppError(503, 'PUSH_NOT_CONFIGURED', 'Push bildirishnomalar serverda sozlanmagan (VAPID kalitlari yo‘q).');
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: b.endpoint },
      create: { userId: u.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth },
      update: { userId: u.id, p256dh: b.keys.p256dh, auth: b.keys.auth },
    });
    return { subscribed: true };
  }

  @Delete('push/subscribe')
  @Secured()
  async unsubscribe(@Me() u: AuthUser, @Body(new ZodPipe(unsubSchema)) b: z.infer<typeof unsubSchema>) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint: b.endpoint, userId: u.id } });
    return { subscribed: false };
  }
}

@Module({ imports: [AuthModule], controllers: [NotificationsController] })
export class NotificationsModule {}
