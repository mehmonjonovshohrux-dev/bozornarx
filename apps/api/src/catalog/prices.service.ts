import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, num, paged } from '../common/util';
import { isSuspiciousPrice } from '../domain/trust';
import { STALE_AFTER_HOURS } from '../domain/trust';
import { sameDimension } from '../domain/units';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from './alerts.service';
import { decisionSchema, priceCreateSchema, priceUpdateSchema, stockSchema, tiersSchema } from './catalog.schemas';
import { normalize } from './catalog.service';
import { TrustService } from './trust.service';

type Create = z.infer<typeof priceCreateSchema>;
type Update = z.infer<typeof priceUpdateSchema>;
type Tx = Prisma.TransactionClient;

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
    private readonly alerts: AlertsService,
    private readonly audit: AuditService,
    private readonly notif: NotificationsService,
  ) {}

  /** The seller must own the store, and the store must not be blocked. */
  private async ownStore(user: AuthUser, storeId: string) {
    const s = await this.prisma.store.findFirst({ where: { id: storeId, deletedAt: null } });
    if (!s || s.ownerId !== user.id) throw new AppError(403, 'FORBIDDEN', 'Bu do‘kon sizniki emas.');
    if (s.status === 'SUSPENDED' || s.status === 'REJECTED') throw new AppError(403, 'STORE_BLOCKED', 'Do‘kon faol emas, narx kiritib bo‘lmaydi.');
    return s;
  }

  private async ownRecord(user: AuthUser, id: string) {
    const r = await this.prisma.priceRecord.findFirst({ where: { id, deletedAt: null }, include: { store: true } });
    if (!r) throw new AppError(404, 'NOT_FOUND', 'Narx topilmadi.');
    if (r.store.ownerId !== user.id) throw new AppError(403, 'FORBIDDEN', 'Bu narx sizniki emas.');
    return r;
  }

  /** Verified store + believable price = visible at once; everything else waits for a moderator. */
  private async initialModeration(storeVerified: boolean, productId: string, regionId: string, unitId: string, variantId: string | null, price: number) {
    if (!storeVerified) return 'PENDING' as const;
    if (variantId) return 'APPROVED' as const; // pack prices have no per-unit region reference
    const ref = await this.trust.regionReference(productId, regionId, unitId);
    return isSuspiciousPrice(price, ref.median) ? ('PENDING' as const) : ('APPROVED' as const);
  }

  private async history(tx: Tx, r: { id: string; productId: string; regionId: string }, price: number, availability: Prisma.PriceHistoryCreateInput['availability'], by: string, reason: string) {
    await tx.priceHistory.create({ data: { priceRecordId: r.id, productId: r.productId, regionId: r.regionId, price, availability, changedById: by, reason } });
  }

  private async afterWrite(id: string) {
    await this.trust.assess(id, true);
    await this.alerts.onPriceVisible(id);
  }

  /** Free stores are limited by the `plans.freeMaxPrices` setting; a store with an active subscription by its plan's `maxProducts`. */
  private async assertWithinPlan(storeId: string): Promise<void> {
    const [sub, setting, used] = await Promise.all([
      this.prisma.subscription.findFirst({ where: { storeId, status: 'ACTIVE', OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { startedAt: 'desc' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'plans.freeMaxPrices' } }),
      this.prisma.priceRecord.count({ where: { storeId, deletedAt: null } }),
    ]);
    const plan = sub ? await this.prisma.plan.findUnique({ where: { code: sub.plan } }) : null;
    const limit = plan?.maxProducts ?? (typeof setting?.value === 'number' ? setting.value : 50);
    if (used >= limit) throw new AppError(402, 'PLAN_LIMIT', `Tarifingiz bo‘yicha ${limit} tagacha narx kiritish mumkin. Tarifni yangilash uchun administratorga murojaat qiling.`);
  }

  async create(user: AuthUser, d: Create) {
    const store = await this.ownStore(user, d.storeId);
    await this.assertWithinPlan(d.storeId);
    const product = await this.prisma.product.findFirst({ where: { id: d.productId, deletedAt: null }, include: { unit: true } });
    if (!product || (product.status !== 'APPROVED' && product.createdById !== user.id)) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi yoki hali tasdiqlanmagan.');
    if (product.status === 'ARCHIVED' || product.status === 'REJECTED') throw new AppError(400, 'PRODUCT_NOT_AVAILABLE', 'Bu mahsulotga narx kiritib bo‘lmaydi.');

    let variantId: string | null = null;
    if (d.variantId) {
      const v = await this.prisma.productVariant.findFirst({ where: { id: d.variantId, productId: product.id } });
      if (!v) throw new AppError(400, 'VARIANT_NOT_FOUND', 'Variant bu mahsulotga tegishli emas.');
      variantId = v.id;
    }
    const unit = d.unitId ? await this.prisma.unit.findUnique({ where: { id: d.unitId } }) : product.unit;
    if (!unit) throw new AppError(400, 'UNIT_NOT_FOUND', 'O‘lchov birligi topilmadi.');
    if (!variantId && !sameDimension(unit.code, product.unit.code)) throw new AppError(400, 'UNIT_MISMATCH', `Bu mahsulot uchun "${product.unit.code}" bilan mos birlik tanlang (yoki variant yarating).`);

    const existing = await this.prisma.priceRecord.findFirst({ where: { storeId: store.id, productId: product.id, variantId } });
    if (existing && !existing.deletedAt) throw new AppError(409, 'PRICE_EXISTS', 'Bu mahsulot uchun do‘koningizda narx allaqachon bor. Uni tahrirlang.', { priceRecordId: existing.id });

    const moderation = await this.initialModeration(store.status === 'VERIFIED', product.id, store.regionId, unit.id, variantId, d.price);
    const base = {
      price: d.price, availability: d.availability, quantityAvailable: d.quantityAvailable ?? null, deliveryAvailable: d.deliveryAvailable,
      discountPercent: d.discountPercent ?? null, note: d.note ?? null, moderationStatus: moderation, confirmedAt: new Date(), deletedAt: null,
    };
    const rec = await this.prisma.$transaction(async (tx) => {
      // A withdrawn record is revived instead of creating a duplicate (unique per store+product+variant).
      const r = existing
        ? await tx.priceRecord.update({ where: { id: existing.id }, data: { ...base, unitId: unit.id, createdById: user.id } })
        : await tx.priceRecord.create({ data: { ...base, productId: product.id, variantId, storeId: store.id, regionId: store.regionId, marketId: store.marketId, unitId: unit.id, createdById: user.id } });
      await this.history(tx, r, d.price, d.availability, user.id, existing ? 'REPUBLISHED' : 'CREATED');
      if (d.quantityAvailable) await tx.stockMovement.create({ data: { priceRecordId: r.id, delta: d.quantityAvailable, balanceAfter: d.quantityAvailable, reason: 'RESTOCK', actorId: user.id } });
      return r;
    });
    await this.audit.record({ actorId: user.id, action: 'PRICE_CREATE', entityType: 'price', entityId: rec.id, after: { price: d.price, moderation } });
    await this.afterWrite(rec.id);
    return { ...rec, price: num(rec.price) };
  }

  async update(user: AuthUser, id: string, d: Update) {
    const r = await this.ownRecord(user, id);
    const priceChanged = d.price !== undefined && d.price !== num(r.price);
    let moderation = r.moderationStatus;
    if (priceChanged && r.moderationStatus === 'APPROVED') {
      moderation = await this.initialModeration(r.store.status === 'VERIFIED', r.productId, r.regionId, r.unitId, r.variantId, d.price!);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.priceRecord.update({
        where: { id },
        data: { ...(d.price !== undefined ? { price: d.price } : {}), ...(d.availability ? { availability: d.availability } : {}), ...(d.deliveryAvailable !== undefined ? { deliveryAvailable: d.deliveryAvailable } : {}), ...(d.discountPercent !== undefined ? { discountPercent: d.discountPercent } : {}), ...(d.note !== undefined ? { note: d.note } : {}), moderationStatus: moderation, confirmedAt: new Date() },
      });
      if (priceChanged || d.availability) await this.history(tx, u, num(u.price), u.availability, user.id, 'UPDATED');
      return u;
    });
    await this.audit.record({ actorId: user.id, action: 'PRICE_UPDATE', entityType: 'price', entityId: id, before: { price: num(r.price) }, after: { price: num(updated.price), moderation } });
    await this.afterWrite(id);
    return { ...updated, price: num(updated.price) };
  }

  /** "I checked, the price is still right." Refreshes freshness without changing the price. */
  async confirm(user: AuthUser, id: string) {
    const r = await this.ownRecord(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.priceRecord.update({ where: { id }, data: { confirmedAt: new Date() } });
      await this.history(tx, r, num(r.price), r.availability, user.id, 'CONFIRMED');
    });
    await this.trust.assess(id, true);
    return { confirmedAt: new Date() };
  }

  async withdraw(user: AuthUser, id: string) {
    const r = await this.ownRecord(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.priceRecord.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.history(tx, r, num(r.price), r.availability, user.id, 'WITHDRAWN');
    });
    await this.audit.record({ actorId: user.id, action: 'PRICE_WITHDRAW', entityType: 'price', entityId: id });
    return { withdrawn: true };
  }

  async mine(user: AuthUser, q: PageQuery & { storeId?: string; stale?: boolean }) {
    const staleBefore = new Date(Date.now() - STALE_AFTER_HOURS * 3_600_000);
    const where: Prisma.PriceRecordWhereInput = {
      deletedAt: null,
      store: { ownerId: user.id, ...(q.storeId ? { id: q.storeId } : {}) },
      ...(q.stale ? { confirmedAt: { lt: staleBefore } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.priceRecord.findMany({
        where, orderBy: { updatedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
        include: { product: { select: { id: true, name: true, slug: true } }, store: { select: { id: true, name: true } }, unit: { select: { code: true } }, variant: { select: { name: true, quantity: true, unit: { select: { code: true } } } }, trust: { orderBy: { computedAt: 'desc' }, take: 1, select: { status: true, score: true } }, _count: { select: { evidence: true } } },
      }),
      this.prisma.priceRecord.count({ where }),
    ]);
    const items = rows.map((r) => ({
      id: r.id, product: r.product, store: r.store, unit: r.unit.code, variant: r.variant?.name ?? null,
      price: num(r.price), discountPercent: r.discountPercent ? num(r.discountPercent) : null, availability: r.availability,
      quantityAvailable: r.quantityAvailable === null ? null : num(r.quantityAvailable), deliveryAvailable: r.deliveryAvailable,
      moderationStatus: r.moderationStatus, confirmedAt: r.confirmedAt, stale: r.confirmedAt < staleBefore,
      evidenceCount: r._count.evidence, trust: r.trust[0] ?? { status: 'INSUFFICIENT_DATA', score: null },
      pricePerBaseUnit: normalize({ ...r, discountPercent: r.discountPercent, variant: r.variant }).perBase,
    }));
    return paged(items, total, q);
  }

  // ───────────── stock, wholesale tiers, evidence ─────────────

  async adjustStock(user: AuthUser, id: string, d: z.infer<typeof stockSchema>) {
    const r = await this.ownRecord(user, id);
    return this.prisma.$transaction(async (tx) => {
      const cur = await tx.priceRecord.findUniqueOrThrow({ where: { id }, select: { quantityAvailable: true } });
      const before = num(cur.quantityAvailable);
      const after = d.set !== undefined ? d.set : before + (d.delta ?? 0);
      if (after < 0) throw new AppError(400, 'NEGATIVE_STOCK', 'Qoldiq manfiy bo‘lishi mumkin emas.');
      await tx.priceRecord.update({ where: { id }, data: { quantityAvailable: after, availability: after === 0 ? 'OUT_OF_STOCK' : r.availability === 'OUT_OF_STOCK' ? 'IN_STOCK' : r.availability } });
      await tx.stockMovement.create({ data: { priceRecordId: id, delta: after - before, balanceAfter: after, reason: d.reason, actorId: user.id } });
      return { quantityAvailable: after };
    });
  }

  async stockLedger(user: AuthUser, id: string) {
    await this.ownRecord(user, id);
    return this.prisma.stockMovement.findMany({ where: { priceRecordId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async setTiers(user: AuthUser, id: string, d: z.infer<typeof tiersSchema>) {
    const r = await this.ownRecord(user, id);
    const sorted = [...d.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i]!.unitPrice >= num(r.price)) throw new AppError(400, 'TIER_NOT_CHEAPER', 'Ulgurji narx oddiy narxdan past bo‘lishi kerak.');
      if (i > 0 && (sorted[i]!.unitPrice >= sorted[i - 1]!.unitPrice || sorted[i]!.minQuantity === sorted[i - 1]!.minQuantity)) throw new AppError(400, 'TIER_ORDER', 'Miqdor oshgan sari narx pasayishi kerak.');
    }
    await this.prisma.$transaction([
      this.prisma.wholesaleTier.deleteMany({ where: { priceRecordId: id } }),
      this.prisma.wholesaleTier.createMany({ data: sorted.map((t) => ({ priceRecordId: id, minQuantity: t.minQuantity, unitPrice: t.unitPrice })) }),
    ]);
    return { tiers: sorted };
  }

  async tiers(id: string) {
    const rows = await this.prisma.wholesaleTier.findMany({ where: { priceRecordId: id }, orderBy: { minQuantity: 'asc' } });
    return rows.map((t) => ({ minQuantity: num(t.minQuantity), unitPrice: num(t.unitPrice) }));
  }

  async addEvidence(user: AuthUser, id: string, fileId: string) {
    await this.ownRecord(user, id);
    const f = await this.prisma.fileObject.findUnique({ where: { id: fileId }, select: { ownerId: true, kind: true, mime: true } });
    if (!f || f.ownerId !== user.id || f.kind !== 'EVIDENCE') throw new AppError(400, 'FILE_INVALID', 'Fayl topilmadi yoki sizga tegishli emas.');
    await this.prisma.priceEvidence.create({ data: { priceRecordId: id, fileKey: fileId, mimeType: f.mime, uploadedById: user.id } });
    await this.trust.assess(id, true);
    return { added: true };
  }

  async trustOf(id: string) {
    const t = await this.trust.assess(id, false);
    if (!t) throw new AppError(404, 'NOT_FOUND', 'Narx topilmadi.');
    return t;
  }

  // ───────────── moderation ─────────────

  async queue(q: PageQuery, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const where: Prisma.PriceRecordWhereInput = { moderationStatus: status, deletedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.priceRecord.findMany({
        where, orderBy: { updatedAt: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
        include: { product: { select: { id: true, name: true } }, store: { select: { id: true, name: true, status: true } }, unit: { select: { code: true } }, region: { select: { name: true } }, _count: { select: { evidence: true } } },
      }),
      this.prisma.priceRecord.count({ where }),
    ]);
    const items = await Promise.all(
      rows.map(async (r) => {
        const ref = await this.trust.regionReference(r.productId, r.regionId, r.unitId, r.id);
        return { id: r.id, product: r.product, store: r.store, region: r.region.name, unit: r.unit.code, price: num(r.price), regionMedian: ref.median ?? null, suspicious: isSuspiciousPrice(num(r.price), ref.median), evidenceCount: r._count.evidence, updatedAt: r.updatedAt };
      }),
    );
    return paged(items, total, q);
  }

  async decide(user: AuthUser, id: string, d: z.infer<typeof decisionSchema>) {
    const r = await this.prisma.priceRecord.findFirst({ where: { id, deletedAt: null }, include: { product: { select: { name: true } }, store: { select: { ownerId: true } } } });
    if (!r) throw new AppError(404, 'NOT_FOUND', 'Narx topilmadi.');
    const status = d.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await this.prisma.$transaction([
      this.prisma.priceRecord.update({ where: { id }, data: { moderationStatus: status } }),
      this.prisma.moderationAction.create({ data: { moderatorId: user.id, targetType: 'PRICE', targetId: id, action: d.action, reason: d.reason } }),
    ]);
    await this.audit.record({ actorId: user.id, action: `PRICE_${d.action}`, entityType: 'price', entityId: id, after: { reason: d.reason } });
    await this.notif.notify(r.store.ownerId, { type: 'MODERATION', title: `Narx ${status === 'APPROVED' ? 'tasdiqlandi' : 'rad etildi'}: ${r.product.name}`, body: d.reason, url: '/seller/prices' });
    await this.trust.assess(id, true);
    if (status === 'APPROVED') await this.alerts.onPriceVisible(id);
    return { status };
  }
}
