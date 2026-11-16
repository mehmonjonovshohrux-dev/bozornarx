import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthUser } from '../auth/guards';
import { ZodPipe } from '../common/http';
import { Me, PageQuery, Secured, idParam } from '../common/util';
import { CartService } from './cart.service';
import { OffersService } from './offers.service';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { StoresService } from './stores.service';
import {
  cartAddSchema, cartUpdateSchema, checkoutSchema, deliveryEvidenceSchema, discountSchema, offerCreateSchema, offerListQuery, offerRespondSchema, orderListQuery,
  paymentListQuery, reviewSchema, storeCreateSchema, storeDecisionSchema, storeDocSchema, storeQueueQuery, storeUpdateSchema, transitionSchema,
} from './trade.schemas';

const id = new ZodPipe(idParam);
type Id = { id: string };
const sub = new ZodPipe(z.object({ id: z.string().uuid(), sid: z.string().uuid() }));

@ApiTags('stores')
@Controller()
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Post('stores') @Secured('stores.manage') create(@Me() u: AuthUser, @Body(new ZodPipe(storeCreateSchema)) b: z.infer<typeof storeCreateSchema>) { return this.stores.create(u, b); }
  @Get('stores/mine') @Secured('stores.manage') mine(@Me() u: AuthUser) { return this.stores.mine(u); }
  @Patch('stores/:id') @Secured('stores.manage') update(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(storeUpdateSchema)) b: z.infer<typeof storeUpdateSchema>) { return this.stores.update(u, p.id, b); }
  @Post('stores/:id/documents') @Secured('stores.manage') doc(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(storeDocSchema)) b: z.infer<typeof storeDocSchema>) { return this.stores.addDocument(u, p.id, b); }
  @Get('stores/:id/stats') @Secured('stores.manage') stats(@Me() u: AuthUser, @Param(id) p: Id) { return this.stores.stats(u, p.id); }

  @Get('stores/:id/discounts') @Secured('stores.manage') discounts(@Me() u: AuthUser, @Param(id) p: Id) { return this.stores.discounts(u, p.id); }
  @Post('stores/:id/discounts') @Secured('stores.manage') addDiscount(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(discountSchema)) b: z.infer<typeof discountSchema>) { return this.stores.createDiscount(u, p.id, b); }
  @Patch('stores/:id/discounts/:sid') @Secured('stores.manage') toggle(@Me() u: AuthUser, @Param(sub) p: { id: string; sid: string }, @Body(new ZodPipe(z.object({ active: z.boolean() }))) b: { active: boolean }) { return this.stores.toggleDiscount(u, p.id, p.sid, b.active); }
  @Delete('stores/:id/discounts/:sid') @Secured('stores.manage') delDiscount(@Me() u: AuthUser, @Param(sub) p: { id: string; sid: string }) { return this.stores.deleteDiscount(u, p.id, p.sid); }

  @Get('moderation/stores') @Secured('stores.moderate') queue(@Query(new ZodPipe(storeQueueQuery)) q: PageQuery & { status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED' }) { return this.stores.queue(q, q.status); }
  @Post('moderation/stores/:id') @Secured('stores.moderate') decide(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(storeDecisionSchema)) b: z.infer<typeof storeDecisionSchema>) { return this.stores.decide(u, p.id, b); }
}

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}
  @Get() @Secured('orders.create') get(@Me() u: AuthUser) { return this.cart.get(u); }
  @Post('items') @Secured('orders.create') add(@Me() u: AuthUser, @Body(new ZodPipe(cartAddSchema)) b: z.infer<typeof cartAddSchema>) { return this.cart.add(u, b); }
  @Patch('items/:id') @Secured('orders.create') update(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(cartUpdateSchema)) b: z.infer<typeof cartUpdateSchema>) { return this.cart.update(u, p.id, b.quantity); }
  @Delete('items/:id') @Secured('orders.create') remove(@Me() u: AuthUser, @Param(id) p: Id) { return this.cart.remove(u, p.id); }
  @Delete() @Secured('orders.create') clear(@Me() u: AuthUser) { return this.cart.clear(u); }
}

@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly payments: PaymentsService) {}

  @Post('orders/checkout') @Secured('orders.create') checkout(@Me() u: AuthUser, @Body(new ZodPipe(checkoutSchema)) b: z.infer<typeof checkoutSchema>) { return this.orders.checkout(u, b); }
  /** buyer: own orders (orders.create). seller: orders of own stores (orders.manage). */
  @Get('orders') @Secured() list(@Me() u: AuthUser, @Query(new ZodPipe(orderListQuery)) q: PageQuery & z.infer<typeof orderListQuery>) {
    return this.orders.list(u, q);
  }
  @Get('orders/:id') @Secured() detail(@Me() u: AuthUser, @Param(id) p: Id) { return this.orders.detail(u, p.id); }
  @Post('orders/:id/transition') @Secured() transition(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(transitionSchema)) b: z.infer<typeof transitionSchema>) { return this.orders.transition(u, p.id, b); }
  @Post('orders/:id/delivery-evidence') @Secured() evidence(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(deliveryEvidenceSchema)) b: z.infer<typeof deliveryEvidenceSchema>) { return this.orders.addDeliveryEvidence(u, p.id, b.fileId); }
  @Post('orders/:id/review') @Secured('reviews.create') review(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(reviewSchema)) b: z.infer<typeof reviewSchema>) { return this.orders.review(u, p.id, b); }

  @Post('orders/:id/payments/card') @Secured('orders.create') card(@Me() u: AuthUser, @Param(id) p: Id) { return this.payments.startCardPayment(u, p.id); }
  @Post('orders/:id/payments/cash-received')
  @Secured('orders.manage')
  async cash(@Me() u: AuthUser, @Param(id) p: Id) {
    const pay = await this.payments.confirmCash(u, p.id);
    const completed = await this.orders.completeIfReady(p.id, u.id);
    return { paymentId: pay.id, status: pay.status, orderCompleted: completed };
  }
  @Get('payments') @Secured('payments.view') payList(@Me() u: AuthUser, @Query(new ZodPipe(paymentListQuery)) q: PageQuery & { status?: string }) { return this.payments.list(u, q); }
}

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}
  @Post() @Secured('orders.create') create(@Me() u: AuthUser, @Body(new ZodPipe(offerCreateSchema)) b: z.infer<typeof offerCreateSchema>) { return this.offers.create(u, b); }
  @Get() @Secured() list(@Me() u: AuthUser, @Query(new ZodPipe(offerListQuery)) q: PageQuery & { as: 'buyer' | 'seller'; status?: string }) { return this.offers.list(u, q); }
  @Post(':id/respond') @Secured('orders.manage') respond(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(offerRespondSchema)) b: z.infer<typeof offerRespondSchema>) { return this.offers.respond(u, p.id, b); }
  @Post(':id/accept-counter') @Secured('orders.create') accept(@Me() u: AuthUser, @Param(id) p: Id) { return this.offers.acceptCounter(u, p.id); }
  @Post(':id/cancel') @Secured('orders.create') cancel(@Me() u: AuthUser, @Param(id) p: Id) { return this.offers.cancel(u, p.id); }
}
