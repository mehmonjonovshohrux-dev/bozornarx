import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/app-error';
import { PageQuery, num, paged } from '../common/util';
import { bucketByDay, median, priceStats, priceTrend, round2 } from '../domain/pricing';
import { STALE_AFTER_HOURS } from '../domain/trust';
import { baseUnitCode, pricePerBaseUnit } from '../domain/units';
import { PrismaService } from '../prisma/prisma.service';
import { ProductListQuery } from './catalog.schemas';
import { RegionsService } from './regions.service';

export const OFFER_INCLUDE = {
  store: { select: { id: true, name: true, slug: true, status: true, lat: true, lng: true, region: { select: { id: true, name: true } }, market: { select: { id: true, name: true } } } },
  unit: { select: { id: true, code: true, name: true } },
  variant: { select: { id: true, name: true, quantity: true, unit: { select: { code: true } } } },
  trust: { orderBy: { computedAt: 'desc' as const }, take: 1, select: { status: true, score: true, factors: true } },
  _count: { select: { evidence: true } },
} satisfies Prisma.PriceRecordInclude;
export type OfferRow = Prisma.PriceRecordGetPayload<{ include: typeof OFFER_INCLUDE }>;

export interface Normalized {
  /** price after the seller's discount */
  effectivePrice: number;
  /** effective price per base unit (kg, l, dona ...) or null when it cannot be computed honestly (e.g. a pack of unknown size) */
  perBase: number | null;
  baseUnit: string | null;
}

type Dec = { toString(): string } | number;
export interface NormInput {
  price: Dec;
  discountPercent: Dec | null;
  unit: { code: string };
  variant: { quantity: Dec; unit: { code: string } } | null;
}

export function normalize(r: NormInput): Normalized {
  const d = r.discountPercent ? num(r.discountPercent) : 0;
  const effectivePrice = round2(num(r.price) * (1 - d / 100));
  const unitCode = r.variant ? r.variant.unit.code : r.unit.code;
  const qty = r.variant ? num(r.variant.quantity) : 1;
  const v = pricePerBaseUnit({ price: effectivePrice, unit: unitCode, quantity: qty });
  return { effectivePrice, perBase: v === null ? null : round2(v), baseUnit: baseUnitCode(unitCode) };
}

export function offerView(r: OfferRow) {
  const n = normalize(r);
  const t = r.trust[0];
  const ageHours = (Date.now() - r.confirmedAt.getTime()) / 3_600_000;
  return {
    id: r.id,
    price: num(r.price),
    discountPercent: r.discountPercent ? num(r.discountPercent) : null,
    effectivePrice: n.effectivePrice,
    pricePerBaseUnit: n.perBase,
    baseUnit: n.baseUnit,
    unit: r.unit.code,
    variant: r.variant ? { id: r.variant.id, name: r.variant.name } : null,
    availability: r.availability,
    quantityAvailable: r.quantityAvailable === null ? null : num(r.quantityAvailable),
    deliveryAvailable: r.deliveryAvailable,
    note: r.note,
    confirmedAt: r.confirmedAt,
    updatedAt: r.updatedAt,
    stale: ageHours > STALE_AFTER_HOURS,
    hasEvidence: r._count.evidence > 0,
    store: { id: r.store.id, name: r.store.name, slug: r.store.slug, verified: r.store.status === 'VERIFIED', lat: r.store.lat, lng: r.store.lng, region: r.store.region.name, market: r.store.market?.name ?? null },
    trust: t ? { status: t.status, score: t.score, factors: t.factors } : { status: 'INSUFFICIENT_DATA' as const, score: null, factors: {} },
  };
}

