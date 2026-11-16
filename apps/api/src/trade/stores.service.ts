import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, isStaff, num, paged } from '../common/util';
import { slugify } from '../domain/pricing';
import { STALE_AFTER_HOURS } from '../domain/trust';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { discountSchema, storeCreateSchema, storeDecisionSchema, storeDocSchema, storeUpdateSchema } from './trade.schemas';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notif: NotificationsService) {}

  async ownStore(user: AuthUser, id: string) {
    const s = await this.prisma.store.findFirst({ where: { id, deletedAt: null } });
    if (!s) throw new AppError(404, 'NOT_FOUND', 'Do‘kon topilmadi.');
    if (s.ownerId !== user.id && !isStaff(user.roles)) throw new AppError(403, 'FORBIDDEN', 'Bu do‘kon sizniki emas.');
    return s;
  }

  async create(user: AuthUser, d: z.infer<typeof storeCreateSchema>) {
    if ((await this.prisma.store.count({ where: { ownerId: user.id, deletedAt: null } })) >= 5) throw new AppError(400, 'TOO_MANY_STORES', 'Bitta hisobda 5 tagacha do‘kon ochish mumkin.');
    if (!(await this.prisma.region.findUnique({ where: { id: d.regionId } }))) throw new AppError(400, 'REGION_NOT_FOUND', 'Hudud topilmadi.');
    if (d.marketId && !(await this.prisma.market.findFirst({ where: { id: d.marketId, regionId: d.regionId } }))) throw new AppError(400, 'MARKET_INVALID', 'Bozor tanlangan hududga tegishli emas.');
    const s = await this.prisma.store.create({ data: { ...d, ownerId: user.id, slug: `${slugify(d.name)}-${randomBytes(3).toString('hex')}` } });
    await this.audit.record({ actorId: user.id, action: 'STORE_CREATE', entityType: 'store', entityId: s.id, after: { name: s.name } });
    return s;
  }

  async update(user: AuthUser, id: string, d: z.infer<typeof storeUpdateSchema>) {
    const s = await this.ownStore(user, id);
    if (d.regionId && d.regionId !== s.regionId) {
      const active = await this.prisma.priceRecord.count({ where: { storeId: id, deletedAt: null } });
      if (active > 0) throw new AppError(409, 'REGION_LOCKED', 'Narxlari bor do‘konning hududini o‘zgartirib bo‘lmaydi. Avval narxlarni olib tashlang.');
    }
    const u = await this.prisma.store.update({ where: { id }, data: d });
    await this.audit.record({ actorId: user.id, action: 'STORE_UPDATE', entityType: 'store', entityId: id });
    return u;
  }

  mine(user: AuthUser) {
    return this.prisma.store.findMany({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, include: { region: { select: { name: true } }, market: { select: { name: true } }, documents: { select: { id: true, type: true, status: true, createdAt: true } } } });
  }

  async addDocument(user: AuthUser, id: string, d: z.infer<typeof storeDocSchema>) {
    await this.ownStore(user, id);
    const f = await this.prisma.fileObject.findUnique({ where: { id: d.fileId }, select: { ownerId: true, kind: true } });
    if (!f || f.ownerId !== user.id || f.kind !== 'STORE_DOC') throw new AppError(400, 'FILE_INVALID', 'Fayl topilmadi yoki sizga tegishli emas.');
    return this.prisma.sellerDocument.create({ data: { storeId: id, type: d.type, fileKey: d.fileId } });
  }

  // ───────────── seller dashboard ─────────────

  async stats(user: AuthUser, id: string) {
    await this.ownStore(user, id);
    const staleBefore = new Date(Date.now() - STALE_AFTER_HOURS * 3_600_000);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [byStatus, revenue, prices, stale, pendingPrices, unreadChats, rating, openDisputes, pendingOffers] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { storeId: id }, _count: true }),
      this.prisma.order.aggregate({ where: { storeId: id, status: 'COMPLETED', updatedAt: { gte: since30 } }, _sum: { totalAmount: true }, _count: true }),
      this.prisma.priceRecord.count({ where: { storeId: id, deletedAt: null } }),
      this.prisma.priceRecord.count({ where: { storeId: id, deletedAt: null, confirmedAt: { lt: staleBefore } } }),
      this.prisma.priceRecord.count({ where: { storeId: id, deletedAt: null, moderationStatus: 'PENDING' } }),
      this.prisma.message.count({ where: { readAt: null, senderId: { not: user.id }, conversation: { storeId: id } } }),
      this.prisma.review.aggregate({ where: { storeId: id, status: 'APPROVED' }, _avg: { rating: true }, _count: true }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] }, order: { storeId: id } } }),
      this.prisma.offer.count({ where: { storeId: id, status: 'PENDING' } }),
    ]);
    return {
      orders: Object.fromEntries(byStatus.map((g) => [g.status, g._count])),
      revenue30d: num(revenue._sum.totalAmount), completed30d: revenue._count,
      prices: { total: prices, stale, pendingModeration: pendingPrices },
      unreadMessages: unreadChats, openDisputes, pendingOffers,
      rating: rating._count ? Math.round((rating._avg.rating ?? 0) * 100) / 100 : null, reviews: rating._count,
    };
  }

  // ───────────── discounts ─────────────

  async discounts(user: AuthUser, id: string) {
    await this.ownStore(user, id);
    return this.prisma.discount.findMany({ where: { storeId: id }, orderBy: { createdAt: 'desc' } });
  }
  async createDiscount(user: AuthUser, id: string, d: z.infer<typeof discountSchema>) {
    await this.ownStore(user, id);
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) throw new AppError(400, 'DATE_RANGE', 'Tugash sanasi boshlanishdan keyin bo‘lsin.');
    try {
      return await this.prisma.discount.create({ data: { ...d, storeId: id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new AppError(409, 'CODE_EXISTS', 'Bu kod allaqachon mavjud.');
      throw e;
    }
  }
  async toggleDiscount(user: AuthUser, storeId: string, discountId: string, active: boolean) {
    await this.ownStore(user, storeId);
    const r = await this.prisma.discount.updateMany({ where: { id: discountId, storeId }, data: { active } });
    if (r.count === 0) throw new AppError(404, 'NOT_FOUND', 'Chegirma topilmadi.');
    return { active };
  }
  async deleteDiscount(user: AuthUser, storeId: string, discountId: string) {
    await this.ownStore(user, storeId);
    const r = await this.prisma.discount.deleteMany({ where: { id: discountId, storeId } });
    if (r.count === 0) throw new AppError(404, 'NOT_FOUND', 'Chegirma topilmadi.');
    return { deleted: true };
  }

  // ───────────── moderation ─────────────

  async queue(q: PageQuery, status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED') {
    const where = { status, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.store.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { owner: { select: { email: true, profile: { select: { fullName: true } } } }, region: { select: { name: true } }, documents: { select: { id: true, type: true, status: true, fileKey: true } } } }),
      this.prisma.store.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async decide(user: AuthUser, id: string, d: z.infer<typeof storeDecisionSchema>) {
    const s = await this.prisma.store.findFirst({ where: { id, deletedAt: null } });
    if (!s) throw new AppError(404, 'NOT_FOUND', 'Do‘kon topilmadi.');
    const map = { APPROVE: 'VERIFIED', REJECT: 'REJECTED', SUSPEND: 'SUSPENDED', RESTORE: 'VERIFIED' } as const;
    const status = map[d.action];
    await this.prisma.$transaction([
      this.prisma.store.update({ where: { id }, data: { status, verifiedAt: status === 'VERIFIED' ? new Date() : s.verifiedAt } }),
      ...(d.action === 'APPROVE' ? [this.prisma.sellerDocument.updateMany({ where: { storeId: id, status: 'PENDING' }, data: { status: 'APPROVED', reviewedById: user.id, reviewedAt: new Date() } })] : []),
      this.prisma.moderationAction.create({ data: { moderatorId: user.id, targetType: 'STORE', targetId: id, action: d.action, reason: d.reason } }),
    ]);
    await this.audit.record({ actorId: user.id, action: `STORE_${d.action}`, entityType: 'store', entityId: id, before: { status: s.status }, after: { status, reason: d.reason } });
    await this.notif.notify(s.ownerId, { type: 'MODERATION', title: `Do‘kon holati: ${status}`, body: `${s.name}: ${d.reason}`, url: '/seller/stores' });
    return { status };
  }
}
