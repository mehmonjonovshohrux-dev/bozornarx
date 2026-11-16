import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodPipe } from '../common/http';
import { idParam, uuidSchema } from '../common/util';
import { CatalogService } from './catalog.service';
import { compareQuery, historyQuery, ProductListQuery, productListQuery } from './catalog.schemas';
import { PricesService } from './prices.service';

const regionQuery = z.object({ regionId: z.preprocess((v) => (v === '' ? undefined : v), uuidSchema.optional()) });
const parentQuery = z.object({ parentId: z.preprocess((v) => (v === '' ? undefined : v), uuidSchema.optional()) });
const slugParam = z.object({ idOrSlug: z.string().min(2).max(140) });

/** Public read-only API: works for guests without login. */
@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService, private readonly prices: PricesService) {}

  @Get('categories') categories() { return this.catalog.categoriesTree(); }
  @Get('units') units() { return this.catalog.units(); }
  @Get('regions') regions(@Query(new ZodPipe(parentQuery)) q: { parentId?: string }) { return this.catalog.listRegions(q.parentId); }
  @Get('markets') markets(@Query(new ZodPipe(regionQuery)) q: { regionId?: string }) { return this.catalog.listMarkets(q.regionId); }

  @Get('products') products(@Query(new ZodPipe(productListQuery)) q: ProductListQuery) { return this.catalog.listProducts(q); }

  @Get('products/:idOrSlug')
  product(@Param(new ZodPipe(slugParam)) p: { idOrSlug: string }, @Query(new ZodPipe(regionQuery)) q: { regionId?: string }) { return this.catalog.productDetail(p.idOrSlug, q.regionId); }

  @Get('products/:id/compare')
  compare(@Param(new ZodPipe(idParam)) p: { id: string }, @Query(new ZodPipe(compareQuery)) q: { regionId?: string; variantId?: string }) { return this.catalog.compare(p.id, q.regionId, q.variantId); }

  @Get('products/:id/stats')
  stats(@Param(new ZodPipe(idParam)) p: { id: string }, @Query(new ZodPipe(regionQuery)) q: { regionId?: string }) { return this.catalog.stats(p.id, q.regionId); }

  @Get('products/:id/history')
  history(@Param(new ZodPipe(idParam)) p: { id: string }, @Query(new ZodPipe(historyQuery)) q: { regionId?: string; storeId?: string; days: number }) { return this.catalog.history(p.id, q); }

  @Get('prices/:id/trust') trust(@Param(new ZodPipe(idParam)) p: { id: string }) { return this.prices.trustOf(p.id); }
  @Get('prices/:id/tiers') tiers(@Param(new ZodPipe(idParam)) p: { id: string }) { return this.prices.tiers(p.id); }
  @Get('stores/:idOrSlug') store(@Param(new ZodPipe(slugParam)) p: { idOrSlug: string }) { return this.catalog.storeProfile(p.idOrSlug); }
}
