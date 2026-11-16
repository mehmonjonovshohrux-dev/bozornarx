import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthUser } from '../auth/guards';
import { ZodPipe } from '../common/http';
import { Me, PageQuery, Secured, idParam, pageSchema } from '../common/util';
import { categorySchema, decisionSchema, imageSchema, mineQuery, moderationQueueQuery, priceCreateSchema, priceUpdateSchema, productCreateSchema, productUpdateSchema, stockSchema, tiersSchema, variantSchema } from './catalog.schemas';
import { PricesService } from './prices.service';
import { ProductsService } from './products.service';

const id = new ZodPipe(idParam);
type Id = { id: string };

/** Authenticated catalog management. Ownership is re-checked inside the services. */
@ApiTags('catalog-management')
@Controller()
export class CatalogManagementController {
  constructor(private readonly products: ProductsService, private readonly prices: PricesService) {}

  // products
  @Get('products/mine') @Secured('products.create') myProducts(@Me() u: AuthUser, @Query(new ZodPipe(pageSchema)) q: PageQuery) { return this.products.mine(u, q); }
  @Post('products') @Secured('products.create') createProduct(@Me() u: AuthUser, @Body(new ZodPipe(productCreateSchema)) b: z.infer<typeof productCreateSchema>) { return this.products.create(u, b); }
  @Patch('products/:id') @Secured('products.update') updateProduct(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(productUpdateSchema)) b: z.infer<typeof productUpdateSchema>) { return this.products.update(u, p.id, b); }
  @Post('products/:id/archive') @Secured('products.archive') archive(@Me() u: AuthUser, @Param(id) p: Id) { return this.products.archive(u, p.id); }
  @Delete('products/:id') @Secured('products.delete') removeProduct(@Me() u: AuthUser, @Param(id) p: Id) { return this.products.remove(u, p.id); }
  @Post('products/:id/variants') @Secured('products.update') addVariant(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(variantSchema)) b: z.infer<typeof variantSchema>) { return this.products.addVariant(u, p.id, b); }
  @Delete('variants/:id') @Secured('products.update') removeVariant(@Me() u: AuthUser, @Param(id) p: Id) { return this.products.removeVariant(u, p.id); }
  @Post('products/:id/images') @Secured('products.update') addImage(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(imageSchema)) b: z.infer<typeof imageSchema>) { return this.products.addImage(u, p.id, b); }
  @Delete('product-images/:id') @Secured('products.update') removeImage(@Me() u: AuthUser, @Param(id) p: Id) { return this.products.removeImage(u, p.id); }

  // prices (seller)
  @Get('prices/mine') @Secured('prices.create') myPrices(@Me() u: AuthUser, @Query(new ZodPipe(mineQuery)) q: PageQuery & { storeId?: string; stale?: boolean }) { return this.prices.mine(u, q); }
  @Post('prices') @Secured('prices.create') createPrice(@Me() u: AuthUser, @Body(new ZodPipe(priceCreateSchema)) b: z.infer<typeof priceCreateSchema>) { return this.prices.create(u, b); }
  @Patch('prices/:id') @Secured('prices.update') updatePrice(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(priceUpdateSchema)) b: z.infer<typeof priceUpdateSchema>) { return this.prices.update(u, p.id, b); }
  @Post('prices/:id/confirm') @Secured('prices.update') confirm(@Me() u: AuthUser, @Param(id) p: Id) { return this.prices.confirm(u, p.id); }
  @Delete('prices/:id') @Secured('prices.update') withdraw(@Me() u: AuthUser, @Param(id) p: Id) { return this.prices.withdraw(u, p.id); }
  @Post('prices/:id/stock') @Secured('prices.update') stock(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(stockSchema)) b: z.infer<typeof stockSchema>) { return this.prices.adjustStock(u, p.id, b); }
  @Get('prices/:id/stock') @Secured('prices.update') ledger(@Me() u: AuthUser, @Param(id) p: Id) { return this.prices.stockLedger(u, p.id); }
  @Put('prices/:id/tiers') @Secured('prices.update') setTiers(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(tiersSchema)) b: z.infer<typeof tiersSchema>) { return this.prices.setTiers(u, p.id, b); }
  @Post('prices/:id/evidence') @Secured('prices.update') evidence(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(imageSchema)) b: z.infer<typeof imageSchema>) { return this.prices.addEvidence(u, p.id, b.fileId); }

  // moderation
  @Get('moderation/products') @Secured('catalog.manage') productQueue(@Query(new ZodPipe(moderationQueueQuery)) q: PageQuery & { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) { return this.products.queue(q, q.status); }
  @Post('moderation/products/:id') @Secured('catalog.manage') decideProduct(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(decisionSchema)) b: z.infer<typeof decisionSchema>) { return this.products.decide(u, p.id, b); }
  @Get('moderation/prices') @Secured('prices.moderate') priceQueue(@Query(new ZodPipe(moderationQueueQuery)) q: PageQuery & { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) { return this.prices.queue(q, q.status); }
  @Post('moderation/prices/:id') @Secured('prices.moderate') decidePrice(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(decisionSchema)) b: z.infer<typeof decisionSchema>) { return this.prices.decide(u, p.id, b); }

  // categories
  @Post('categories') @Secured('catalog.manage') createCategory(@Me() u: AuthUser, @Body(new ZodPipe(categorySchema)) b: z.infer<typeof categorySchema>) { return this.products.createCategory(u, b); }
  @Patch('categories/:id') @Secured('catalog.manage') updateCategory(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(categorySchema)) b: z.infer<typeof categorySchema>) { return this.products.updateCategory(u, p.id, b); }
  @Delete('categories/:id') @Secured('catalog.manage') deleteCategory(@Me() u: AuthUser, @Param(id) p: Id) { return this.products.deleteCategory(u, p.id); }
}
