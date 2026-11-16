import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, isStaff, num, paged } from '../common/util';
import { OrderStatus, InvalidTransitionError, assertOrderTransition } from '../domain/state-machines';
import { orderTotals, round2, unitPriceFor } from '../domain/pricing';
import { normalize } from '../catalog/catalog.service';
import { ContractsService } from '../contracts/contracts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from './cart.service';
import { PaymentsService } from './payments.service';
import { checkoutSchema, orderListQuery, reviewSchema, transitionSchema } from './trade.schemas';

export interface OrderLineInput {
  priceRecordId: string;
  quantity: number;
  /** negotiated price (accepted offer). When absent the current list price with wholesale tiers is used. */
  unitPriceOverride?: number;
}
export interface OrderOpts {
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: string;
  note?: string;
  couponCode?: string;
  paymentMethod: 'CASH_ON_DELIVERY' | 'CARD';
}
type Tx = Prisma.TransactionClient;

/** Who may perform each transition. A buyer can never confirm; a seller can never accept their own delivery. */
const WHO: Record<string, 'seller' | 'buyer'> = { CONFIRMED: 'seller', PROCESSING: 'seller', READY: 'seller', SHIPPED: 'seller', DELIVERED: 'seller', ACCEPTED: 'buyer', COMPLETED: 'seller' };

