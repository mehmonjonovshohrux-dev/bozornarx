import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, num, paged } from '../common/util';
import { normalize } from '../catalog/catalog.service';
import { round2, unitPriceFor, validOfferPrice } from '../domain/pricing';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';
import { offerCreateSchema, offerRespondSchema } from './trade.schemas';

const TTL_MS = 72 * 3_600_000;

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService, private readonly cart: CartService, private readonly orders: OrdersService, private readonly notif: NotificationsService) {}

  private async listedPrice(priceRecordId: string, quantity: number): Promise<number> {
    const r = await this.prisma.priceRecord.findUniqueOrThrow({ where: { id: priceRecordId }, include: { unit: true, variant: { include: { unit: true } } } });
    const tiers = await this.prisma.wholesaleTier.findMany({ where: { priceRecordId } });
    return round2(unitPriceFor(normalize(r).effectivePrice, quantity, tiers.map((t) => ({ minQuantity: num(t.minQuantity), unitPrice: num(t.unitPrice) }))));
  }

  async create(user: AuthUser, d: z.infer<typeof offerCreateSchema>) {
    const r = await this.cart.assertOrderable(d.priceRecordId, d.quantity);
    if (r.store.ownerId === user.id) throw new AppError(400, 'OWN_STORE', 'O‘z do‘koningizga taklif bera olmaysiz.');
    const listed = await this.listedPrice(d.priceRecordId, d.quantity);
    if (!validOfferPrice(d.offeredUnitPrice, listed)) throw new AppError(400, 'OFFER_PRICE_INVALID', `Taklif narxi ${round2(listed * 0.3).toLocaleString('uz-UZ')} dan ${listed.toLocaleString('uz-UZ')} so‘mgacha bo‘lishi kerak.`, { listed });
    if (await this.prisma.offer.count({ where: { buyerId: user.id, priceRecordId: d.priceRecordId, status: { in: ['PENDING', 'COUNTERED'] } } })) throw new AppError(409, 'OFFER_EXISTS', 'Bu mahsulot bo‘yicha faol taklifingiz bor.');
    const o = await this.prisma.offer.create({ data: { buyerId: user.id, storeId: r.store.id, priceRecordId: d.priceRecordId, quantity: d.quantity, offeredUnitPrice: d.offeredUnitPrice, message: d.message ?? null, deliveryMethod: d.deliveryMethod, deliveryAddress: d.deliveryAddress ?? null, paymentMethod: d.paymentMethod, expiresAt: new Date(Date.now() + TTL_MS) } });
    await this.notif.notify(r.store.ownerId, { type: 'OFFER_NEW', title: `Yangi taklif: ${r.product.name}`, body: `${d.quantity} ${r.unit.code} uchun ${d.offeredUnitPrice.toLocaleString('uz-UZ')} so‘m/${r.unit.code}`, url: '/seller/offers' });
    return o;
  }

  async list(user: AuthUser, q: PageQuery & { as: 'buyer' | 'seller'; status?: string }) {
    const myStoreIds = q.as === 'buyer' ? [] : (await this.prisma.store.findMany({ where: { ownerId: user.id, deletedAt: null }, select: { id: true } })).map((s) => s.id);
    const where = { ...(q.as === 'buyer' ? { buyerId: user.id } : { storeId: { in: myStoreIds } }), ...(q.status ? { status: q.status as 'PENDING' } : {}) };
    const [rows, total] = await Promise.all([this.prisma.offer.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }), this.prisma.offer.count({ where })]);
    const recs = await this.prisma.priceRecord.findMany({ where: { id: { in: rows.map((o) => o.priceRecordId) } }, include: { product: { select: { name: true, slug: true } }, unit: { select: { code: true } }, store: { select: { name: true } } } });
    const byId = new Map(recs.map((r) => [r.id, r]));
    return paged(rows.map((o) => {
      const r = byId.get(o.priceRecordId);
      return { id: o.id, status: o.status, quantity: num(o.quantity), offeredUnitPrice: num(o.offeredUnitPrice), counterUnitPrice: o.counterUnitPrice ? num(o.counterUnitPrice) : null, message: o.message, expiresAt: o.expiresAt, orderId: o.orderId, createdAt: o.createdAt, product: r?.product ?? null, unit: r?.unit.code ?? null, storeName: r?.store.name ?? null, listedPrice: r ? num(r.price) : null };
    }), total, q);
  }

  private async mint(o: { id: string; buyerId: string; storeId: string; priceRecordId: string; quantity: unknown; deliveryMethod: string; deliveryAddress: string | null; paymentMethod: string }, price: number) {
    return this.orders.createOrder({ id: o.buyerId, roles: ['BUYER'], sessionId: '' }, o.storeId, [{ priceRecordId: o.priceRecordId, quantity: num(o.quantity as number), unitPriceOverride: price }], { deliveryMethod: o.deliveryMethod as 'PICKUP', deliveryAddress: o.deliveryAddress ?? undefined, paymentMethod: o.paymentMethod as 'CARD' });
  }

  async respond(user: AuthUser, id: string, d: z.infer<typeof offerRespondSchema>) {
    const myStores = await this.prisma.store.findMany({ where: { ownerId: user.id, deletedAt: null }, select: { id: true } });
    const o = await this.prisma.offer.findFirst({ where: { id, storeId: { in: myStores.map((s) => s.id) } } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Taklif topilmadi.');
    if (o.status !== 'PENDING') throw new AppError(409, 'NOT_PENDING', 'Bu taklifga javob berilgan.');
    if (o.expiresAt < new Date()) {
      await this.prisma.offer.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      throw new AppError(409, 'EXPIRED', 'Taklif muddati tugagan.');
    }
    if (d.action === 'REJECT') {
      await this.prisma.offer.update({ where: { id }, data: { status: 'REJECTED' } });
      await this.notif.notify(o.buyerId, { type: 'OFFER_REJECTED', title: 'Taklifingiz rad etildi', body: 'Sotuvchi taklifni qabul qilmadi.', url: '/offers' });
      return { status: 'REJECTED' };
    }
    if (d.action === 'COUNTER') {
      const listed = await this.listedPrice(o.priceRecordId, num(o.quantity));
      const c = d.counterUnitPrice!;
      if (c <= num(o.offeredUnitPrice) || c > listed) throw new AppError(400, 'COUNTER_INVALID', `Qarshi narx ${num(o.offeredUnitPrice).toLocaleString('uz-UZ')} dan yuqori va ${listed.toLocaleString('uz-UZ')} dan oshmasligi kerak.`);
      await this.prisma.offer.update({ where: { id }, data: { status: 'COUNTERED', counterUnitPrice: c, expiresAt: new Date(Date.now() + TTL_MS) } });
      await this.notif.notify(o.buyerId, { type: 'OFFER_COUNTER', title: 'Sotuvchi qarshi narx taklif qildi', body: `${c.toLocaleString('uz-UZ')} so‘m`, url: '/offers' });
      return { status: 'COUNTERED' };
    }
    // ACCEPT: claim first so two clicks cannot create two orders
    const claimed = await this.prisma.offer.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'ACCEPTED' } });
    if (claimed.count !== 1) throw new AppError(409, 'NOT_PENDING', 'Bu taklifga javob berilgan.');
    try {
      const order = await this.mint(o, num(o.offeredUnitPrice));
      await this.prisma.offer.update({ where: { id }, data: { orderId: order.id } });
      await this.notif.notify(o.buyerId, { type: 'OFFER_ACCEPTED', title: `Taklifingiz qabul qilindi: ${order.number}`, body: 'Buyurtma yaratildi.', url: `/orders/${order.id}` });
      return { status: 'ACCEPTED', orderId: order.id };
    } catch (e) {
      await this.prisma.offer.update({ where: { id }, data: { status: 'PENDING' } }); // order could not be created (e.g. out of stock): offer stays open
      throw e;
    }
  }

  async acceptCounter(user: AuthUser, id: string) {
    const o = await this.prisma.offer.findFirst({ where: { id, buyerId: user.id } });
    if (!o || o.status !== 'COUNTERED' || !o.counterUnitPrice) throw new AppError(409, 'NOT_COUNTERED', 'Qarshi taklif topilmadi.');
    if (o.expiresAt < new Date()) throw new AppError(409, 'EXPIRED', 'Taklif muddati tugagan.');
    const claimed = await this.prisma.offer.updateMany({ where: { id, status: 'COUNTERED' }, data: { status: 'ACCEPTED' } });
    if (claimed.count !== 1) throw new AppError(409, 'NOT_COUNTERED', 'Qarshi taklif topilmadi.');
    try {
      const order = await this.mint(o, num(o.counterUnitPrice));
      await this.prisma.offer.update({ where: { id }, data: { orderId: order.id } });
      return { status: 'ACCEPTED', orderId: order.id };
    } catch (e) {
      await this.prisma.offer.update({ where: { id }, data: { status: 'COUNTERED' } });
      throw e;
    }
  }

  async cancel(user: AuthUser, id: string) {
    const r = await this.prisma.offer.updateMany({ where: { id, buyerId: user.id, status: { in: ['PENDING', 'COUNTERED'] } }, data: { status: 'CANCELLED' } });
    if (r.count !== 1) throw new AppError(404, 'NOT_FOUND', 'Faol taklif topilmadi.');
    return { status: 'CANCELLED' };
  }
}
