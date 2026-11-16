import { Body, Controller, Delete, Get, Module, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { ZodPipe } from '../common/http';
import { Me, PageQuery, Secured, idParam, num, pageSchema, paged, uuidSchema } from '../common/util';
import { baseUnitCode } from '../domain/units';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

const alertSchema = z.object({
  productId: uuidSchema,
  regionId: uuidSchema.optional(),
  direction: z.enum(['BELOW', 'ABOVE']),
  targetPrice: z.number().positive().max(10_000_000_000),
  unitCode: z.string().trim().min(1).max(10),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'PUSH'])).min(1).default(['IN_APP', 'PUSH']),
});
const complaintSchema = z.object({
  targetType: z.enum(['PRICE', 'PRODUCT', 'STORE', 'USER', 'CONTRACT', 'MESSAGE', 'REVIEW']),
  targetId: uuidSchema,
  reason: z.string().trim().min(5).max(300),
  details: z.string().trim().max(2000).optional(),
});
const productParam = z.object({ productId: uuidSchema });

@Injectable()
export class BuyerService {
  constructor(private readonly prisma: PrismaService) {}

  async favorites(user: AuthUser, q: PageQuery) {
    const where = { userId: user.id };
    const [rows, total] = await Promise.all([
      this.prisma.favorite.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { product: { select: { id: true, name: true, slug: true, unit: { select: { code: true } }, images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { fileKey: true } } } } } }),
      this.prisma.favorite.count({ where }),
    ]);
    return paged(rows.map((f) => ({ productId: f.productId, name: f.product.name, slug: f.product.slug, unit: f.product.unit.code, imageId: f.product.images[0]?.fileKey ?? null, createdAt: f.createdAt })), total, q);
  }
  async addFavorite(user: AuthUser, productId: string) {
    if (!(await this.prisma.product.findFirst({ where: { id: productId, status: 'APPROVED', deletedAt: null }, select: { id: true } }))) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    await this.prisma.favorite.upsert({ where: { userId_productId: { userId: user.id, productId } }, create: { userId: user.id, productId }, update: {} });
    return { favorite: true };
  }
  async removeFavorite(user: AuthUser, productId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId: user.id, productId } });
    return { favorite: false };
  }
  async isFavorite(user: AuthUser, productId: string) {
    return { favorite: !!(await this.prisma.favorite.findUnique({ where: { userId_productId: { userId: user.id, productId } } })) };
  }

  async alerts(user: AuthUser) {
    const rows = await this.prisma.priceAlert.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, include: { product: { select: { name: true, slug: true } } } });
    return rows.map((a) => ({ ...a, targetPrice: num(a.targetPrice) }));
  }
  async createAlert(user: AuthUser, d: z.infer<typeof alertSchema>) {
    const p = await this.prisma.product.findFirst({ where: { id: d.productId, status: 'APPROVED', deletedAt: null }, select: { unit: { select: { code: true } } } });
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    if (baseUnitCode(d.unitCode) === null || baseUnitCode(d.unitCode) !== baseUnitCode(p.unit.code)) throw new AppError(400, 'UNIT_MISMATCH', `Ogohlantirish birligi "${p.unit.code}" bilan bir o‘lchamda bo‘lishi kerak (masalan kg yoki g).`);
    if ((await this.prisma.priceAlert.count({ where: { userId: user.id, active: true } })) >= 30) throw new AppError(400, 'TOO_MANY_ALERTS', 'Faol ogohlantirishlar soni 30 tadan oshmasin.');
    return this.prisma.priceAlert.create({ data: { userId: user.id, productId: d.productId, regionId: d.regionId ?? null, direction: d.direction, targetPrice: d.targetPrice, unitCode: d.unitCode, channels: d.channels } });
  }
  async toggleAlert(user: AuthUser, id: string, active: boolean) {
    const r = await this.prisma.priceAlert.updateMany({ where: { id, userId: user.id }, data: { active } });
    if (r.count === 0) throw new AppError(404, 'NOT_FOUND', 'Ogohlantirish topilmadi.');
    return { active };
  }
  async deleteAlert(user: AuthUser, id: string) {
    await this.prisma.priceAlert.deleteMany({ where: { id, userId: user.id } });
    return { deleted: true };
  }

  async complaint(user: AuthUser, d: z.infer<typeof complaintSchema>) {
    if ((await this.prisma.complaint.count({ where: { filedById: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } })) >= 20) throw new AppError(429, 'TOO_MANY_COMPLAINTS', 'Bir kunda 20 tadan ortiq shikoyat yuborib bo‘lmaydi.');
    return this.prisma.complaint.create({ data: { filedById: user.id, ...d, details: d.details ?? null } });
  }
  myComplaints(user: AuthUser) {
    return this.prisma.complaint.findMany({ where: { filedById: user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  /** Buyer dashboard numbers. */
  async stats(user: AuthUser) {
    const [orders, favorites, alerts, offers, unread] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { buyerId: user.id }, _count: true }),
      this.prisma.favorite.count({ where: { userId: user.id } }),
      this.prisma.priceAlert.count({ where: { userId: user.id, active: true } }),
      this.prisma.offer.count({ where: { buyerId: user.id, status: { in: ['PENDING', 'COUNTERED'] } } }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { orders: Object.fromEntries(orders.map((g) => [g.status, g._count])), favorites, activeAlerts: alerts, openOffers: offers, unreadNotifications: unread };
  }

  async storeReviews(storeId: string, q: PageQuery) {
    const where = { storeId, status: 'APPROVED' as const };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { author: { select: { profile: { select: { fullName: true } } } } } }),
      this.prisma.review.count({ where }),
    ]);
    return paged(rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, author: (r.author.profile?.fullName ?? 'Foydalanuvchi').split(' ')[0], createdAt: r.createdAt })), total, q);
  }
}

