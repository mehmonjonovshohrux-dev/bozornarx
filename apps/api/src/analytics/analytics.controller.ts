import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService, normalize } from '../catalog/catalog.service';
import { RegionsService } from '../catalog/regions.service';
import { ZodPipe } from '../common/http';
import { idParam, optStr, uuidSchema } from '../common/util';
import { projectLinear, movingAverage } from '../domain/forecast';
import { priceStats } from '../domain/pricing';
import { baseUnitCode } from '../domain/units';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

const mapQuery = z.object({ regionId: uuidSchema.optional().or(z.literal('').transform(() => undefined)), productId: uuidSchema.optional().or(z.literal('').transform(() => undefined)), q: optStr });
const forecastQuery = z.object({ regionId: uuidSchema.optional().or(z.literal('').transform(() => undefined)), days: z.preprocess((v) => (v === undefined || v === '' ? 90 : Number(v)), z.number().int().min(14).max(365)), horizon: z.preprocess((v) => (v === undefined || v === '' ? 7 : Number(v)), z.number().int().min(1).max(30)) });

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly catalog: CatalogService, private readonly regions: RegionsService) {}

  /** Verified stores that have coordinates; with productId each store also carries its price for that product. */
  async storeMap(q: z.infer<typeof mapQuery>) {
    const regionIds = q.regionId ? await this.regions.withDescendants(q.regionId) : undefined;
    const stores = await this.prisma.store.findMany({
      where: { status: 'VERIFIED', deletedAt: null, lat: { not: null }, lng: { not: null }, ...(regionIds ? { regionId: { in: regionIds } } : {}), ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
        ...(q.productId ? { priceRecords: { some: { productId: q.productId, deletedAt: null, moderationStatus: 'APPROVED' } } } : {}) },
      take: 500,
      select: { id: true, name: true, slug: true, lat: true, lng: true, region: { select: { name: true } }, market: { select: { name: true } } },
    });
    if (!q.productId) return { baseUnit: null, stores };
    const product = await this.prisma.product.findFirst({ where: { id: q.productId, deletedAt: null }, select: { unit: { select: { code: true } } } });
    const base = product ? baseUnitCode(product.unit.code) : null;
    const prices = await this.prisma.priceRecord.findMany({
      where: { productId: q.productId, deletedAt: null, moderationStatus: 'APPROVED', storeId: { in: stores.map((s) => s.id) } },
      include: { unit: { select: { id: true, code: true, name: true } }, variant: { select: { id: true, name: true, quantity: true, unit: { select: { code: true } } } } },
    });
    const best = new Map<string, number>();
    for (const p of prices) {
      const n = normalize(p);
      if (n.perBase === null || n.baseUnit !== base) continue;
      const cur = best.get(p.storeId);
      if (cur === undefined || n.perBase < cur) best.set(p.storeId, n.perBase);
    }
    return { baseUnit: base, stores: stores.map((s) => ({ ...s, pricePerBase: best.get(s.id) ?? null })) };
  }

  /** For one product: where is it cheapest/dearest, by region (min / max / avg / median per base unit). */
  async regional(productId: string) {
    const s = await this.catalog.stats(productId);
    const ranked = s.byRegion.filter((r) => r.count > 0 && r.median !== null).sort((a, b) => (a.median as number) - (b.median as number));
    return { baseUnit: s.baseUnit, overall: s.overall, byRegion: s.byRegion, cheapestRegion: ranked[0] ?? null, dearestRegion: ranked.length > 1 ? ranked[ranked.length - 1] : null };
  }

  /** Daily series plus a smoothed line and — only if the data supports it — a straight-line projection. Explicitly a baseline, not a prediction model. */
  async forecast(productId: string, o: z.infer<typeof forecastQuery>) {
    const h = await this.catalog.history(productId, { regionId: o.regionId, days: o.days });
    const series = h.series.map((b) => ({ date: b.date, value: b.avg }));
    const proj = projectLinear(series, o.horizon);
    return {
      baseUnit: h.baseUnit, days: o.days, observedDays: series.length, series, smoothed: movingAverage(series, 7),
      projection: proj.reliable ? proj.points : [], projectionReliable: proj.reliable,
      method: 'Oddiy chiziqli trend (eng kichik kvadratlar) va 7 kunlik o‘rtacha. Bu bashorat emas, qaror qabul qilish uchun kafolat bermaydi.',
      reason: proj.reliable ? null : series.length < 3 ? 'Ma’lumot yetarli emas (kamida 3 kunlik narx kerak).' : 'Narxlar trendi aniq emas, shuning uchun chiziq chizilmadi.',
    };
  }

  /** Top movers: products whose median price changed most between the previous 7 days and the last 7 days. */
  async movers(regionId?: string) {
    const now = Date.now();
    const rows = await this.prisma.priceHistory.findMany({
      where: { recordedAt: { gte: new Date(now - 14 * 86_400_000) }, priceRecord: { moderationStatus: 'APPROVED', deletedAt: null }, ...(regionId ? { regionId: { in: await this.regions.withDescendants(regionId) } } : {}) },
      select: { productId: true, price: true, recordedAt: true, priceRecord: { select: { unit: { select: { code: true } }, variant: { select: { quantity: true, unit: { select: { code: true } } } }, product: { select: { name: true, slug: true, unit: { select: { code: true } } } } } } },
      take: 20000,
    });
    const by = new Map<string, { name: string; slug: string; recent: number[]; prev: number[] }>();
    for (const r of rows) {
      const pr = r.priceRecord;
      const code = pr.variant ? pr.variant.unit.code : pr.unit.code;
      if (baseUnitCode(code) !== baseUnitCode(pr.product.unit.code)) continue;
      const qty = pr.variant ? Number(pr.variant.quantity.toString()) : 1;
      const e = by.get(r.productId) ?? { name: pr.product.name, slug: pr.product.slug, recent: [], prev: [] };
      const per = Number(r.price.toString()) / qty; // same-dimension unit differences are small within one product; the history endpoint does exact conversion
      (now - r.recordedAt.getTime() <= 7 * 86_400_000 ? e.recent : e.prev).push(per);
      by.set(r.productId, e);
    }
    return [...by.entries()].flatMap(([productId, e]) => {
      if (e.recent.length < 2 || e.prev.length < 2) return [];
      const a = priceStats(e.prev).avg, b = priceStats(e.recent).avg;
      if (!a || b === null || a === null) return [];
      return [{ productId, name: e.name, slug: e.slug, changePct: Math.round(((b - a) / a) * 1000) / 10 }];
    }).sort((x, y) => Math.abs(y.changePct) - Math.abs(x.changePct)).slice(0, 10);
  }
}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}
  @Get('map') map(@Query(new ZodPipe(mapQuery)) q: z.infer<typeof mapQuery>) { return this.svc.storeMap(q); }
  @Get('products/:id/regional') regional(@Param(new ZodPipe(idParam)) p: { id: string }) { return this.svc.regional(p.id); }
  @Get('products/:id/forecast') forecast(@Param(new ZodPipe(idParam)) p: { id: string }, @Query(new ZodPipe(forecastQuery)) q: z.infer<typeof forecastQuery>) { return this.svc.forecast(p.id, q); }
  @Get('movers') movers(@Query(new ZodPipe(z.object({ regionId: uuidSchema.optional().or(z.literal('').transform(() => undefined)) }))) q: { regionId?: string }) { return this.svc.movers(q.regionId); }
}

@Module({ imports: [AuthModule, CatalogModule], controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
