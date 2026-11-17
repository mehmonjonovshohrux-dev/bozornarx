import { z } from 'zod';
import { pageSchema, uuidSchema } from '../common/util';

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' ? undefined : v), s.optional());

export const userListQuery = pageSchema.extend({
  q: opt(z.string().trim().min(1).max(100)),
  role: opt(z.enum(['BUYER', 'SELLER', 'MODERATOR', 'SUPER_ADMIN'])),
  status: opt(z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED'])),
});
export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().min(3).max(500) });
export const roleChangeSchema = z.object({ role: z.enum(['BUYER', 'SELLER', 'MODERATOR']), action: z.enum(['ADD', 'REMOVE']) });
export const moderatorSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export const complaintListQuery = pageSchema.extend({ status: opt(z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'])), targetType: opt(z.string().max(20)) });
export const complaintUpdateSchema = z.object({ status: z.enum(['IN_REVIEW', 'RESOLVED', 'REJECTED']), note: z.string().trim().min(3).max(500) });
export const reviewQueueQuery = pageSchema.extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') });
export const reviewDecisionSchema = z.object({ action: z.enum(['APPROVE', 'REJECT']), reason: z.string().trim().min(3).max(300) });

export const planSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,30}$/),
  name: z.string().trim().min(2).max(60),
  priceUzs: z.number().min(0).max(1_000_000_000),
  maxProducts: z.number().int().min(1).max(1_000_000),
  features: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  active: z.boolean().default(true),
});
export const subscriptionSchema = z.object({ storeId: uuidSchema, planCode: z.string().trim().min(2).max(30), months: z.number().int().min(1).max(36) });

export const auditQuery = pageSchema.extend({
  actorId: opt(uuidSchema),
  action: opt(z.string().trim().max(60)),
  entityType: opt(z.string().trim().max(40)),
  from: opt(z.coerce.date()),
  to: opt(z.coerce.date()),
});

/** Only these settings exist. Each has its own value schema, so a typo can never create a rogue setting. */
export const SETTINGS = {
  'orders.requireSignedContract': { schema: z.boolean(), description: 'Buyurtmani tayyorlashdan oldin shartnoma imzolangan bo‘lishi shart (E-IMZO ulangandan keyin yoqing)', fallback: false },
  'contracts.requireReview': { schema: z.boolean(), description: 'Qo‘lda tuzilgan shartnomalar moderator tekshiruvidan o‘tsin', fallback: false },
  'contracts.warrantyDays': { schema: z.number().int().min(0).max(365), description: 'Shartnomadagi standart kafolat muddati (kun)', fallback: 14 },
  'delivery.fee': { schema: z.number().min(0).max(10_000_000), description: 'Yetkazib berish narxi (so‘m)', fallback: 0 },
  'plans.freeMaxPrices': { schema: z.number().int().min(1).max(100_000), description: 'Tarifsiz do‘konlar uchun narxlar chegarasi', fallback: 50 },
} as const;
export type SettingKey = keyof typeof SETTINGS;
export const settingKeySchema = z.object({ key: z.enum(Object.keys(SETTINGS) as [SettingKey, ...SettingKey[]]) });

export const regionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(['VILOYAT', 'TUMAN', 'SHAHAR', 'MAHALLA']),
  parentId: uuidSchema.nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export const marketSchema = z.object({
  regionId: uuidSchema,
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const listStatusQuery = pageSchema.extend({ status: opt(z.string().trim().min(2).max(30)), q: opt(z.string().trim().min(1).max(100)) });
