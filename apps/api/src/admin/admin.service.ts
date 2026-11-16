import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, num, paged } from '../common/util';
import { slugify } from '../domain/pricing';
import { RegionsService } from '../catalog/regions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SETTINGS, SettingKey, complaintUpdateSchema, marketSchema, planSchema, regionSchema, reviewDecisionSchema, roleChangeSchema, subscriptionSchema } from './admin.schemas';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notif: NotificationsService, private readonly regions: RegionsService) {}

  // ───────────── users, sellers, moderators ─────────────

  async users(q: PageQuery & { q?: string; role?: string; status?: string }) {
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { status: q.status as 'ACTIVE' } : {}),
      ...(q.role ? { roles: { some: { role: { name: q.role } } } } : {}),
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }, { profile: { fullName: { contains: q.q, mode: 'insensitive' } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true, email: true, phone: true, status: true, emailVerifiedAt: true, createdAt: true, profile: { select: { fullName: true } }, roles: { select: { role: { select: { name: true } } } } } }),
      this.prisma.user.count({ where }),
    ]);
    return paged(rows.map((u) => ({ id: u.id, email: u.email, phone: u.phone, status: u.status, verified: !!u.emailVerifiedAt, fullName: u.profile?.fullName ?? null, roles: u.roles.map((r) => r.role.name), createdAt: u.createdAt })), total, q);
  }

  async userDetail(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, include: { profile: true, roles: { select: { role: { select: { name: true } } } } } });
    if (!u) throw new AppError(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi.');
    const [stores, orders, sessions, complaints] = await Promise.all([
      this.prisma.store.findMany({ where: { ownerId: id, deletedAt: null }, select: { id: true, name: true, status: true } }),
      this.prisma.order.count({ where: { OR: [{ buyerId: id }, { store: { ownerId: id } }] } }),
      this.prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.complaint.count({ where: { targetType: 'USER', targetId: id } }),
    ]);
    return { id: u.id, email: u.email, phone: u.phone, status: u.status, verified: !!u.emailVerifiedAt, fullName: u.profile?.fullName ?? null, roles: u.roles.map((r) => r.role.name), createdAt: u.createdAt, stores, orders, activeSessions: sessions, complaintsAgainst: complaints };
  }

  async setStatus(actor: AuthUser, id: string, status: 'ACTIVE' | 'SUSPENDED', reason: string) {
    if (id === actor.id) throw new AppError(400, 'SELF', 'O‘zingizning holatingizni o‘zgartira olmaysiz.');
    const u = await this.prisma.user.findUnique({ where: { id }, include: { roles: { select: { role: { select: { name: true } } } } } });
    if (!u) throw new AppError(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi.');
    if (u.roles.some((r) => r.role.name === 'SUPER_ADMIN')) throw new AppError(403, 'PROTECTED', 'Super Admin hisobini bloklab bo‘lmaydi.');
    if (u.status === 'PENDING_VERIFICATION' || u.status === 'DELETED') throw new AppError(409, 'INVALID_STATE', 'Bu holatdagi hisobni o‘zgartirib bo‘lmaydi.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { status } }),
      ...(status === 'SUSPENDED' ? [this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
      this.prisma.moderationAction.create({ data: { moderatorId: actor.id, targetType: 'USER', targetId: id, action: status === 'SUSPENDED' ? 'SUSPEND' : 'RESTORE', reason } }),
    ]);
    await this.audit.record({ actorId: actor.id, action: `USER_${status}`, entityType: 'user', entityId: id, before: { status: u.status }, after: { status, reason } });
    return { status };
  }

  /** SUPER_ADMIN is never granted through the API (only the create-admin script), so a stolen admin session cannot mint more admins. */
  async changeRole(actor: AuthUser, id: string, d: z.infer<typeof roleChangeSchema>) {
    if (id === actor.id) throw new AppError(400, 'SELF', 'O‘zingizning rollaringizni o‘zgartira olmaysiz.');
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true, status: true, emailVerifiedAt: true, roles: { select: { role: { select: { name: true } } } } } });
    if (!u) throw new AppError(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi.');
    if (u.roles.some((r) => r.role.name === 'SUPER_ADMIN')) throw new AppError(403, 'PROTECTED', 'Super Admin rollarini o‘zgartirib bo‘lmaydi.');
    const role = await this.prisma.role.findUnique({ where: { name: d.role } });
    if (!role) throw new AppError(500, 'REFERENCE_DATA_MISSING', 'Rol topilmadi.');
    if (d.action === 'ADD') {
      if (!u.emailVerifiedAt || u.status !== 'ACTIVE') throw new AppError(409, 'NOT_ACTIVE', 'Rol faqat faol, emaili tasdiqlangan foydalanuvchiga beriladi.');
      // One account = one role: granting a role REPLACES the previous one (a person never holds two roles at once).
      await this.prisma.$transaction([
        this.prisma.userRole.deleteMany({ where: { userId: id, roleId: { not: role.id } } }),
        this.prisma.userRole.upsert({ where: { userId_roleId: { userId: id, roleId: role.id } }, create: { userId: id, roleId: role.id }, update: {} }),
      ]);
    } else {
      if (u.roles.length <= 1) throw new AppError(409, 'LAST_ROLE', 'Foydalanuvchining roli bo‘lishi shart. Rolni almashtirish uchun yangi rol bering.');
      await this.prisma.userRole.deleteMany({ where: { userId: id, roleId: role.id } });
    }
    // active tokens carry the old roles: end the sessions so the change applies at the next sign-in
    await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ actorId: actor.id, action: `ROLE_${d.action}`, entityType: 'user', entityId: id, after: { role: d.role } });
    await this.notif.notify(id, { type: 'ROLE', title: 'Rollaringiz o‘zgardi', body: 'Yangi huquqlar uchun qayta kiring.', url: '/login' });
    return { ok: true };
  }

  async revokeSessions(actor: AuthUser, id: string) {
    const r = await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ actorId: actor.id, action: 'USER_SESSIONS_REVOKED', entityType: 'user', entityId: id, after: { count: r.count } });
    return { revoked: r.count };
  }

  // ───────────── complaints and reviews ─────────────

  async complaints(q: PageQuery & { status?: string; targetType?: string }) {
    const where: Prisma.ComplaintWhereInput = { ...(q.status ? { status: q.status as 'OPEN' } : {}), ...(q.targetType ? { targetType: q.targetType } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.complaint.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { filedBy: { select: { email: true } } } }),
      this.prisma.complaint.count({ where }),
    ]);
    return paged(rows.map((c) => ({ id: c.id, targetType: c.targetType, targetId: c.targetId, reason: c.reason, details: c.details, status: c.status, filedBy: c.filedBy.email, createdAt: c.createdAt })), total, q);
  }

  async updateComplaint(actor: AuthUser, id: string, d: z.infer<typeof complaintUpdateSchema>) {
    const c = await this.prisma.complaint.findUnique({ where: { id } });
    if (!c) throw new AppError(404, 'NOT_FOUND', 'Shikoyat topilmadi.');
    if (c.filedById === actor.id) throw new AppError(403, 'CONFLICT_OF_INTEREST', 'O‘z shikoyatingizni ko‘ra olmaysiz.');
    await this.prisma.$transaction([
      this.prisma.complaint.update({ where: { id }, data: { status: d.status } }),
      this.prisma.moderationAction.create({ data: { moderatorId: actor.id, targetType: 'COMPLAINT', targetId: id, action: d.status, reason: d.note } }),
    ]);
    await this.audit.record({ actorId: actor.id, action: `COMPLAINT_${d.status}`, entityType: 'complaint', entityId: id, after: { note: d.note } });
    await this.notif.notify(c.filedById, { type: 'COMPLAINT', title: 'Shikoyatingiz ko‘rib chiqildi', body: d.note, url: '/complaints' });
    return { status: d.status };
  }

  async reviewQueue(q: PageQuery, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const where = { status };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { store: { select: { name: true } }, author: { select: { email: true } } } }),
      this.prisma.review.count({ where }),
    ]);
    return paged(rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, store: r.store.name, author: r.author.email, status: r.status, createdAt: r.createdAt })), total, q);
  }
  async decideReview(actor: AuthUser, id: string, d: z.infer<typeof reviewDecisionSchema>) {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw new AppError(404, 'NOT_FOUND', 'Sharh topilmadi.');
    const status = d.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await this.prisma.$transaction([
      this.prisma.review.update({ where: { id }, data: { status } }),
      this.prisma.moderationAction.create({ data: { moderatorId: actor.id, targetType: 'REVIEW', targetId: id, action: d.action, reason: d.reason } }),
    ]);
    return { status };
  }

  // ───────────── plans and subscriptions ─────────────

  plans(includeInactive = false) {
    return this.prisma.plan.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { priceUzs: 'asc' } }).then((r) => r.map((p) => ({ ...p, priceUzs: num(p.priceUzs) })));
  }
  async upsertPlan(actor: AuthUser, d: z.infer<typeof planSchema>) {
    const p = await this.prisma.plan.upsert({ where: { code: d.code }, create: { ...d }, update: { name: d.name, priceUzs: d.priceUzs, maxProducts: d.maxProducts, features: d.features, active: d.active } });
    await this.audit.record({ actorId: actor.id, action: 'PLAN_UPSERT', entityType: 'plan', entityId: p.id, after: { code: p.code, priceUzs: d.priceUzs } });
    return { ...p, priceUzs: num(p.priceUzs) };
  }
  /** Activated by an administrator after the seller paid outside the platform (no payment provider is connected). */
  async grantSubscription(actor: AuthUser, d: z.infer<typeof subscriptionSchema>) {
    const [plan, store] = await Promise.all([this.prisma.plan.findFirst({ where: { code: d.planCode, active: true } }), this.prisma.store.findFirst({ where: { id: d.storeId, deletedAt: null } })]);
    if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Tarif topilmadi.');
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Do‘kon topilmadi.');
    const endsAt = new Date(Date.now() + d.months * 30 * 86_400_000);
    await this.prisma.$transaction([
      this.prisma.subscription.updateMany({ where: { storeId: d.storeId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }),
      this.prisma.subscription.create({ data: { storeId: d.storeId, plan: plan.code, endsAt } }),
    ]);
    await this.audit.record({ actorId: actor.id, action: 'SUBSCRIPTION_GRANT', entityType: 'store', entityId: d.storeId, after: { plan: plan.code, months: d.months } });
    await this.notif.notify(store.ownerId, { type: 'PLAN', title: `Tarif faollashtirildi: ${plan.name}`, body: `${d.months} oy`, url: '/seller' });
    return { plan: plan.code, endsAt };
  }
  async storePlan(storeId: string) {
    const sub = await this.prisma.subscription.findFirst({ where: { storeId, status: 'ACTIVE', OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { startedAt: 'desc' } });
    const plan = sub ? await this.prisma.plan.findUnique({ where: { code: sub.plan } }) : null;
    const fallback = await this.setting('plans.freeMaxPrices');
    return { plan: plan?.code ?? 'free', maxProducts: plan?.maxProducts ?? (fallback as number), endsAt: sub?.endsAt ?? null };
  }

  // ───────────── statistics, audit, settings ─────────────

  async stats() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [users, byRole, stores, products, prices, orders, revenue, contracts, openDisputes, openComplaints, queues] = await Promise.all([
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.userRole.groupBy({ by: ['roleId'], _count: true }),
      this.prisma.store.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
      this.prisma.product.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
      this.prisma.priceRecord.count({ where: { deletedAt: null, moderationStatus: 'APPROVED' } }),
      this.prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: true }),
      this.prisma.order.aggregate({ where: { status: 'COMPLETED', updatedAt: { gte: since } }, _sum: { totalAmount: true }, _count: true }),
      this.prisma.contract.groupBy({ by: ['status'], _count: true }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'IN_REVIEW', 'APPEALED'] } } }),
      this.prisma.complaint.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
      Promise.all([
        this.prisma.product.count({ where: { status: 'PENDING', deletedAt: null } }),
        this.prisma.priceRecord.count({ where: { moderationStatus: 'PENDING', deletedAt: null } }),
        this.prisma.store.count({ where: { status: 'PENDING', deletedAt: null } }),
        this.prisma.review.count({ where: { status: 'PENDING' } }),
        this.prisma.contract.count({ where: { status: 'PENDING_REVIEW' } }),
      ]),
    ]);
    const roles = await this.prisma.role.findMany({ select: { id: true, name: true } });
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    return {
      users: { active: users, byRole: Object.fromEntries(byRole.map((g) => [roleName.get(g.roleId) ?? g.roleId, g._count])) },
      stores: Object.fromEntries(stores.map((g) => [g.status, g._count])),
      products: Object.fromEntries(products.map((g) => [g.status, g._count])),
      livePrices: prices,
      orders30d: Object.fromEntries(orders.map((g) => [g.status, g._count])),
      completed30d: revenue._count, volume30d: num(revenue._sum.totalAmount),
      contracts: Object.fromEntries(contracts.map((g) => [g.status, g._count])),
      openDisputes, openComplaints,
      queues: { products: queues[0], prices: queues[1], stores: queues[2], reviews: queues[3], contracts: queues[4] },
    };
  }

  async moderatorStats(userId: string) {
    const [queues, mine, last7] = await Promise.all([
      this.stats().then((s) => ({ ...s.queues, disputes: s.openDisputes, complaints: s.openComplaints })),
      this.prisma.moderationAction.count({ where: { moderatorId: userId } }),
      this.prisma.moderationAction.count({ where: { moderatorId: userId, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    ]);
    return { queues, myActionsTotal: mine, myActions7d: last7 };
  }

  async auditLog(q: PageQuery & { actorId?: string; action?: string; entityType?: string; from?: Date; to?: Date }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.actorId ? { actorId: q.actorId } : {}), ...(q.action ? { action: { contains: q.action, mode: 'insensitive' } } : {}), ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { actor: { select: { email: true } } } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paged(rows.map((r) => ({ id: String(r.id), at: r.createdAt, actor: r.actor?.email ?? null, action: r.action, entityType: r.entityType, entityId: r.entityId, before: r.before, after: r.after, ip: r.ip })), total, q);
  }

  async auditCsv(q: { actorId?: string; action?: string; entityType?: string; from?: Date; to?: Date }) {
    const page = await this.auditLog({ ...q, page: 1, pageSize: 100 } as PageQuery);
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`; // neutralises spreadsheet formula injection
    const lines = ['time,actor,action,entityType,entityId,ip', ...page.items.map((r) => [r.at.toISOString(), r.actor, r.action, r.entityType, r.entityId, r.ip].map(esc).join(','))];
    return lines.join('\n');
  }

  async setting(key: SettingKey): Promise<unknown> {
    const s = await this.prisma.systemSetting.findUnique({ where: { key } });
    return s ? s.value : SETTINGS[key].fallback;
  }
  async settings() {
    const rows = await this.prisma.systemSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return (Object.keys(SETTINGS) as SettingKey[]).map((key) => ({ key, description: SETTINGS[key].description, value: map.has(key) ? map.get(key) : SETTINGS[key].fallback, isDefault: !map.has(key) }));
  }
  async putSetting(actor: AuthUser, key: SettingKey, raw: unknown) {
    const parsed = SETTINGS[key].schema.safeParse(raw);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Qiymat noto‘g‘ri.', { fields: parsed.error.issues.map((i) => ({ path: 'value', message: i.message })) });
    const before = await this.setting(key);
    await this.prisma.systemSetting.upsert({ where: { key }, create: { key, value: parsed.data as Prisma.InputJsonValue, updatedById: actor.id }, update: { value: parsed.data as Prisma.InputJsonValue, updatedById: actor.id } });
    await this.audit.record({ actorId: actor.id, action: 'SETTING_CHANGE', entityType: 'setting', entityId: key, before: { value: before as Prisma.InputJsonValue }, after: { value: parsed.data as Prisma.InputJsonValue } });
    return { key, value: parsed.data };
  }

  // ───────────── contract templates, regions, markets ─────────────

  templates() {
    return this.prisma.contractTemplate.findMany({ orderBy: [{ type: 'asc' }, { version: 'desc' }] });
  }
  async newTemplateVersion(actor: AuthUser, d: { type: 'SALE'; name: string; clauses: Array<{ title: string; text: string }> }) {
    const last = await this.prisma.contractTemplate.findFirst({ where: { type: d.type }, orderBy: { version: 'desc' } });
    const version = (last?.version ?? 0) + 1;
    const [, created] = await this.prisma.$transaction([
      this.prisma.contractTemplate.updateMany({ where: { type: d.type, active: true }, data: { active: false } }),
      this.prisma.contractTemplate.create({ data: { type: d.type, name: d.name, version, clauses: d.clauses as Prisma.InputJsonValue, createdById: actor.id } }),
    ]);
    await this.audit.record({ actorId: actor.id, action: 'TEMPLATE_VERSION', entityType: 'contract_template', entityId: created.id, after: { type: d.type, version } });
    return created;
  }

  async createRegion(actor: AuthUser, d: z.infer<typeof regionSchema>) {
    if (d.parentId && !(await this.prisma.region.findUnique({ where: { id: d.parentId } }))) throw new AppError(400, 'PARENT_NOT_FOUND', 'Ota hudud topilmadi.');
    const r = await this.prisma.region.create({ data: { name: d.name, type: d.type, parentId: d.parentId ?? null, lat: d.lat, lng: d.lng, slug: `${slugify(d.name)}-${Math.random().toString(16).slice(2, 6)}` } });
    this.regions.invalidate();
    await this.audit.record({ actorId: actor.id, action: 'REGION_CREATE', entityType: 'region', entityId: r.id, after: { name: r.name } });
    return r;
  }
  async createMarket(actor: AuthUser, d: z.infer<typeof marketSchema>) {
    if (!(await this.prisma.region.findUnique({ where: { id: d.regionId } }))) throw new AppError(400, 'REGION_NOT_FOUND', 'Hudud topilmadi.');
    const m = await this.prisma.market.create({ data: d });
    await this.audit.record({ actorId: actor.id, action: 'MARKET_CREATE', entityType: 'market', entityId: m.id, after: { name: m.name } });
    return m;
  }
  async updateMarket(actor: AuthUser, id: string, d: Partial<z.infer<typeof marketSchema>>) {
    const m = await this.prisma.market.update({ where: { id }, data: d }).catch(() => null);
    if (!m) throw new AppError(404, 'NOT_FOUND', 'Bozor topilmadi.');
    await this.audit.record({ actorId: actor.id, action: 'MARKET_UPDATE', entityType: 'market', entityId: id });
    return m;
  }
}
