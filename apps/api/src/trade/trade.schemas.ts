import { z } from 'zod';
import { optBool, optStr, pageSchema, uuidSchema } from '../common/util';

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' ? undefined : v), s.optional());
const qty = z.number().positive('Miqdor 0 dan katta bo‘lsin').max(1_000_000);

export const storeCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  regionId: uuidSchema,
  marketId: uuidSchema.optional(),
  description: z.string().trim().max(1000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export const storeUpdateSchema = storeCreateSchema.partial().refine((o) => Object.keys(o).length > 0, 'Hech narsa o‘zgartirilmadi');
export const storeDocSchema = z.object({ type: z.string().trim().min(2).max(60), fileId: uuidSchema });
export const storeDecisionSchema = z.object({ action: z.enum(['APPROVE', 'REJECT', 'SUSPEND', 'RESTORE']), reason: z.string().trim().min(3).max(500) });
export const storeQueueQuery = pageSchema.extend({ status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).default('PENDING') });

export const discountSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, 'Kod 3–20 ta lotin harf/raqam bo‘lsin'),
  percent: z.number().gt(0).max(90),
  minAmount: z.number().min(0).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  usageLimit: z.number().int().positive().optional(),
  active: z.boolean().default(true),
});

export const cartAddSchema = z.object({ priceRecordId: uuidSchema, quantity: qty });
export const cartUpdateSchema = z.object({ quantity: qty });

export const checkoutSchema = z.object({
  storeId: uuidSchema,
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']),
  deliveryAddress: z.string().trim().min(5).max(300).optional(),
  note: z.string().trim().max(500).optional(),
  couponCode: z.string().trim().toUpperCase().max(20).optional(),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'CARD']).default('CASH_ON_DELIVERY'),
}).refine((o) => o.deliveryMethod === 'PICKUP' || !!o.deliveryAddress, { message: 'Yetkazib berish manzilini kiriting', path: ['deliveryAddress'] });

export const orderListQuery = pageSchema.extend({
  as: z.enum(['buyer', 'seller']).default('buyer'),
  status: opt(z.enum(['CREATED', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'DISPUTED'])),
  storeId: opt(uuidSchema),
  q: optStr,
});
export const transitionSchema = z.object({
  to: z.enum(['CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'ACCEPTED', 'COMPLETED', 'CANCELLED']),
  note: z.string().trim().max(300).optional(),
  carrier: z.string().trim().max(80).optional(),
  trackingRef: z.string().trim().max(80).optional(),
});
export const paymentCreateSchema = z.object({ method: z.enum(['CARD']) });
export const deliveryEvidenceSchema = z.object({ fileId: uuidSchema });
export const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });

export const offerCreateSchema = z.object({
  priceRecordId: uuidSchema,
  quantity: qty,
  offeredUnitPrice: z.number().positive().max(10_000_000_000),
  message: z.string().trim().max(500).optional(),
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  deliveryAddress: z.string().trim().min(5).max(300).optional(),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'CARD']).default('CASH_ON_DELIVERY'),
}).refine((o) => o.deliveryMethod === 'PICKUP' || !!o.deliveryAddress, { message: 'Yetkazib berish manzilini kiriting', path: ['deliveryAddress'] });
export const offerRespondSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT', 'COUNTER']),
  counterUnitPrice: z.number().positive().max(10_000_000_000).optional(),
}).refine((o) => o.action !== 'COUNTER' || o.counterUnitPrice !== undefined, { message: 'Qarshi narxni kiriting', path: ['counterUnitPrice'] });
export const offerListQuery = pageSchema.extend({ as: z.enum(['buyer', 'seller']).default('buyer'), status: opt(z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'CANCELLED', 'EXPIRED'])) });
export const paymentListQuery = pageSchema.extend({ status: opt(z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'])), flag: optBool });
