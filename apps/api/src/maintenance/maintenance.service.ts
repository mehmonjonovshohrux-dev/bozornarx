import { Injectable, Logger, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { STALE_AFTER_HOURS } from '../domain/trust';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const HOUR = 3_600_000;

/**
 * Housekeeping. Plain timers (no scheduler dependency); every task is idempotent, so running it on
 * several instances is wasteful but never wrong. Disable with MAINTENANCE_ENABLED=false.
 */
@Injectable()
export class MaintenanceService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger('maintenance');
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly notif: NotificationsService) {}

  onModuleInit(): void {
    if (process.env.MAINTENANCE_ENABLED === 'false' || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.runAll(), 15 * 60_000);
    this.timer.unref();
    setTimeout(() => void this.runAll(), 30_000).unref();
  }
  onApplicationShutdown(): void { if (this.timer) clearInterval(this.timer); }

  async runAll(): Promise<Record<string, number>> {
    if (this.running) return {};
    this.running = true;
    const out: Record<string, number> = {};
    for (const [name, fn] of Object.entries({ offers: () => this.expireOffers(), contracts: () => this.expireContracts(), stale: () => this.notifyStalePrices(), sessions: () => this.purge() })) {
      try { out[name] = await fn(); } catch (e) { this.log.error(`${name} failed: ${e instanceof Error ? e.message : 'unknown'}`); }
    }
    this.running = false;
    return out;
  }

  async expireOffers(): Promise<number> {
    const r = await this.prisma.offer.updateMany({ where: { status: { in: ['PENDING', 'COUNTERED'] }, expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
    return r.count;
  }

  async expireContracts(): Promise<number> {
    const r = await this.prisma.contract.updateMany({ where: { status: { in: ['DRAFT', 'PENDING_REVIEW', 'WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'PARTIALLY_SIGNED'] }, expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
    return r.count;
  }

  /** One summary per seller per day, never one message per price. */
  async notifyStalePrices(): Promise<number> {
    const before = new Date(Date.now() - STALE_AFTER_HOURS * HOUR);
    const groups = await this.prisma.priceRecord.groupBy({ by: ['storeId'], where: { deletedAt: null, moderationStatus: 'APPROVED', confirmedAt: { lt: before }, store: { status: 'VERIFIED', deletedAt: null } }, _count: true });
    if (groups.length === 0) return 0;
    const stores = await this.prisma.store.findMany({ where: { id: { in: groups.map((g) => g.storeId) } }, select: { id: true, ownerId: true, name: true } });
    const dayAgo = new Date(Date.now() - 24 * HOUR);
    let sent = 0;
    for (const s of stores) {
      if (await this.prisma.notification.count({ where: { userId: s.ownerId, type: 'PRICE_STALE', createdAt: { gte: dayAgo } } })) continue;
      const n = groups.find((g) => g.storeId === s.id)?._count ?? 0;
      await this.notif.notify(s.ownerId, { type: 'PRICE_STALE', title: 'Narxlaringizni yangilang', body: `${s.name}: ${n} ta narx ${Math.round(STALE_AFTER_HOURS / 24)} kundan beri tasdiqlanmagan. Ro‘yxatda ular “eskirgan” deb ko‘rinadi.`, url: '/seller/prices?stale=true' });
      sent++;
    }
    return sent;
  }

  async purge(): Promise<number> {
    const r = await this.prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(Date.now() - 30 * 24 * HOUR) } }, { revokedAt: { lt: new Date(Date.now() - 30 * 24 * HOUR) } }] } });
    const n = await this.prisma.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lt: new Date(Date.now() - 90 * 24 * HOUR) } } });
    return r.count + n.count;
  }
}

@Module({ providers: [MaintenanceService], exports: [MaintenanceService] })
export class MaintenanceModule {}
