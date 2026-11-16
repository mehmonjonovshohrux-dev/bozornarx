import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, paged } from '../common/util';
import { EventsHub } from '../notifications/events.hub';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export const startSchema = z.object({ storeId: z.string().uuid() });
export const sendSchema = z.object({ body: z.string().trim().min(1).max(2000).optional(), fileId: z.string().uuid().optional() }).refine((o) => o.body || o.fileId, 'Xabar matni yoki fayl kerak');
export const historyQuery = z.object({ before: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.date().optional()), limit: z.preprocess((v) => (v === undefined || v === '' ? 30 : Number(v)), z.number().int().min(1).max(100)) });
export const convListQuery = z.object({ as: z.enum(['buyer', 'seller']).default('buyer'), page: z.preprocess((v) => (v === undefined ? 1 : Number(v)), z.number().int().min(1)), pageSize: z.preprocess((v) => (v === undefined ? 30 : Number(v)), z.number().int().min(1).max(100)) });

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService, private readonly hub: EventsHub, private readonly notif: NotificationsService) {}

  private async access(user: AuthUser, id: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id }, include: { store: { select: { id: true, name: true, ownerId: true } }, buyer: { select: { id: true, profile: { select: { fullName: true } } } } } });
    if (!c) throw new AppError(404, 'NOT_FOUND', 'Suhbat topilmadi.');
    const isBuyer = c.buyerId === user.id;
    const isSeller = c.store.ownerId === user.id;
    if (!isBuyer && !isSeller) throw new AppError(404, 'NOT_FOUND', 'Suhbat topilmadi.');
    return { c, isBuyer, otherId: isBuyer ? c.store.ownerId : c.buyerId };
  }

  async start(user: AuthUser, storeId: string) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, deletedAt: null, status: { in: ['VERIFIED', 'PENDING'] } }, select: { id: true, ownerId: true } });
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Do‘kon topilmadi.');
    if (store.ownerId === user.id) throw new AppError(400, 'OWN_STORE', 'O‘zingiz bilan suhbat ocha olmaysiz.');
    const c = await this.prisma.conversation.upsert({ where: { buyerId_storeId: { buyerId: user.id, storeId } }, create: { buyerId: user.id, storeId }, update: {}, select: { id: true } });
    return c;
  }

  async list(user: AuthUser, q: { as: 'buyer' | 'seller'; page: number; pageSize: number }) {
    const where = q.as === 'buyer' ? { buyerId: user.id } : { store: { ownerId: user.id } };
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({ where, orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { store: { select: { id: true, name: true } }, buyer: { select: { profile: { select: { fullName: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
      this.prisma.conversation.count({ where }),
    ]);
    const unread = await this.prisma.message.groupBy({ by: ['conversationId'], where: { conversationId: { in: rows.map((r) => r.id) }, readAt: null, senderId: { not: user.id } }, _count: true });
    const uMap = new Map(unread.map((u) => [u.conversationId, u._count]));
    return paged(rows.map((c) => ({ id: c.id, store: c.store, buyerName: c.buyer.profile?.fullName ?? null, blocked: !!c.blockedById, lastMessageAt: c.lastMessageAt, unread: uMap.get(c.id) ?? 0, last: c.messages[0] ? { body: c.messages[0].body, hasFile: !!c.messages[0].attachmentKey, at: c.messages[0].createdAt, mine: c.messages[0].senderId === user.id } : null })), total, q as PageQuery);
  }

  async history(user: AuthUser, id: string, q: { before?: Date; limit: number }) {
    const { c } = await this.access(user, id);
    const rows = await this.prisma.message.findMany({ where: { conversationId: id, ...(q.before ? { createdAt: { lt: q.before } } : {}) }, orderBy: { createdAt: 'desc' }, take: q.limit });
    return { blocked: !!c.blockedById, blockedByMe: c.blockedById === user.id, store: { id: c.store.id, name: c.store.name }, buyerName: c.buyer.profile?.fullName ?? null, messages: rows.reverse().map((m) => ({ id: m.id, mine: m.senderId === user.id, body: m.body, fileId: m.attachmentKey, fileType: m.attachmentType, readAt: m.readAt, createdAt: m.createdAt })) };
  }

  async send(user: AuthUser, id: string, d: z.infer<typeof sendSchema>) {
    const { c, otherId } = await this.access(user, id);
    if (c.blockedById) throw new AppError(403, 'BLOCKED', 'Bu suhbat bloklangan.');
    let fileType: string | null = null;
    if (d.fileId) {
      const f = await this.prisma.fileObject.findUnique({ where: { id: d.fileId }, select: { ownerId: true, kind: true, mime: true } });
      if (!f || f.ownerId !== user.id || f.kind !== 'CHAT') throw new AppError(400, 'FILE_INVALID', 'Fayl topilmadi yoki sizga tegishli emas.');
      fileType = f.mime;
    }
    const m = await this.prisma.message.create({ data: { conversationId: id, senderId: user.id, body: d.body ?? null, attachmentKey: d.fileId ?? null, attachmentType: fileType } });
    await this.prisma.conversation.update({ where: { id }, data: { lastMessageAt: m.createdAt } });
    const payload = { conversationId: id, id: m.id, body: m.body, fileId: m.attachmentKey, fileType: m.attachmentType, createdAt: m.createdAt, senderId: user.id };
    if (this.hub.online(otherId)) this.hub.emit(otherId, 'message', payload);
    else await this.notif.notify(otherId, { type: 'CHAT_MESSAGE', title: 'Yangi xabar', body: m.body ? m.body.slice(0, 120) : 'Fayl yuborildi', url: `/chat/${id}` });
    return { id: m.id, mine: true, body: m.body, fileId: m.attachmentKey, fileType: m.attachmentType, readAt: null, createdAt: m.createdAt };
  }

  async markRead(user: AuthUser, id: string) {
    const { otherId } = await this.access(user, id);
    const r = await this.prisma.message.updateMany({ where: { conversationId: id, senderId: { not: user.id }, readAt: null }, data: { readAt: new Date() } });
    if (r.count > 0) this.hub.emit(otherId, 'read', { conversationId: id });
    return { read: r.count };
  }

  async block(user: AuthUser, id: string, blocked: boolean) {
    const { c } = await this.access(user, id);
    if (blocked && c.blockedById) throw new AppError(409, 'ALREADY_BLOCKED', 'Suhbat allaqachon bloklangan.');
    if (!blocked && c.blockedById !== user.id) throw new AppError(403, 'FORBIDDEN', 'Blokni faqat bloklagan tomon ochadi.');
    await this.prisma.conversation.update({ where: { id }, data: { blockedById: blocked ? user.id : null } });
    return { blocked };
  }

  async unreadTotal(user: AuthUser): Promise<number> {
    return this.prisma.message.count({ where: { readAt: null, senderId: { not: user.id }, conversation: { OR: [{ buyerId: user.id }, { store: { ownerId: user.id } }] } } });
  }
}