const LIVE_PRICE: Prisma.PriceRecordWhereInput = { moderationStatus: 'APPROVED', deletedAt: null, store: { status: { in: ['VERIFIED', 'PENDING'] }, deletedAt: null } };

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly regions: RegionsService) {}

  // ───────────── reference data ─────────────

  async categoriesTree() {
    const rows = await this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    const byParent = new Map<string | null, typeof rows>();
    for (const c of rows) {
      const arr = byParent.get(c.parentId) ?? [];
      arr.push(c);
      byParent.set(c.parentId, arr);
    }
    const build = (pid: string | null): Array<{ id: string; name: string; slug: string; children: unknown[] }> =>
      (byParent.get(pid) ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, children: build(c.id) }));
    return build(null);
  }

  units() {
    return this.prisma.unit.findMany({ orderBy: [{ dimension: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, dimension: true } });
  }

  listRegions(parentId?: string) {
    return this.prisma.region.findMany({ where: { parentId: parentId ?? null }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, type: true, lat: true, lng: true, parentId: true } });
  }
  listMarkets(regionId?: string) {
    return this.prisma.market.findMany({ where: regionId ? { regionId } : {}, orderBy: { name: 'asc' }, select: { id: true, name: true, address: true, lat: true, lng: true, regionId: true } });
  }

  private async categoryIds(categoryId: string): Promise<string[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const out = new Set([categoryId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of all) if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true; }
    }
    return [...out];
  }

  // ───────────── search ─────────────

  async listProducts(q: ProductListQuery) {
    const productWhere: Prisma.ProductWhereInput = { status: 'APPROVED', deletedAt: null };
    if (q.q) {
      productWhere.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { brand: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { barcode: q.q },
        { sku: q.q },
      ];
    }
    if (q.categoryId) productWhere.categoryId = { in: await this.categoryIds(q.categoryId) };

    const priceWhere: Prisma.PriceRecordWhereInput = { ...LIVE_PRICE };
    let hasPriceFilter = false;
    if (q.regionId) { priceWhere.regionId = { in: await this.regions.withDescendants(q.regionId) }; hasPriceFilter = true; }
    if (q.storeId) { priceWhere.storeId = q.storeId; hasPriceFilter = true; }
    if (q.availability) { priceWhere.availability = q.availability; hasPriceFilter = true; }
    if (q.delivery !== undefined) { priceWhere.deliveryAvailable = q.delivery; hasPriceFilter = true; }
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      priceWhere.price = { ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}), ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}) };
      hasPriceFilter = true;
    }
    if (q.verifiedOnly) { priceWhere.store = { status: 'VERIFIED', deletedAt: null }; hasPriceFilter = true; }

    const priceSort = q.sort === 'price_asc' || q.sort === 'price_desc';
    let ids: string[];
    let total: number;
    if (hasPriceFilter || priceSort) {
      // Only products that have at least one live price matching the filters; sorted by their cheapest matching price.
      const groups = await this.prisma.priceRecord.groupBy({ by: ['productId'], where: { ...priceWhere, product: productWhere }, _min: { price: true } });
      groups.sort((a, b) => (q.sort === 'price_desc' ? num(b._min.price) - num(a._min.price) : num(a._min.price) - num(b._min.price)));
      total = groups.length;
      ids = groups.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((g) => g.productId);
    } else {
      const where = productWhere;
      total = await this.prisma.product.count({ where });
      const rows = await this.prisma.product.findMany({ where, orderBy: q.sort === 'name' ? { name: 'asc' } : { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true } });
      ids = rows.map((r) => r.id);
    }

    const [products, offers] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, slug: true, brand: true, category: { select: { id: true, name: true } }, unit: { select: { code: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { fileKey: true } } },
      }),
      this.prisma.priceRecord.findMany({ where: { ...priceWhere, productId: { in: ids } }, include: OFFER_INCLUDE }),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = ids.flatMap((id) => {
      const p = byId.get(id);
      if (!p) return [];
      const mine = offers.filter((o) => o.productId === id);
      const norm = mine.map((o) => ({ o, n: normalize(o) }));
      const comparable = norm.filter((x) => x.n.perBase !== null && x.n.baseUnit === (norm[0]?.n.baseUnit ?? null));
      const cheapest = comparable.sort((a, b) => a.n.perBase! - b.n.perBase!)[0];
      return [{
        id: p.id, name: p.name, slug: p.slug, brand: p.brand, category: p.category, unit: p.unit.code,
        imageId: p.images[0]?.fileKey ?? null,
        offersCount: mine.length,
        cheapest: cheapest ? { perBase: cheapest.n.perBase, baseUnit: cheapest.n.baseUnit, price: cheapest.n.effectivePrice, unit: cheapest.o.unit.code, storeName: cheapest.o.store.name } : null,
      }];
    });
    return paged(items, total, q as PageQuery);
  }

  // ───────────── product detail, compare, stats, history ─────────────

  async productDetail(idOrSlug: string, regionId?: string) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const p = await this.prisma.product.findFirst({
      where: { ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }), status: 'APPROVED', deletedAt: null },
      include: { category: { select: { id: true, name: true, slug: true } }, unit: { select: { id: true, code: true, name: true } }, variants: { include: { unit: { select: { code: true } } } }, images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    const where: Prisma.PriceRecordWhereInput = { ...LIVE_PRICE, productId: p.id, ...(regionId ? { regionId: { in: await this.regions.withDescendants(regionId) } } : {}) };
    const offers = (await this.prisma.priceRecord.findMany({ where, include: OFFER_INCLUDE, orderBy: { updatedAt: 'desc' }, take: 100 })).map(offerView);
    return {
      id: p.id, name: p.name, slug: p.slug, brand: p.brand, description: p.description, sku: p.sku, barcode: p.barcode,
      category: p.category, unit: p.unit,
      variants: p.variants.map((v) => ({ id: v.id, name: v.name, quantity: num(v.quantity), unit: v.unit.code })),
      images: p.images.map((i) => ({ id: i.id, fileId: i.fileKey })),
      offers,
    };
  }

  /** Same-dimension offers ranked by price per base unit. Packs of unknown size are listed separately, never ranked. */
  async compare(productId: string, regionId?: string, variantId?: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, status: 'APPROVED', deletedAt: null }, select: { id: true, name: true, unit: { select: { code: true } } } });
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    const where: Prisma.PriceRecordWhereInput = {
      ...LIVE_PRICE, productId,
      ...(regionId ? { regionId: { in: await this.regions.withDescendants(regionId) } } : {}),
      ...(variantId ? { variantId } : {}),
    };
    const rows = await this.prisma.priceRecord.findMany({ where, include: OFFER_INCLUDE });
    const baseUnit = baseUnitCode(product.unit.code);
    const ranked = rows.map((r) => ({ r, n: normalize(r) })).filter((x) => x.n.perBase !== null && x.n.baseUnit === baseUnit).sort((a, b) => a.n.perBase! - b.n.perBase!);
    const best = ranked[0]?.n.perBase ?? null;
    const notComparable = rows.filter((r) => !ranked.some((x) => x.r.id === r.id));
    return {
      product: { id: product.id, name: product.name },
      baseUnit,
      offers: ranked.map((x, i) => ({ rank: i + 1, ...offerView(x.r), diffFromCheapestPercent: best && best > 0 ? round2(((x.n.perBase! - best) / best) * 100) : 0 })),
      notComparable: notComparable.map((r) => ({ ...offerView(r), reason: r.variant === null && r.unit.code === 'qadoq' ? 'PACK_WITHOUT_SIZE' : 'DIFFERENT_DIMENSION' })),
    };
  }

  async stats(productId: string, regionId?: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, status: 'APPROVED', deletedAt: null }, select: { unit: { select: { code: true } } } });
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    const baseUnit = baseUnitCode(product.unit.code);
    const rows = await this.prisma.priceRecord.findMany({
      where: { ...LIVE_PRICE, productId, ...(regionId ? { regionId: { in: await this.regions.withDescendants(regionId) } } : {}) },
      include: { unit: { select: { id: true, code: true, name: true } }, variant: { select: { id: true, name: true, quantity: true, unit: { select: { code: true } } } }, region: { select: { id: true, name: true } } },
    });
    const items = rows.map((r) => ({ region: r.region, n: normalize(r) })).filter((x) => x.n.perBase !== null && x.n.baseUnit === baseUnit);
    const overall = priceStats(items.map((x) => x.n.perBase!));
    const regionMap = new Map<string, { name: string; values: number[] }>();
    for (const x of items) {
      const e = regionMap.get(x.region.id) ?? { name: x.region.name, values: [] };
      e.values.push(x.n.perBase!);
      regionMap.set(x.region.id, e);
    }
    return { baseUnit, overall, byRegion: [...regionMap.entries()].map(([id, e]) => ({ regionId: id, region: e.name, ...priceStats(e.values) })).sort((a, b) => a.region.localeCompare(b.region)) };
  }

  async history(productId: string, o: { regionId?: string; storeId?: string; days: number }) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, status: 'APPROVED', deletedAt: null }, select: { unit: { select: { code: true } } } });
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Mahsulot topilmadi.');
    const baseUnit = baseUnitCode(product.unit.code);
    const since = new Date(Date.now() - o.days * 86_400_000);
    const rows = await this.prisma.priceHistory.findMany({
      where: {
        productId, recordedAt: { gte: since },
        ...(o.regionId ? { regionId: { in: await this.regions.withDescendants(o.regionId) } } : {}),
        priceRecord: { moderationStatus: 'APPROVED', ...(o.storeId ? { storeId: o.storeId } : {}) },
      },
      include: { priceRecord: { select: { discountPercent: true, unit: { select: { id: true, code: true, name: true } }, variant: { select: { id: true, name: true, quantity: true, unit: { select: { code: true } } } } } } },
      orderBy: { recordedAt: 'asc' },
      take: 5000,
    });
    // History stores the listed price; the discount is not part of history, so history compares list prices per base unit.
    const points = rows.flatMap((h) => {
      const unitCode = h.priceRecord.variant ? h.priceRecord.variant.unit.code : h.priceRecord.unit.code;
      const v = pricePerBaseUnit({ price: num(h.price), unit: unitCode, quantity: h.priceRecord.variant ? num(h.priceRecord.variant.quantity) : 1 });
      return v === null || baseUnitCode(unitCode) !== baseUnit ? [] : [{ price: round2(v), at: h.recordedAt }];
    });
    const series = bucketByDay(points);
    const prices = points.map((p) => p.price);
    return { baseUnit, days: o.days, series, stats: { ...priceStats(prices), median: median(prices) }, trend: priceTrend(series) };
  }

  async storeProfile(idOrSlug: string) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const s = await this.prisma.store.findFirst({
      where: { ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }), deletedAt: null, status: { in: ['VERIFIED', 'PENDING'] } },
      select: { id: true, name: true, slug: true, description: true, status: true, lat: true, lng: true, createdAt: true, region: { select: { id: true, name: true } }, market: { select: { id: true, name: true } } },
    });
    if (!s) throw new AppError(404, 'NOT_FOUND', 'Do‘kon topilmadi.');
    const [rating, offers] = await Promise.all([
      this.prisma.review.aggregate({ where: { storeId: s.id, status: 'APPROVED' }, _avg: { rating: true }, _count: true }),
      this.prisma.priceRecord.count({ where: { ...LIVE_PRICE, storeId: s.id } }),
    ]);
    return { ...s, verified: s.status === 'VERIFIED', rating: rating._count ? round2(rating._avg.rating ?? 0) : null, reviewsCount: rating._count, offersCount: offers };
  }
}
