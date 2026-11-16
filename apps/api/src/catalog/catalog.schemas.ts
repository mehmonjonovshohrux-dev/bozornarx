import { z } from 'zod';
import { optBool, optNum, optStr, pageSchema, uuidSchema } from '../common/util';

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' ? undefined : v), s.optional());

export const productListQuery = pageSchema.extend({
  q: optStr,
  categoryId: opt(uuidSchema),
  regionId: opt(uuidSchema),
  storeId: opt(uuidSchema),
  minPrice: optNum,
  maxPrice: optNum,
  availability: opt(z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'])),
  delivery: optBool,
  verifiedOnly: optBool,
  sort: z.enum(['newest', 'name', 'price_asc', 'price_desc']).default('newest'),
});
export type ProductListQuery = z.infer<typeof productListQuery>;

export const compareQuery = z.object({ regionId: opt(uuidSchema), variantId: opt(uuidSchema) });
export const historyQuery = z.object({
  regionId: opt(uuidSchema),
  storeId: opt(uuidSchema),
  days: z.preprocess((v) => (v === undefined || v === '' ? 30 : Number(v)), z.number().int().min(1).max(365)),
});

const name = z.string().trim().min(2, 'Nom kamida 2 ta belgi').max(120);
export const productCreateSchema = z.object({
  name,
  categoryId: uuidSchema,
  unitId: uuidSchema,
  brand: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  sku: z.string().trim().max(60).optional(),
  barcode: z.string().trim().max(40).optional(),
});
export const productUpdateSchema = productCreateSchema.partial().refine((o) => Object.keys(o).length > 0, 'Hech narsa o‘zgartirilmadi');

export const variantSchema = z.object({
  name: z.string().trim().min(1).max(60),
  unitId: uuidSchema,
  quantity: z.number().positive().max(1_000_000),
  sku: z.string().trim().max(60).optional(),
  barcode: z.string().trim().max(40).optional(),
});
export const imageSchema = z.object({ fileId: uuidSchema });

export const decisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().min(3, 'Sabab kamida 3 ta belgi bo‘lsin').max(500),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  parentId: uuidSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

const availability = z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN']);
export const priceCreateSchema = z.object({
  storeId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
  unitId: uuidSchema.optional(), // defaults to the product's unit
  price: z.number().positive('Narx 0 dan katta bo‘lsin').max(10_000_000_000),
  availability: availability.default('IN_STOCK'),
  quantityAvailable: z.number().min(0).max(1_000_000_000).optional(),
  deliveryAvailable: z.boolean().default(false),
  discountPercent: z.number().min(0).max(90).optional(),
  note: z.string().trim().max(300).optional(),
});
export const priceUpdateSchema = z
  .object({
    price: z.number().positive().max(10_000_000_000),
    availability,
    deliveryAvailable: z.boolean(),
    discountPercent: z.number().min(0).max(90).nullable(),
    note: z.string().trim().max(300).nullable(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Hech narsa o‘zgartirilmadi');
export const stockSchema = z
  .object({ delta: z.number().optional(), set: z.number().min(0).optional(), reason: z.enum(['RESTOCK', 'ADJUST']).default('ADJUST') })
  .refine((o) => (o.delta === undefined) !== (o.set === undefined), 'delta yoki set dan faqat bittasini bering');
export const tiersSchema = z.object({
  tiers: z.array(z.object({ minQuantity: z.number().positive(), unitPrice: z.number().positive() })).max(10),
});
export const mineQuery = pageSchema.extend({ storeId: opt(uuidSchema), stale: optBool });
export const moderationQueueQuery = pageSchema.extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') });