@ApiTags('buyer')
@Controller()
export class BuyerController {
  constructor(private readonly svc: BuyerService) {}
  @Get('favorites') @Secured('favorites.manage') favs(@Me() u: AuthUser, @Query(new ZodPipe(pageSchema)) q: PageQuery) { return this.svc.favorites(u, q); }
  @Get('favorites/:productId') @Secured('favorites.manage') isFav(@Me() u: AuthUser, @Param(new ZodPipe(productParam)) p: { productId: string }) { return this.svc.isFavorite(u, p.productId); }
  @Post('favorites/:productId') @Secured('favorites.manage') addFav(@Me() u: AuthUser, @Param(new ZodPipe(productParam)) p: { productId: string }) { return this.svc.addFavorite(u, p.productId); }
  @Delete('favorites/:productId') @Secured('favorites.manage') delFav(@Me() u: AuthUser, @Param(new ZodPipe(productParam)) p: { productId: string }) { return this.svc.removeFavorite(u, p.productId); }

  @Get('alerts') @Secured('alerts.manage') alerts(@Me() u: AuthUser) { return this.svc.alerts(u); }
  @Post('alerts') @Secured('alerts.manage') createAlert(@Me() u: AuthUser, @Body(new ZodPipe(alertSchema)) b: z.infer<typeof alertSchema>) { return this.svc.createAlert(u, b); }
  @Post('alerts/:id/toggle') @Secured('alerts.manage') toggle(@Me() u: AuthUser, @Param(new ZodPipe(idParam)) p: { id: string }, @Body(new ZodPipe(z.object({ active: z.boolean() }))) b: { active: boolean }) { return this.svc.toggleAlert(u, p.id, b.active); }
  @Delete('alerts/:id') @Secured('alerts.manage') delAlert(@Me() u: AuthUser, @Param(new ZodPipe(idParam)) p: { id: string }) { return this.svc.deleteAlert(u, p.id); }

  @Post('complaints') @Secured('complaints.create') complaint(@Me() u: AuthUser, @Body(new ZodPipe(complaintSchema)) b: z.infer<typeof complaintSchema>) { return this.svc.complaint(u, b); }
  @Get('complaints/mine') @Secured('complaints.create') mine(@Me() u: AuthUser) { return this.svc.myComplaints(u); }
  @Get('me/stats') @Secured() stats(@Me() u: AuthUser) { return this.svc.stats(u); }
  @Get('stores/:id/reviews') reviews(@Param(new ZodPipe(idParam)) p: { id: string }, @Query(new ZodPipe(pageSchema)) q: PageQuery) { return this.svc.storeReviews(p.id, q); }
}

@Module({ imports: [AuthModule], controllers: [BuyerController], providers: [BuyerService] })
export class BuyerModule {}
