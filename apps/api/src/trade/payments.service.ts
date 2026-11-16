import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, isStaff, num, paged } from '../common/util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Payment provider adapter. The platform holds NO funds (no escrow): money moves through a licensed provider.
 * No provider is integrated yet, so `createCharge` refuses honestly. When a provider contract exists, implement
 * this interface and register it under PAYMENT_PROVIDER_MODE; nothing else in the app changes.
 */
export interface PaymentProvider {
  readonly code: string;
  createCharge(input: { orderId: string; orderNumber: string; amount: number; currency: string }): Promise<{ providerRef: string; redirectUrl: string }>;
}

export class NotConfiguredPaymentProvider implements PaymentProvider {
  readonly code = 'NONE';
  createCharge(): Promise<never> {
    return Promise.reject(new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Karta orqali to‘lov hali ulanmagan (to‘lov provayderi bilan shartnoma va kalitlar kerak). Naqd to‘lovdan foydalaning.'));
  }
}

@Injectable()
export class PaymentsService {
  private readonly provider: PaymentProvider = new NotConfiguredPaymentProvider();
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notif: NotificationsService) {}

  /** Card payment: goes to the provider. Today this answers 503 because no provider is configured. */
  async startCardPayment(user: AuthUser, orderId: string) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, buyerId: user.id } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    if (['CANCELLED', 'COMPLETED', 'DISPUTED'].includes(o.status)) throw new AppError(409, 'ORDER_CLOSED', 'Bu buyurtma uchun to‘lov qabul qilinmaydi.');
    const paid = await this.prisma.payment.count({ where: { orderId, status: 'PAID' } });
    if (paid > 0) throw new AppError(409, 'ALREADY_PAID', 'Buyurtma allaqachon to‘langan.');
    const charge = await this.provider.createCharge({ orderId, orderNumber: o.number, amount: num(o.totalAmount), currency: o.currency });
    const p = await this.prisma.payment.create({ data: { orderId, provider: this.provider.code, providerRef: charge.providerRef, amount: o.totalAmount, currency: o.currency } });
    return { paymentId: p.id, redirectUrl: charge.redirectUrl };
  }

  /** Cash on delivery: the seller confirms they received the money. This is a real record, not a simulation of a card payment. */
  async confirmCash(user: AuthUser, orderId: string) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, store: { ownerId: user.id } } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    if (o.paymentMethod !== 'CASH_ON_DELIVERY') throw new AppError(400, 'NOT_CASH_ORDER', 'Bu buyurtma naqd to‘lovli emas.');
    if (!['DELIVERED', 'ACCEPTED'].includes(o.status)) throw new AppError(409, 'TOO_EARLY', 'Naqd pul topshirilgandan keyingina tasdiqlanadi (buyurtma "Yetkazildi" holatida bo‘lishi kerak).');
    const existing = await this.prisma.payment.findFirst({ where: { orderId, status: 'PAID' } });
    if (existing) return existing;
    const p = await this.prisma.payment.create({ data: { orderId, provider: 'CASH', providerRef: `cash-${orderId}`, amount: o.totalAmount, currency: o.currency, status: 'PAID' } });
    await this.audit.record({ actorId: user.id, action: 'PAYMENT_CASH_CONFIRMED', entityType: 'payment', entityId: p.id, after: { orderId, amount: num(o.totalAmount) } });
    await this.notif.notify(o.buyerId, { type: 'PAYMENT', title: `To‘lov qabul qilindi: ${o.number}`, body: `${num(o.totalAmount).toLocaleString('uz-UZ')} so‘m naqd.`, url: `/orders/${o.id}` });
    return p;
  }

  async isSettled(orderId: string): Promise<boolean> {
    return (await this.prisma.payment.count({ where: { orderId, status: 'PAID' } })) > 0;
  }

  /** payments.view: buyer/seller see their own, staff with the permission see all. */
  async list(user: AuthUser, q: PageQuery & { status?: string }) {
    const staff = isStaff(user.roles) && user.roles.includes('SUPER_ADMIN');
    const where = {
      ...(q.status ? { status: q.status as 'PENDING' } : {}),
      ...(staff ? {} : { order: { OR: [{ buyerId: user.id }, { store: { ownerId: user.id } }] } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { order: { select: { id: true, number: true, buyerId: true, store: { select: { name: true } } } } } }),
      this.prisma.payment.count({ where }),
    ]);
    return paged(rows.map((p) => ({ ...p, amount: num(p.amount) })), total, q);
  }
}
