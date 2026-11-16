import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { Me, Secured, num } from '../common/util';
import { ENV, Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Role dashboards. Every number comes from the database; nothing is invented.
 * Empty data is returned as empty (zeros / empty arrays) so the UI can show an honest empty state.
 */
const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
function lastDays(n: number) { const out: string[] = []; for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(Date.now() - i * DAY))); return out; }
function seriesOf(days: string[], rows: { at: Date; v: number }[]) {
  const m = new Map(days.map((d) => [d, 0]));
  for (const r of rows) { const k = dayKey(r.at); if (m.has(k)) m.set(k, (m.get(k) ?? 0) + r.v); }
  return days.map((d) => ({ x: d, y: m.get(d) ?? 0 }));
}

@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService, @Inject(ENV) private readonly env: Env) {}

  async buyer(u: AuthUser) {
    const since = new Date(Date.now() - 30 * DAY);
    const [orders, spent, favorites, alerts, contractsActive, recent, contracts, delivering, popular] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { buyerId: u.id }, _count: true }),
      this.prisma.order.aggregate({ where: { buyerId: u.id, status: { in: ['COMPLETED', 'ACCEPTED', 'DELIVERED'] } }, _sum: { totalAmount: true } }),
      this.prisma.favorite.count({ where: { userId: u.id } }),
      this.prisma.priceAlert.count({ where: { userId: u.id, active: true } }),
      this.prisma.contract.count({ where: { buyerId: u.id, status: { in: ['FULLY_SIGNED', 'ACTIVE'] } } }),
      this.prisma.order.findMany({ where: { buyerId: u.id }, orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, number: true, status: true, totalAmount: true, createdAt: true, store: { select: { name: true } }, _count: { select: { items: true } } } }),
      this.prisma.contract.findMany({ where: { buyerId: u.id }, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, number: true, status: true, order: { select: { items: { take: 1, select: { product: { select: { name: true } } } } } } } }),
      this.prisma.order.findFirst({ where: { buyerId: u.id, status: { in: ['SHIPPED', 'READY', 'PROCESSING', 'CONFIRMED'] } }, orderBy: { updatedAt: 'desc' }, select: { id: true, number: true, status: true, deliveryAddress: true, store: { select: { name: true } }, delivery: { select: { status: true } } } }),
      this.prisma.priceRecord.findMany({ where: { deletedAt: null, moderationStatus: 'APPROVED', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 40, select: { price: true, product: { select: { id: true, name: true, slug: true, category: { select: { name: true, slug: true } } } }, unit: { select: { code: true } }, store: { select: { name: true, slug: true, region: { select: { name: true } } } } } }),
    ]);
    const events = delivering ? await this.prisma.orderEvent.findMany({ where: { orderId: delivering.id }, orderBy: { createdAt: 'asc' }, select: { toState: true, createdAt: true } }) : [];
    const total = orders.reduce((a, o) => a + o._count, 0);
    const active = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).reduce((a, o) => a + o._count, 0);
    const livePrices = await this.prisma.priceRecord.count({ where: { deletedAt: null, moderationStatus: 'APPROVED' } });
    const seen = new Set<string>(); const deals = [];
    for (const r of popular) { if (seen.has(r.product.id)) continue; seen.add(r.product.id); deals.push({ productId: r.product.id, name: r.product.name, slug: r.product.slug, category: r.product.category.slug, categoryName: r.product.category.name, price: num(r.price), unit: r.unit.code, store: r.store.name, storeSlug: r.store.slug, region: r.store.region.name }); if (deals.length >= 8) break; }
    return {
      activity: { active, awaitingDelivery: orders.filter((o) => ['SHIPPED', 'READY'].includes(o.status)).reduce((a, o) => a + o._count, 0), signedContracts: contractsActive, favorites },
      kpi: { livePrices, alerts, totalOrders: total, spent: num(spent._sum.totalAmount) },
      deals,
      recentOrders: recent.map((o) => ({ id: o.id, number: o.number, status: o.status, total: num(o.totalAmount), items: o._count.items, store: o.store.name, at: o.createdAt })),
      delivery: delivering ? { orderId: delivering.id, number: delivering.number, status: delivering.status, store: delivering.store.name, address: delivering.deliveryAddress, steps: events.map((e) => ({ status: e.toState, at: e.createdAt })) } : null,
      contracts: contracts.map((c) => ({ id: c.id, number: c.number, status: c.status, goods: c.order?.items[0]?.product.name ?? null })),
    };
  }

  async seller(u: AuthUser) {
    const store = await this.prisma.store.findFirst({ where: { ownerId: u.id, deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, slug: true, status: true, lat: true, lng: true, description: true, region: { select: { name: true } }, market: { select: { name: true, address: true } } } });
    if (!store) return { store: null };
    const days = lastDays(30); const since = new Date(Date.now() - 30 * DAY); const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const [orders30, todayAgg, byStatus, items30, rating, activePrices, customers, recent] = await Promise.all([
      this.prisma.order.findMany({ where: { storeId: store.id, createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } }, select: { createdAt: true, totalAmount: true } }),
      this.prisma.order.aggregate({ where: { storeId: store.id, createdAt: { gte: startToday }, status: { notIn: ['CANCELLED'] } }, _sum: { totalAmount: true }, _count: true }),
      this.prisma.order.groupBy({ by: ['status'], where: { storeId: store.id }, _count: true }),
      this.prisma.orderItem.findMany({ where: { order: { storeId: store.id, createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } } }, select: { quantity: true, unitPrice: true, product: { select: { id: true, name: true, slug: true, category: { select: { name: true } } } }, unit: { select: { code: true } } } }),
      this.prisma.review.aggregate({ where: { storeId: store.id, status: 'APPROVED' }, _avg: { rating: true }, _count: true }),
      this.prisma.priceRecord.count({ where: { storeId: store.id, deletedAt: null } }),
      this.prisma.order.findMany({ where: { storeId: store.id }, distinct: ['buyerId'], select: { buyerId: true } }),
      this.prisma.order.findMany({ where: { storeId: store.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, number: true, status: true, totalAmount: true, createdAt: true, buyer: { select: { profile: { select: { fullName: true } } } }, _count: { select: { items: true } } } }),
    ]);
    const cat = new Map<string, number>(); const prod = new Map<string, { name: string; slug: string; qty: number; sum: number; unit: string }>();
    for (const i of items30) {
      const sum = num(i.quantity) * num(i.unitPrice); const c = i.product.category.name; cat.set(c, (cat.get(c) ?? 0) + sum);
      const p = prod.get(i.product.id) ?? { name: i.product.name, slug: i.product.slug, qty: 0, sum: 0, unit: i.unit.code }; p.qty += num(i.quantity); p.sum += sum; prod.set(i.product.id, p);
    }
    const catTotal = [...cat.values()].reduce((a, b) => a + b, 0);
    return {
      store: { id: store.id, name: store.name, slug: store.slug, status: store.status, lat: store.lat, lng: store.lng, region: store.region.name, market: store.market?.name ?? null, address: store.market?.address ?? null },
      kpi: { todaySales: num(todayAgg._sum.totalAmount), todayOrders: todayAgg._count, activePrices, customers: customers.length, rating: rating._avg.rating ? Math.round(rating._avg.rating * 10) / 10 : null, reviews: rating._count, newOrders: byStatus.find((s) => s.status === 'CREATED')?._count ?? 0 },
      sales: seriesOf(days, orders30.map((o) => ({ at: o.createdAt, v: num(o.totalAmount) }))), total30: orders30.reduce((a, o) => a + num(o.totalAmount), 0),
      byCategory: [...cat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, sum]) => ({ name, sum, percent: catTotal ? Math.round((sum / catTotal) * 100) : 0 })),
      topProducts: [...prod.values()].sort((a, b) => b.sum - a.sum).slice(0, 3),
      recentOrders: recent.map((o) => ({ id: o.id, number: o.number, status: o.status, total: num(o.totalAmount), items: o._count.items, buyer: o.buyer.profile?.fullName ?? 'Xaridor', at: o.createdAt })),
    };
  }

  async moderator(u: AuthUser) {
    const days = lastDays(7); const since = new Date(Date.now() - 7 * DAY);
    const [pendingProducts, pendingPrices, pendingStores, pendingReviews, pendingContracts, disputes, complaints, actions, mine, prices, recentComplaints, openDisputes, decisions, queue] = await Promise.all([
      this.prisma.product.count({ where: { status: 'PENDING', deletedAt: null } }),
      this.prisma.priceRecord.count({ where: { moderationStatus: 'PENDING', deletedAt: null } }),
      this.prisma.store.count({ where: { status: 'PENDING', deletedAt: null } }),
      this.prisma.review.count({ where: { status: 'PENDING' } }),
      this.prisma.contract.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'IN_REVIEW', 'APPEALED'] } } }),
      this.prisma.complaint.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
      this.prisma.moderationAction.findMany({ where: { createdAt: { gte: since } }, select: { action: true, createdAt: true } }),
      this.prisma.moderationAction.count({ where: { moderatorId: u.id, createdAt: { gte: since } } }),
      this.prisma.priceRecord.groupBy({ by: ['moderationStatus'], where: { deletedAt: null }, _count: true }),
      this.prisma.complaint.findMany({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } }, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, reason: true, targetType: true, createdAt: true } }),
      this.prisma.dispute.findMany({ where: { status: { in: ['OPEN', 'IN_REVIEW', 'APPEALED'] } }, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, status: true, createdAt: true, order: { select: { number: true } } } }),
      this.prisma.moderationAction.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, action: true, targetType: true, reason: true, createdAt: true } }),
      this.prisma.priceRecord.findMany({ where: { moderationStatus: 'PENDING', deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 6, select: { id: true, price: true, createdAt: true, product: { select: { name: true, slug: true } }, unit: { select: { code: true } }, store: { select: { id: true, name: true, lat: true, lng: true, region: { select: { name: true } } } } } }),
    ]);
    const approved = actions.filter((a) => a.action === 'APPROVE'); const rejected = actions.filter((a) => a.action === 'REJECT');
    return {
      kpi: { queue: pendingProducts + pendingPrices + pendingStores + pendingReviews + pendingContracts, approved7d: approved.length, rejected7d: rejected.length, stores: pendingStores, complaints, disputes, mine7d: mine },
      queues: { products: pendingProducts, prices: pendingPrices, stores: pendingStores, reviews: pendingReviews, contracts: pendingContracts, disputes, complaints },
      approvedSeries: seriesOf(days, approved.map((a) => ({ at: a.createdAt, v: 1 }))), rejectedSeries: seriesOf(days, rejected.map((a) => ({ at: a.createdAt, v: 1 }))),
      priceStatus: prices.map((p) => ({ status: p.moderationStatus, count: p._count })),
      queue: queue.map((q) => ({ id: q.id, product: q.product.name, slug: q.product.slug, price: num(q.price), unit: q.unit.code, store: q.store.name, region: q.store.region.name, at: q.createdAt, lat: q.store.lat, lng: q.store.lng })),
      complaints: recentComplaints, disputes: openDisputes.map((d) => ({ id: d.id, status: d.status, order: d.order?.number ?? null, at: d.createdAt })), decisions,
    };
  }

  async admin() {
    const days = lastDays(30); const since = new Date(Date.now() - 30 * DAY);
    const [users, sellers, mods, orders, contracts, paid, orders30, byStatus, regionRows, activity, stores, markets, dbOk] = await Promise.all([
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.store.count({ where: { deletedAt: null, status: 'VERIFIED' } }),
      this.prisma.userRole.count({ where: { role: { name: 'MODERATOR' } } }),
      this.prisma.order.count(),
      this.prisma.contract.count(),
      this.prisma.order.aggregate({ where: { status: { in: ['COMPLETED', 'ACCEPTED', 'DELIVERED'] } }, _sum: { totalAmount: true } }),
      this.prisma.order.findMany({ where: { createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } }, select: { createdAt: true, totalAmount: true } }),
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.findMany({ where: { createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } }, select: { totalAmount: true, store: { select: { region: { select: { name: true } } } } } }),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { email: true } } } }),
      this.prisma.store.findMany({ where: { deletedAt: null, status: 'VERIFIED', lat: { not: null }, lng: { not: null } }, take: 300, select: { id: true, name: true, slug: true, lat: true, lng: true, region: { select: { name: true } } } }),
      this.prisma.market.findMany({ where: { lat: { not: null }, lng: { not: null } }, take: 100, select: { id: true, name: true, lat: true, lng: true } }),
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    ]);
    const reg = new Map<string, number>(); for (const r of regionRows) { const n = r.store.region.name; reg.set(n, (reg.get(n) ?? 0) + num(r.totalAmount)); }
    const regTotal = [...reg.values()].reduce((a, b) => a + b, 0);
    return {
      kpi: { users, sellers, moderators: mods, orders, contracts, paidVolume: num(paid._sum.totalAmount) },
      turnover: seriesOf(days, orders30.map((o) => ({ at: o.createdAt, v: num(o.totalAmount) }))), turnover30: orders30.reduce((a, o) => a + num(o.totalAmount), 0),
      orderStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      // Honest statuses: "configured" = the env enables it; nothing here pretends an unconnected service works.
      system: [
        { key: 'api', label: 'API server', state: 'ok' as const },
        { key: 'db', label: 'Ma’lumotlar bazasi', state: dbOk ? 'ok' as const : 'down' as const },
        { key: 'mail', label: 'Email xabarnoma', state: this.env.MAIL_MODE === 'apps_script' ? 'ok' as const : 'off' as const },
        { key: 'eimzo', label: 'E-IMZO integratsiyasi', state: this.env.EIMZO_MODE === 'enabled' ? 'ok' as const : 'off' as const },
        { key: 'payments', label: 'To‘lov tizimi', state: 'off' as const },
      ],
      topRegions: [...reg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, sum]) => ({ name, sum, percent: regTotal ? Math.round((sum / regTotal) * 1000) / 10 : 0 })),
      activity: activity.map((a) => ({ id: String(a.id), action: a.action, entity: a.entityType, at: a.createdAt, actor: a.actor?.email ?? null })),
      stores: stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug, lat: s.lat as number, lng: s.lng as number, region: s.region.name })),
      markets: markets.map((m) => ({ id: m.id, name: m.name, lat: m.lat as number, lng: m.lng as number })),
    };
  }
}

@ApiTags('dashboards')
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly svc: DashboardsService) {}
  @Get('buyer') @Secured('orders.create') buyer(@Me() u: AuthUser) { return this.svc.buyer(u); }
  @Get('seller') @Secured('stores.manage') seller(@Me() u: AuthUser) { return this.svc.seller(u); }
  @Get('moderator') @Secured('stats.view') moderator(@Me() u: AuthUser) { return this.svc.moderator(u); }
  @Get('admin') @Secured('users.manage') admin() { return this.svc.admin(); }
}

@Module({ imports: [AuthModule], controllers: [DashboardsController], providers: [DashboardsService] })
export class DashboardsModule {}
void AppError;