@Injectable()
export class OrdersService {
  private readonly log = new Logger('orders');
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly payments: PaymentsService,
    private readonly contracts: ContractsService,
    private readonly audit: AuditService,
    private readonly notif: NotificationsService,
  ) {}

  private async setting<T>(key: string, fallback: T): Promise<T> {
    const s = await this.prisma.systemSetting.findUnique({ where: { key } });
    return (s?.value as T | undefined) ?? fallback;
  }

  private async newNumber(tx: Tx): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const n = `ORD-${new Date().getUTCFullYear()}-${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
      if (!(await tx.order.findUnique({ where: { number: n }, select: { id: true } }))) return n;
    }
    throw new AppError(500, 'NUMBER_GENERATION', 'Buyurtma raqamini yaratib bo‘lmadi. Qayta urinib ko‘ring.');
  }

  // ───────────── creating ─────────────

  /** Checkout from the cart (all lines of one store). */
  async checkout(user: AuthUser, d: z.infer<typeof checkoutSchema>) {
    const cart = await this.cart.get(user);
    const lines = cart.items.filter((l) => l.store.id === d.storeId);
    if (lines.length === 0) throw new AppError(400, 'EMPTY_CART', 'Bu do‘kon bo‘yicha savatingiz bo‘sh.');
    if (lines.some((l) => !l.available)) throw new AppError(409, 'CART_CHANGED', 'Savatdagi ba’zi mahsulotlar qolmagan yoki narxi o‘zgargan. Savatni yangilang.');
    const order = await this.createOrder(user, d.storeId, lines.map((l) => ({ priceRecordId: l.priceRecordId, quantity: l.quantity })), d);
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId: user.id }, id: { in: lines.map((l) => l.id) } } });
    return order;
  }

  /** Shared by checkout and accepted offers. Stock is reserved atomically; nothing is half-written. */
  async createOrder(buyer: AuthUser, storeId: string, lines: OrderLineInput[], o: OrderOpts) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, status: 'VERIFIED', deletedAt: null } });
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Do‘kon topilmadi yoki tasdiqlanmagan.');
    if (store.ownerId === buyer.id) throw new AppError(400, 'OWN_STORE', 'O‘z do‘koningizdan buyurtma bera olmaysiz.');

    const order = await this.prisma.$transaction(async (tx) => {
      const recs = await tx.priceRecord.findMany({
        where: { id: { in: lines.map((l) => l.priceRecordId) }, storeId, moderationStatus: 'APPROVED', deletedAt: null },
        include: { unit: true, variant: { include: { unit: true } }, product: { select: { status: true } } },
      });
      if (recs.length !== new Set(lines.map((l) => l.priceRecordId)).size || recs.some((r) => r.product.status !== 'APPROVED')) throw new AppError(409, 'PRICE_UNAVAILABLE', 'Mahsulot narxi mavjud emas yoki o‘zgargan.');
      const tiers = await tx.wholesaleTier.findMany({ where: { priceRecordId: { in: recs.map((r) => r.id) } } });

      const priced = lines.map((l) => {
        const r = recs.find((x) => x.id === l.priceRecordId)!;
        const base = normalize(r).effectivePrice;
        const unitPrice = l.unitPriceOverride ?? round2(unitPriceFor(base, l.quantity, tiers.filter((t) => t.priceRecordId === r.id).map((t) => ({ minQuantity: num(t.minQuantity), unitPrice: num(t.unitPrice) }))));
        return { rec: r, quantity: l.quantity, unitPrice };
      });

      // reserve stock: the conditional update cannot go below zero even with two buyers at once
      for (const p of priced) {
        if (p.rec.quantityAvailable === null) continue;
        const r = await tx.priceRecord.updateMany({ where: { id: p.rec.id, quantityAvailable: { gte: p.quantity } }, data: { quantityAvailable: { decrement: p.quantity } } });
        if (r.count !== 1) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Omborda yetarli mahsulot qolmadi.', { priceRecordId: p.rec.id });
        const after = await tx.priceRecord.findUniqueOrThrow({ where: { id: p.rec.id }, select: { quantityAvailable: true } });
        if (num(after.quantityAvailable) === 0) await tx.priceRecord.update({ where: { id: p.rec.id }, data: { availability: 'OUT_OF_STOCK' } });
        await tx.stockMovement.create({ data: { priceRecordId: p.rec.id, delta: -p.quantity, balanceAfter: after.quantityAvailable!, reason: 'ORDER_RESERVED', actorId: buyer.id } });
      }

      let discountPercent = 0;
      let discountMin = 0;
      let discountId: string | null = null;
      if (o.couponCode) {
        const now = new Date();
        const dsc = await tx.discount.findFirst({ where: { storeId, code: o.couponCode, active: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] } });
        if (!dsc || (dsc.usageLimit !== null && dsc.usedCount >= dsc.usageLimit)) throw new AppError(400, 'COUPON_INVALID', 'Chegirma kodi noto‘g‘ri yoki muddati tugagan.');
        discountPercent = num(dsc.percent);
        discountMin = num(dsc.minAmount);
        discountId = dsc.id;
      }
      const fee = o.deliveryMethod === 'DELIVERY' ? await this.setting<number>('delivery.fee', 0) : 0;
      const totals = orderTotals(priced.map((p) => ({ quantity: p.quantity, unitPrice: p.unitPrice })), { discountPercent, discountMinAmount: discountMin, deliveryFee: fee });
      if (discountId && totals.discountAmount === 0) throw new AppError(400, 'COUPON_MIN_AMOUNT', `Bu chegirma ${discountMin.toLocaleString('uz-UZ')} so‘mdan yuqori buyurtmalar uchun.`);
      if (discountId) {
        const dsc = await tx.discount.findUniqueOrThrow({ where: { id: discountId } });
        const used = await tx.discount.updateMany({ where: { id: discountId, ...(dsc.usageLimit !== null ? { usedCount: { lt: dsc.usageLimit } } : {}) }, data: { usedCount: { increment: 1 } } });
        if (used.count !== 1) throw new AppError(400, 'COUPON_INVALID', 'Chegirma kodi ishlatib bo‘lingan.');
      }

      const created = await tx.order.create({
        data: {
          number: await this.newNumber(tx), buyerId: buyer.id, storeId, totalAmount: totals.total, discountAmount: totals.discountAmount, deliveryFee: totals.deliveryFee,
          couponCode: discountId ? o.couponCode : null, paymentMethod: o.paymentMethod, deliveryMethod: o.deliveryMethod, deliveryAddress: o.deliveryAddress ?? null, note: o.note ?? null,
          items: { create: priced.map((p) => ({ productId: p.rec.productId, variantId: p.rec.variantId, unitId: p.rec.unitId, quantity: p.quantity, unitPrice: p.unitPrice, priceRecordId: p.rec.id })) },
          delivery: { create: { address: o.deliveryMethod === 'DELIVERY' ? o.deliveryAddress ?? null : null } },
        },
      });
      await tx.orderEvent.create({ data: { orderId: created.id, actorId: buyer.id, toState: 'CREATED' } });
      return created;
    });

    await this.audit.record({ actorId: buyer.id, action: 'ORDER_CREATE', entityType: 'order', entityId: order.id, after: { number: order.number, total: num(order.totalAmount) } });
    await this.notif.notify(store.ownerId, { type: 'ORDER_NEW', title: `Yangi buyurtma ${order.number}`, body: `${num(order.totalAmount).toLocaleString('uz-UZ')} so‘m`, url: `/seller/orders/${order.id}` }, { email: { template: 'order', data: { orderNumber: order.number, status: 'Yangi buyurtma', url: `/seller/orders/${order.id}` } } });
    return { id: order.id, number: order.number, totalAmount: num(order.totalAmount), status: order.status };
  }

  // ───────────── reading ─────────────

  async list(user: AuthUser, q: PageQuery & z.infer<typeof orderListQuery>) {
    const where: Prisma.OrderWhereInput = {
      ...(q.as === 'buyer' ? { buyerId: user.id } : { store: { ownerId: user.id, ...(q.storeId ? { id: q.storeId } : {}) } }),
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { number: { contains: q.q.toUpperCase() } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { store: { select: { id: true, name: true } }, buyer: { select: { profile: { select: { fullName: true } } } }, _count: { select: { items: true } }, contract: { select: { id: true, status: true } } } }),
      this.prisma.order.count({ where }),
    ]);
    return paged(rows.map((o) => ({ id: o.id, number: o.number, status: o.status, totalAmount: num(o.totalAmount), createdAt: o.createdAt, store: o.store, buyerName: q.as === 'seller' ? o.buyer.profile?.fullName ?? null : undefined, itemsCount: o._count.items, paymentMethod: o.paymentMethod, deliveryMethod: o.deliveryMethod, contract: o.contract })), total, q);
  }

  async detail(user: AuthUser, id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, ownerId: true } },
        buyer: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true } } } },
        items: { include: { product: { select: { id: true, name: true, slug: true } }, unit: { select: { code: true } }, variant: { select: { name: true } } } },
        payments: true, delivery: true, contract: { select: { id: true, number: true, status: true } },
        disputes: { select: { id: true, status: true, resolution: true, createdAt: true } },
      },
    });
    const isBuyer = o?.buyerId === user.id;
    const isSeller = o?.store.ownerId === user.id;
    if (!o || (!isBuyer && !isSeller && !isStaff(user.roles))) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    const events = await this.prisma.orderEvent.findMany({ where: { orderId: id }, orderBy: { createdAt: 'asc' } });
    const settled = o.payments.some((p) => p.status === 'PAID');
    return {
      id: o.id, number: o.number, status: o.status, totalAmount: num(o.totalAmount), discountAmount: num(o.discountAmount), deliveryFee: num(o.deliveryFee), couponCode: o.couponCode,
      paymentMethod: o.paymentMethod, deliveryMethod: o.deliveryMethod, deliveryAddress: o.deliveryAddress, note: o.note, createdAt: o.createdAt, settled,
      myRole: isBuyer ? 'buyer' : isSeller ? 'seller' : 'staff',
      store: { id: o.store.id, name: o.store.name },
      buyer: isSeller || isStaff(user.roles) ? { id: o.buyer.id, name: o.buyer.profile?.fullName ?? null, phone: o.buyer.phone } : undefined,
      items: o.items.map((i) => ({ id: i.id, product: i.product, variant: i.variant?.name ?? null, unit: i.unit.code, quantity: num(i.quantity), unitPrice: num(i.unitPrice), lineTotal: round2(num(i.quantity) * num(i.unitPrice)) })),
      payments: o.payments.map((p) => ({ id: p.id, provider: p.provider, status: p.status, amount: num(p.amount), createdAt: p.createdAt })),
      delivery: o.delivery, contract: o.contract, disputes: o.disputes, events,
      actions: this.availableActions(o.status, isBuyer, isSeller, o.deliveryMethod, o.paymentMethod, settled),
    };
  }

  /** The buttons the UI may show. The server re-checks every one of them in `transition`. */
  private availableActions(status: string, isBuyer: boolean, isSeller: boolean, delivery: string | null, method: string, settled: boolean): string[] {
    const a: string[] = [];
    if (isSeller) {
      if (status === 'CREATED') a.push('CONFIRMED', 'CANCELLED');
      if (status === 'CONFIRMED') a.push('PROCESSING', 'CANCELLED');
      if (status === 'PROCESSING') a.push('READY', 'CANCELLED');
      if (status === 'READY') a.push(delivery === 'DELIVERY' ? 'SHIPPED' : 'DELIVERED', 'CANCELLED');
      if (status === 'SHIPPED') a.push('DELIVERED');
      if (status === 'ACCEPTED' && settled) a.push('COMPLETED');
    }
    if (isBuyer) {
      if (status === 'CREATED') a.push('CANCELLED');
      if (status === 'DELIVERED') a.push('ACCEPTED');
    }
    void method;
    return [...new Set(a)];
  }

  // ───────────── state changes ─────────────

  async transition(user: AuthUser, id: string, d: z.infer<typeof transitionSchema>) {
    const o = await this.prisma.order.findUnique({ where: { id }, include: { store: { select: { ownerId: true, name: true } }, items: true, delivery: true, payments: { select: { status: true } }, contract: { select: { id: true, status: true } } } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    const isBuyer = o.buyerId === user.id;
    const isSeller = o.store.ownerId === user.id;
    if (!isBuyer && !isSeller) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');

    const to = d.to as OrderStatus;
    const needed = WHO[to]; // CANCELLED has its own rule below
    if (to === 'CANCELLED') {
      if (isBuyer && o.status !== 'CREATED') throw new AppError(403, 'FORBIDDEN', 'Xaridor buyurtmani faqat sotuvchi tasdiqlamaguncha bekor qila oladi.');
      if (isSeller && !['CREATED', 'CONFIRMED', 'PROCESSING', 'READY'].includes(o.status)) throw new AppError(409, 'TOO_LATE', 'Yo‘lga chiqqan buyurtmani bekor qilib bo‘lmaydi. Nizo oching.');
    } else if ((needed === 'seller' && !isSeller) || (needed === 'buyer' && !isBuyer)) {
      throw new AppError(403, 'FORBIDDEN', 'Bu amalni bajarishga ruxsatingiz yo‘q.');
    }

    try {
      assertOrderTransition(o.status as OrderStatus, to);
    } catch (e) {
      if (e instanceof InvalidTransitionError) throw new AppError(409, 'INVALID_TRANSITION', `Buyurtmani "${o.status}" holatidan "${to}" holatiga o‘tkazib bo‘lmaydi.`);
      throw e;
    }
    if (to === 'SHIPPED' && o.deliveryMethod !== 'DELIVERY') throw new AppError(409, 'NOT_DELIVERY_ORDER', 'Olib ketiladigan buyurtma yo‘lga chiqmaydi.');
    if (to === 'DELIVERED' && o.status === 'READY' && o.deliveryMethod === 'DELIVERY') throw new AppError(409, 'MUST_SHIP_FIRST', 'Avval buyurtmani "Yo‘lga chiqdi" holatiga o‘tkazing.');

    const settled = o.payments.some((p) => p.status === 'PAID');
    if (to === 'PROCESSING') {
      if (o.paymentMethod === 'CARD' && !settled) throw new AppError(409, 'PAYMENT_REQUIRED', 'Karta bilan to‘lov amalga oshmaguncha tayyorlashni boshlab bo‘lmaydi.');
      if ((await this.setting<boolean>('orders.requireSignedContract', false)) && !(await this.contracts.isSigned(id))) throw new AppError(409, 'CONTRACT_NOT_SIGNED', 'Shartnoma ikkala tomon tomonidan imzolanmaguncha buyurtmani tayyorlab bo‘lmaydi.');
    }
    if (to === 'COMPLETED' && !settled) throw new AppError(409, 'PAYMENT_REQUIRED', 'To‘lov tasdiqlanmaguncha bitimni yakunlab bo‘lmaydi.');

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: to } });
      await tx.orderEvent.create({ data: { orderId: id, actorId: user.id, fromState: o.status, toState: to, note: d.note ?? null } });
      if (to === 'SHIPPED') await tx.delivery.update({ where: { orderId: id }, data: { status: 'IN_TRANSIT', carrier: d.carrier ?? null, trackingRef: d.trackingRef ?? null } });
      if (to === 'DELIVERED') await tx.delivery.update({ where: { orderId: id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
      if (to === 'ACCEPTED') await tx.delivery.update({ where: { orderId: id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      if (to === 'CANCELLED') await this.release(tx, o.items, user.id, o.id);
    });
    await this.audit.record({ actorId: user.id, action: `ORDER_${to}`, entityType: 'order', entityId: id, before: { status: o.status }, after: { status: to } });

    if (to === 'CONFIRMED') {
      await this.contracts.createForOrder(id, user.id).catch(() => this.log.error(`contract for order ${o.number} was not created; seller can retry from the order page`));
    }
    if (to === 'CANCELLED') await this.contracts.cancelForOrder(id, user.id).catch(() => undefined);

    const other = isSeller ? o.buyerId : o.store.ownerId;
    await this.notif.notify(other, { type: 'ORDER_STATUS', title: `Buyurtma ${o.number}: ${to}`, body: d.note ?? 'Holat yangilandi.', url: isSeller ? `/orders/${id}` : `/seller/orders/${id}` }, { email: { template: 'order', data: { orderNumber: o.number, status: to, url: isSeller ? `/orders/${id}` : `/seller/orders/${id}` } } });
    if (to === 'ACCEPTED') await this.completeIfReady(id, user.id);
    return { status: to };
  }

  /** Accepted + paid = the deal is finished. Called after acceptance and after the cash is confirmed. */
  async completeIfReady(orderId: string, actorId: string): Promise<boolean> {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true, number: true, buyerId: true, store: { select: { ownerId: true } } } });
    if (!o || o.status !== 'ACCEPTED' || !(await this.payments.isSettled(orderId))) return false;
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } }),
      this.prisma.orderEvent.create({ data: { orderId, actorId, fromState: 'ACCEPTED', toState: 'COMPLETED', note: 'Qabul qilindi va to‘lov tasdiqlandi' } }),
    ]);
    await this.contracts.completeForOrder(orderId, actorId).catch(() => undefined);
    for (const uid of [o.buyerId, o.store.ownerId]) await this.notif.notify(uid, { type: 'ORDER_STATUS', title: `Bitim yakunlandi: ${o.number}`, body: 'Buyurtma qabul qilindi va to‘lov tasdiqlandi.', url: `/orders/${orderId}` });
    return true;
  }

  /** Give reserved stock back when an order is cancelled. */
  private async release(tx: Tx, items: Array<{ priceRecordId: string | null; quantity: Prisma.Decimal }>, actorId: string, orderId: string) {
    for (const i of items) {
      if (!i.priceRecordId) continue;
      const rec = await tx.priceRecord.findUnique({ where: { id: i.priceRecordId }, select: { quantityAvailable: true, availability: true } });
      if (!rec || rec.quantityAvailable === null) continue;
      const after = await tx.priceRecord.update({ where: { id: i.priceRecordId }, data: { quantityAvailable: { increment: i.quantity }, availability: rec.availability === 'OUT_OF_STOCK' ? 'IN_STOCK' : rec.availability }, select: { quantityAvailable: true } });
      await tx.stockMovement.create({ data: { priceRecordId: i.priceRecordId, delta: i.quantity, balanceAfter: after.quantityAvailable!, reason: 'ORDER_CANCELLED', refType: 'ORDER', refId: orderId, actorId } });
    }
  }

  /** Moderator decision on a dispute: the only way out of DISPUTED. */
  async resolveDisputed(orderId: string, to: 'COMPLETED' | 'CANCELLED', actorId: string, note: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!o || o.status !== 'DISPUTED') throw new AppError(409, 'NOT_DISPUTED', 'Buyurtma nizoli holatda emas.');
    assertOrderTransition('DISPUTED', to);
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: to } });
      await tx.orderEvent.create({ data: { orderId, actorId, fromState: 'DISPUTED', toState: to, note } });
      if (to === 'CANCELLED') await this.release(tx, o.items, actorId, orderId);
    });
  }

  async markDisputed(orderId: string, actorId: string, note: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    try {
      assertOrderTransition(o.status as OrderStatus, 'DISPUTED');
    } catch {
      throw new AppError(409, 'CANNOT_DISPUTE', 'Bu holatdagi buyurtma bo‘yicha nizo ochib bo‘lmaydi.');
    }
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: orderId }, data: { status: 'DISPUTED' } }),
      this.prisma.orderEvent.create({ data: { orderId, actorId, fromState: o.status, toState: 'DISPUTED', note } }),
    ]);
  }

  // ───────────── delivery evidence and review ─────────────

  async addDeliveryEvidence(user: AuthUser, id: string, fileId: string) {
    const o = await this.prisma.order.findFirst({ where: { id, OR: [{ buyerId: user.id }, { store: { ownerId: user.id } }] }, select: { id: true } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    const f = await this.prisma.fileObject.findUnique({ where: { id: fileId }, select: { ownerId: true, kind: true } });
    if (!f || f.ownerId !== user.id || (f.kind !== 'EVIDENCE' && f.kind !== 'DELIVERY_ACT')) throw new AppError(400, 'FILE_INVALID', 'Fayl topilmadi yoki sizga tegishli emas.');
    await this.prisma.delivery.update({ where: { orderId: id }, data: { evidenceKeys: { push: fileId } } });
    return { added: true };
  }

  async review(user: AuthUser, id: string, d: z.infer<typeof reviewSchema>) {
    const o = await this.prisma.order.findFirst({ where: { id, buyerId: user.id }, select: { status: true, storeId: true } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    if (o.status !== 'COMPLETED') throw new AppError(409, 'NOT_COMPLETED', 'Sharh faqat yakunlangan buyurtmaga qoldiriladi.');
    try {
      return await this.prisma.review.create({ data: { authorId: user.id, storeId: o.storeId, orderId: id, rating: d.rating, comment: d.comment ?? null } });
    } catch {
      throw new AppError(409, 'ALREADY_REVIEWED', 'Siz bu buyurtmaga allaqachon sharh qoldirgansiz.');
    }
  }
}
