import { z } from 'zod';
import { pageSchema, uuidSchema } from '../common/util';

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' ? undefined : v), s.optional());
const clause = z.object({ title: z.string().trim().min(2).max(120), text: z.string().trim().min(5).max(3000) });

export const contractTypes = ['SALE', 'DELIVERY', 'WHOLESALE', 'SUPPLY', 'PARTNERSHIP', 'SERVICE', 'PLATFORM_OFFER'] as const;

export const termsSchema = z.object({
  subject: z.string().trim().min(3).max(1000),
  amount: z.number().min(0).max(100_000_000_000),
  period: z.string().trim().min(2).max(200).default('kelishuv asosida'),
  paymentTerms: z.string().trim().min(2).max(300).default('tomonlar kelishuvi bo‘yicha'),
  deliveryTerms: z.string().trim().min(2).max(300).default('tomonlar kelishuvi bo‘yicha'),
  deliveryAddress: z.string().trim().min(2).max(300).default('shartnoma shartlariga muvofiq'),
  warrantyDays: z.number().int().min(0).max(365).default(14),
  extraClauses: z.array(clause).max(10).default([]),
});

export const contractCreateSchema = z.object({
  type: z.enum(contractTypes),
  sellerStoreId: uuidSchema,
  /** when the SELLER creates the contract: the buyer's registered email */
  buyerEmail: z.string().trim().toLowerCase().email().optional(),
  terms: termsSchema,
});
export const contractTermsUpdateSchema = z.object({ terms: termsSchema });
export const orderContractTermsSchema = z.object({ extraClauses: z.array(clause).max(10) });
export const demoSignSchema = z.object({ password: z.string().min(1).max(200), agree: z.literal(true, { errorMap: () => ({ message: 'Shartnoma shartlariga rozilik bildiring' }) }) });
export const signSchema = z.object({ pkcs7Base64: z.string().min(100).max(2_000_000) });
export const contractListQuery = pageSchema.extend({
  as: z.enum(['buyer', 'seller']).default('buyer'),
  status: opt(z.enum(['DRAFT', 'PENDING_REVIEW', 'WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'PARTIALLY_SIGNED', 'FULLY_SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'EXPIRED'])),
  archive: z.preprocess((v) => v === 'true', z.boolean()),
});
export const contractDecisionSchema = z.object({ action: z.enum(['APPROVE', 'REJECT']), reason: z.string().trim().min(3).max(500) });
export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const templateSchema = z.object({
  type: z.enum(contractTypes),
  name: z.string().trim().min(3).max(120),
  clauses: z.array(clause).min(2).max(30),
});
export const versionQuery = z.object({ version: z.preprocess((v) => (v === undefined || v === '' ? undefined : Number(v)), z.number().int().positive().optional()) });
export const queueQuery = pageSchema;

export const disputeCreateSchema = z.object({
  orderId: uuidSchema,
  reason: z.string().trim().min(5).max(500),
  details: z.string().trim().max(3000).optional(),
  evidenceFileIds: z.array(uuidSchema).max(10).default([]),
});
export const disputeNoteSchema = z.object({ text: z.string().trim().min(2).max(2000).optional(), fileId: uuidSchema.optional() }).refine((o) => o.text || o.fileId, 'Matn yoki fayl kiriting');
export const disputeResolveSchema = z.object({ outcome: z.enum(['COMPLETE', 'CANCEL']), resolution: z.string().trim().min(5).max(2000) });
export const disputeListQuery = pageSchema.extend({ status: opt(z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'APPEALED', 'CLOSED'])) });
