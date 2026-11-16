import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, isAdmin, isStaff, paged } from '../common/util';
import { assertContractTransition } from '../domain/state-machines';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../trade/orders.service';
import { disputeCreateSchema, disputeNoteSchema, disputeResolveSchema } from './contracts.schemas';

interface EvidenceEntry {
  by: string;
  role: string;
  text?: string;
  fileId?: string;
  at: string;
}

/** Dispute and warranty centre: parties add evidence, a moderator decides, the loser side may appeal once to a Super Admin. */
@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService, private readonly orders: OrdersService, private readonly audit: AuditService, private readonly notif: NotificationsService) {}

  private async access(user: AuthUser, id: string) {
    const d = await this.prisma.dispute.findUnique({ where: { id }, include: { order: { select: { id: true, number: true, buyerId: true, store: { select: { ownerId: true, name: true } } } } } });
    const isBuyer = d?.order?.buyerId === user.id;
    const isSeller = d?.order?.store.ownerId === user.id;
    if (!d || (!isBuyer && !isSeller && !isStaff(user.roles))) throw new AppError(404, 'NOT_FOUND', 'Nizo topilmadi.');
    return { d, role: isBuyer ? 'buyer' : isSeller ? 'seller' : 'staff' };
  }

  private async files(userId: string, ids: string[]) {
    for (const id of ids) {
      const f = await this.prisma.fileObject.findUnique({ where: { id }, select: { ownerId: true, kind: true } });
      if (!f || f.ownerId !== userId || (f.kind !== 'EVIDENCE' && f.kind !== 'DELIVERY_ACT')) throw new AppError(400, 'FILE_INVALID', 'Dalil fayli topilmadi yoki sizga tegishli emas.');
    }
  }

  async open(user: AuthUser, d: z.infer<typeof disputeCreateSchema>) {
    const o = await this.prisma.order.findFirst({ where: { id: d.orderId, OR: [{ buyerId: user.id }, { store: { ownerId: user.id } }] }, include: { store: { select: { ownerId: true } }, contract: { select: { id: true, status: true } } } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    if (await this.prisma.dispute.count({ where: { orderId: o.id, status: { in: ['OPEN', 'IN_REVIEW', 'APPEALED'] } } })) throw new AppError(409, 'DISPUTE_EXISTS', 'Bu buyurtma bo‘yicha nizo allaqachon ochilgan.');
    await this.files(user.id, d.evidenceFileIds);
    const role = o.buyerId === user.id ? 'buyer' : 'seller';
    await this.orders.markDisputed(o.id, user.id, d.reason); // throws 409 if the order state does not allow a dispute
    const evidence: EvidenceEntry[] = [
      { by: user.id, role, text: [d.reason, d.details].filter(Boolean).join('\n'), at: new Date().toISOString() },
      ...d.evidenceFileIds.map((fileId) => ({ by: user.id, role, fileId, at: new Date().toISOString() })),
    ];
    const dispute = await this.prisma.dispute.create({ data: { orderId: o.id, contractId: o.contract?.id ?? null, openedById: user.id, evidence: evidence as unknown as Prisma.InputJsonValue } });
    if (o.contract) {
      try {
        assertContractTransition(o.contract.status as never, 'DISPUTED');
        await this.prisma.contract.update({ where: { id: o.contract.id }, data: { status: 'DISPUTED' } });
      } catch {
        /* the contract is in a state that cannot be disputed (e.g. still unsigned): the order dispute is enough */
      }
    }
    await this.audit.record({ actorId: user.id, action: 'DISPUTE_OPEN', entityType: 'dispute', entityId: dispute.id, after: { orderId: o.id } });
    const other = role === 'buyer' ? o.store.ownerId : o.buyerId;
    await this.notif.notify(other, { type: 'DISPUTE', title: `Nizo ochildi: ${o.number}`, body: d.reason, url: `/disputes/${dispute.id}` });
    return dispute;
  }

  async list(user: AuthUser, q: PageQuery & { status?: string }) {
    const where: Prisma.DisputeWhereInput = {
      ...(q.status ? { status: q.status as 'OPEN' } : {}),
      ...(isStaff(user.roles) ? {} : { order: { OR: [{ buyerId: user.id }, { store: { ownerId: user.id } }] } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.dispute.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { order: { select: { id: true, number: true, totalAmount: true, store: { select: { name: true } } } } } }),
      this.prisma.dispute.count({ where }),
    ]);
    return paged(rows.map((d) => ({ id: d.id, status: d.status, orderId: d.order?.id, orderNumber: d.order?.number, storeName: d.order?.store.name, amount: d.order ? Number(d.order.totalAmount) : null, createdAt: d.createdAt, resolution: d.resolution })), total, q);
  }

  async detail(user: AuthUser, id: string) {
    const { d, role } = await this.access(user, id);
    return { id: d.id, status: d.status, resolution: d.resolution, createdAt: d.createdAt, orderId: d.order?.id, orderNumber: d.order?.number, contractId: d.contractId, evidence: d.evidence, myRole: role, canAppeal: d.status === 'RESOLVED' && role !== 'staff' };
  }

  async addNote(user: AuthUser, id: string, n: z.infer<typeof disputeNoteSchema>) {
    const { d, role } = await this.access(user, id);
    if (!['OPEN', 'IN_REVIEW', 'APPEALED'].includes(d.status)) throw new AppError(409, 'CLOSED', 'Nizo yopilgan.');
    if (n.fileId) await this.files(user.id, [n.fileId]);
    const list = (d.evidence as unknown as EvidenceEntry[]) ?? [];
    if (list.length >= 60) throw new AppError(400, 'TOO_MANY_ENTRIES', 'Nizoga qo‘shiladigan yozuvlar chegarasiga yetildi.');
    list.push({ by: user.id, role, text: n.text, fileId: n.fileId, at: new Date().toISOString() });
    await this.prisma.dispute.update({ where: { id }, data: { evidence: list as unknown as Prisma.InputJsonValue, ...(role === 'staff' && d.status === 'OPEN' ? { status: 'IN_REVIEW' } : {}) } });
    return { added: true };
  }

  async take(user: AuthUser, id: string) {
    const d = await this.prisma.dispute.findUnique({ where: { id } });
    if (!d) throw new AppError(404, 'NOT_FOUND', 'Nizo topilmadi.');
    if (d.status !== 'OPEN') throw new AppError(409, 'NOT_OPEN', 'Nizo ko‘rib chiqishga olingan yoki yopilgan.');
    await this.prisma.dispute.update({ where: { id }, data: { status: 'IN_REVIEW' } });
    await this.audit.record({ actorId: user.id, action: 'DISPUTE_TAKE', entityType: 'dispute', entityId: id });
    return { status: 'IN_REVIEW' };
  }

  async resolve(user: AuthUser, id: string, r: z.infer<typeof disputeResolveSchema>) {
    const d = await this.prisma.dispute.findUnique({ where: { id }, include: { order: { select: { id: true, number: true, buyerId: true, store: { select: { ownerId: true } } } } } });
    if (!d || !d.order) throw new AppError(404, 'NOT_FOUND', 'Nizo topilmadi.');
    if (d.status === 'APPEALED' && !isAdmin(user.roles)) throw new AppError(403, 'ADMIN_ONLY', 'Apellyatsiyani faqat Super Admin ko‘rib chiqadi.');
    if (!['OPEN', 'IN_REVIEW', 'APPEALED'].includes(d.status)) throw new AppError(409, 'CLOSED', 'Nizo allaqachon hal qilingan.');
    if (d.openedById === user.id) throw new AppError(403, 'CONFLICT_OF_INTEREST', 'O‘zingiz ochgan nizoni hal qila olmaysiz.');
    // The first decision moves the order out of DISPUTED. An appeal decision only records the final ruling:
    // the order is already closed, so any money correction after a reversed ruling is handled between the parties/provider.
    if (d.status !== 'APPEALED') await this.orders.resolveDisputed(d.order.id, r.outcome === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED', user.id, r.resolution);
    await this.prisma.$transaction([
      this.prisma.dispute.update({ where: { id }, data: { status: d.status === 'APPEALED' ? 'CLOSED' : 'RESOLVED', resolution: r.resolution } }),
      this.prisma.moderationAction.create({ data: { moderatorId: user.id, targetType: 'DISPUTE', targetId: id, action: `RESOLVE_${r.outcome}`, reason: r.resolution } }),
    ]);
    await this.audit.record({ actorId: user.id, action: 'DISPUTE_RESOLVE', entityType: 'dispute', entityId: id, after: { outcome: r.outcome } });
    for (const uid of [d.order.buyerId, d.order.store.ownerId]) await this.notif.notify(uid, { type: 'DISPUTE', title: `Nizo hal qilindi: ${d.order.number}`, body: r.resolution, url: `/disputes/${id}` });
    return { status: d.status === 'APPEALED' ? 'CLOSED' : 'RESOLVED' };
  }

  /** One appeal per dispute, to a Super Admin. The order stays as the moderator decided until the admin changes it. */
  async appeal(user: AuthUser, id: string, text: string) {
    const { d, role } = await this.access(user, id);
    if (role === 'staff') throw new AppError(403, 'FORBIDDEN', 'Apellyatsiyani faqat nizo tomonlari beradi.');
    if (d.status !== 'RESOLVED') throw new AppError(409, 'NOT_APPEALABLE', 'Faqat hal qilingan nizoga apellyatsiya beriladi (bir marta).');
    const list = (d.evidence as unknown as EvidenceEntry[]) ?? [];
    list.push({ by: user.id, role, text: `APELLYATSIYA: ${text}`, at: new Date().toISOString() });
    await this.prisma.dispute.update({ where: { id }, data: { status: 'APPEALED', evidence: list as unknown as Prisma.InputJsonValue } });
    await this.audit.record({ actorId: user.id, action: 'DISPUTE_APPEAL', entityType: 'dispute', entityId: id });
    return { status: 'APPEALED' };
  }
}
