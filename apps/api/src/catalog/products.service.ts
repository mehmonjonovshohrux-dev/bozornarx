import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, isAdmin, isStaff, paged } from '../common/util';
import { slugify } from '../domain/pricing';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { z } from 'zod';
import { categorySchema, decisionSchema, imageSchema, productCreateSchema, productUpdateSchema, variantSchema } from './catalog.schemas';

type Create = z.infer<typeof productCreateSchema>;
type Update = z.infer<typeof productUpdateSchema>;

const suffix = () => randomBytes(3).toString('hex');

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notif: NotificationsService) {}

  private async own(user: AuthUser, id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    if (!isStaff(user.roles) && p.createdById !== user.id) throw new AppError(403, 'FORBIDDEN', 'Bu mahsulot sizniki emas.');
    return p;
  }

  async create(user: AuthUser, d: Create) {
    const [cat, unit] = await Promise.all([this.prisma.category.findUnique({ where: { id: d.categoryId } }), this.prisma.unit.findUnique({ where: { id: d.unitId } })]);
    if (!cat) throw new AppError(400, 'CATEGORY_NOT_FOUND', 'Kategoriya topilmadi.');
    if (!unit) throw new AppError(400, 'UNIT_NOT_FOUND', 'O‘lchov birligi topilmadi.');
    const p = await this.prisma.product.create({
      data: { ...d, slug: `${slugify(d.name)}-${suffix()}`, createdById: user.id, status: isStaff(user.roles) ? 'APPROVED' : 'PENDING' },
    });
    await this.audit.record({ actorId: user.id, action: 'PRODUCT_CREATE', entityType: 'product', entityId: p.id, after: { name: p.name, status: p.status } });
    return p;
  }

  async update(user: AuthUser, id: string, d: Update) {
    const before = await this.own(user, id);
    if (d.categoryId && !(await this.prisma.category.findUnique({ where: { id: d.categoryId } }))) throw new AppError(400, 'CATEGORY_NOT_FOUND', 'Kategoriya topilmadi.');
    if (d.unitId && !(await this.prisma.unit.findUnique({ where: { id: d.unitId } }))) throw new AppError(400, 'UNIT_NOT_FOUND', 'O‘lchov birligi topilmadi.');
    // A seller's edit of a live product goes back to review so nobody can swap an approved item for something else.
    const status = isStaff(user.roles) ? before.status : 'PENDING';
    const p = await this.prisma.product.update({ where: { id }, data: { ...d, status } });
    await this.audit.record({ actorId: user.id, action: 'PRODUCT_UPDATE', entityType: 'product', entityId: id, before: { name: before.name, status: before.status }, after: { name: p.name, status: p.status } });
    return p;
  }

  async archive(user: AuthUser, id: string) {
    await this.own(user, id);
    await this.prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await this.audit.record({ actorId: user.id, action: 'PRODUCT_ARCHIVE', entityType: 'product', entityId: id });
    return { archived: true };
  }

  /** Hard rule: only Super Admin removes a product, and it is a soft delete (prices and orders keep their references). */
  async remove(user: AuthUser, id: string) {
    if (!isAdmin(user.roles)) throw new AppError(403, 'FORBIDDEN', 'Mahsulotni faqat Super Admin o‘chira oladi.');
    const p = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    await this.audit.record({ actorId: user.id, action: 'PRODUCT_DELETE', entityType: 'product', entityId: id, before: { name: p.name } });
    return { deleted: true };
  }

  async mine(user: AuthUser, q: PageQuery) {
    const where = { createdById: user.id, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { category: { select: { name: true } }, unit: { select: { code: true } }, images: { take: 1, orderBy: { sortOrder: 'asc' } }, _count: { select: { priceRecords: true } } } }),
      this.prisma.product.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async addVariant(user: AuthUser, productId: string, d: z.infer<typeof variantSchema>) {
    await this.own(user, productId);
    if (!(await this.prisma.unit.findUnique({ where: { id: d.unitId } }))) throw new AppError(400, 'UNIT_NOT_FOUND', 'O‘lchov birligi topilmadi.');
    try {
      return await this.prisma.productVariant.create({ data: { ...d, productId } });
    } catch {
      throw new AppError(409, 'VARIANT_EXISTS', 'Bu nomdagi variant allaqachon bor.');
    }
  }

  async removeVariant(user: AuthUser, variantId: string) {
    const v = await this.prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId: true, _count: { select: { priceRecords: true, orderItems: true } } } });
    if (!v) throw new AppError(404, 'NOT_FOUND', 'Variant topilmadi.');
    await this.own(user, v.productId);
    if (v._count.priceRecords > 0 || v._count.orderItems > 0) throw new AppError(409, 'VARIANT_IN_USE', 'Bu variantda narx yoki buyurtma bor, o‘chirib bo‘lmaydi.');
    await this.prisma.productVariant.delete({ where: { id: variantId } });
    return { deleted: true };
  }

  async addImage(user: AuthUser, productId: string, d: z.infer<typeof imageSchema>) {
    await this.own(user, productId);
    const file = await this.prisma.fileObject.findUnique({ where: { id: d.fileId }, select: { ownerId: true, kind: true } });
    if (!file || file.ownerId !== user.id || file.kind !== 'PRODUCT_IMAGE') throw new AppError(400, 'FILE_INVALID', 'Rasm topilmadi yoki sizga tegishli emas.');
    const count = await this.prisma.productImage.count({ where: { productId } });
    if (count >= 8) throw new AppError(400, 'TOO_MANY_IMAGES', 'Bitta mahsulotga 8 tagacha rasm qo‘shish mumkin.');
    return this.prisma.productImage.create({ data: { productId, fileKey: d.fileId, sortOrder: count } });
  }

  async removeImage(user: AuthUser, imageId: string) {
    const img = await this.prisma.productImage.findUnique({ where: { id: imageId }, select: { productId: true } });
    if (!img) throw new AppError(404, 'NOT_FOUND', 'Rasm topilmadi.');
    await this.own(user, img.productId);
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { deleted: true };
  }

  // ───────────── moderation ─────────────

  async queue(q: PageQuery, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const where = { status, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { category: { select: { name: true } }, unit: { select: { code: true } }, images: { take: 1 } } }),
      this.prisma.product.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async decide(user: AuthUser, id: string, d: z.infer<typeof decisionSchema>) {
    const p = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    const status = d.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { status } }),
      this.prisma.moderationAction.create({ data: { moderatorId: user.id, targetType: 'PRODUCT', targetId: id, action: d.action, reason: d.reason } }),
    ]);
    await this.audit.record({ actorId: user.id, action: `PRODUCT_${d.action}`, entityType: 'product', entityId: id, after: { reason: d.reason } });
    if (p.createdById) {
      await this.notif.notify(p.createdById, { type: 'MODERATION', title: `Mahsulot ${status === 'APPROVED' ? 'tasdiqlandi' : 'rad etildi'}: ${p.name}`, body: d.reason, url: '/seller/products' });
    }
    return { status };
  }

  // ───────────── categories (staff) ─────────────

  async createCategory(user: AuthUser, d: z.infer<typeof categorySchema>) {
    if (d.parentId && !(await this.prisma.category.findUnique({ where: { id: d.parentId } }))) throw new AppError(400, 'PARENT_NOT_FOUND', 'Ota kategoriya topilmadi.');
    const c = await this.prisma.category.create({ data: { name: d.name, parentId: d.parentId ?? null, sortOrder: d.sortOrder ?? 0, slug: `${slugify(d.name)}-${suffix()}` } });
    await this.audit.record({ actorId: user.id, action: 'CATEGORY_CREATE', entityType: 'category', entityId: c.id, after: { name: c.name } });
    return c;
  }

  async updateCategory(user: AuthUser, id: string, d: z.infer<typeof categorySchema>) {
    if (d.parentId === id) throw new AppError(400, 'INVALID_PARENT', 'Kategoriya o‘zining otasi bo‘la olmaydi.');
    if (d.parentId) {
      // no cycles: the new parent must not be one of this category's descendants
      let cur: string | null = d.parentId;
      while (cur) {
        if (cur === id) throw new AppError(400, 'INVALID_PARENT', 'Kategoriyani o‘zining ichiga ko‘chirib bo‘lmaydi.');
        const parent: { parentId: string | null } | null = await this.prisma.category.findUnique({ where: { id: cur }, select: { parentId: true } });
        cur = parent?.parentId ?? null;
      }
    }
    const c = await this.prisma.category.update({ where: { id }, data: { name: d.name, parentId: d.parentId ?? null, ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}) } });
    await this.audit.record({ actorId: user.id, action: 'CATEGORY_UPDATE', entityType: 'category', entityId: id, after: { name: c.name } });
    return c;
  }

  async deleteCategory(user: AuthUser, id: string) {
    const used = await this.prisma.category.findUnique({ where: { id }, select: { _count: { select: { children: true, products: true } } } });
    if (!used) throw new AppError(404, 'NOT_FOUND', 'Kategoriya topilmadi.');
    if (used._count.children > 0 || used._count.products > 0) throw new AppError(409, 'CATEGORY_IN_USE', 'Kategoriyada subkategoriya yoki mahsulotlar bor.');
    await this.prisma.category.delete({ where: { id } });
    await this.audit.record({ actorId: user.id, action: 'CATEGORY_DELETE', entityType: 'category', entityId: id });
    return { deleted: true };
  }
}
