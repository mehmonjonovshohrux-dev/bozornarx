import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, randomInt } from 'node:crypto';
import { verify as argonVerify } from '@node-rs/argon2';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { PageQuery, isStaff, num, paged } from '../common/util';
import { DEFAULT_TEMPLATES, Clause, ContractTypeCode, TemplateError, renderClauses } from '../domain/contract-templates';
import { round2 } from '../domain/pricing';
import { ContractStatus, InvalidTransitionError, assertContractTransition } from '../domain/state-machines';
import { StorageService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ENV, Env } from '../config/env';
import { contractCreateSchema, contractDecisionSchema, demoSignSchema, orderContractTermsSchema, signSchema, termsSchema } from './contracts.schemas';
import { EimzoService } from './eimzo.adapter';
import { ContractBody, DeliveryActData, buildContractPdf, buildDeliveryActPdf } from './pdf';

type Tx = Prisma.TransactionClient;
type Terms = z.infer<typeof termsSchema>;

const WAITING: ContractStatus[] = ['WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'PARTIALLY_SIGNED'];
const PAYMENT_LABEL: Record<string, string> = { CASH_ON_DELIVERY: 'naqd pul (yetkazib berilganda)', CARD: 'bank kartasi (to‘lov provayderi orqali)' };
const DELIVERY_LABEL: Record<string, string> = { PICKUP: 'olib ketish', DELIVERY: 'yetkazib berish' };

function step(from: ContractStatus, to: ContractStatus): void {
  try {
    assertContractTransition(from, to);
  } catch (e) {
    if (e instanceof InvalidTransitionError) throw new AppError(409, 'INVALID_TRANSITION', `Shartnomani "${from}" holatidan "${to}" holatiga o‘tkazib bo‘lmaydi.`);
    throw e;
  }
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly eimzo: EimzoService,
    private readonly audit: AuditService,
    private readonly notif: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ───────────── helpers ─────────────

  private async setting<T>(key: string, fallback: T): Promise<T> {
    const s = await this.prisma.systemSetting.findUnique({ where: { key } });
    return (s?.value as T | undefined) ?? fallback;
  }

  private async clausesFor(type: ContractTypeCode): Promise<{ name: string; clauses: Clause[] }> {
    const t = await this.prisma.contractTemplate.findFirst({ where: { type, active: true }, orderBy: { version: 'desc' } });
    const base = t ? { name: t.name, clauses: t.clauses as unknown as Clause[] } : DEFAULT_TEMPLATES[type];
    if (this.env.DEMO_SIGNING !== 'enabled') return base;
    // Demo mode: the signature clause must describe what really happens (and what it is not), so the document never claims E-IMZO.
    const demo: Clause = { title: 'Elektron imzo (DEMO rejimi)', text: 'Ushbu shartnoma BozorNarx sinov (demo) rejimida tuziladi. Har bir tomon o‘z shaxsiy hisobiga kirib, parolini qayta kiritish va shartlarga rozilik belgisini qo‘yish orqali shartnomani oddiy elektron imzo bilan tasdiqlaydi. Imzo vaqti, qurilma ma’lumoti va shartnoma fayli hashi (SHA-256) saqlanadi. Bu E-IMZO (elektron raqamli imzo) emas va sinov maqsadida qo‘llanadi; haqiqiy savdoda E-IMZO yoki tomonlarning yozma kelishuviga asoslangan imzo qo‘llanishi kerak.' };
    return { name: base.name, clauses: base.clauses.some((c) => c.title === 'Elektron imzo') ? base.clauses.map((c) => (c.title === 'Elektron imzo' ? demo : c)) : [...base.clauses, demo] };
  }

  private async newNumber(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const n = `BN-${new Date().getUTCFullYear()}-${String(randomInt(0, 100_000)).padStart(5, '0')}`;
      if (!(await this.prisma.contract.findUnique({ where: { number: n }, select: { id: true } }))) return n;
    }
    throw new AppError(500, 'NUMBER_GENERATION', 'Shartnoma raqamini yaratib bo‘lmadi.');
  }

  private async event(tx: Tx, contractId: string, actorId: string | null, type: string, data: Prisma.InputJsonValue = {}) {
    await tx.contractEvent.create({ data: { contractId, actorId, type, data } });
  }

  /** Renders the PDF, stores its bytes and returns the hash that the parties will sign. */
  private async renderVersion(body: ContractBody, ownerId: string) {
    const bytes = Buffer.from(await buildContractPdf(body));
    const f = await this.storage.put({ ownerId, kind: 'CONTRACT_PDF', data: bytes });
    return { pdfKey: f.id, sha256: f.sha256 };
  }

  private async party(user: AuthUser, contractId: string) {
    const c = await this.prisma.contract.findUnique({ where: { id: contractId }, include: { sellerStore: { select: { id: true, name: true, ownerId: true } } } });
    if (!c) throw new AppError(404, 'NOT_FOUND', 'Shartnoma topilmadi.');
    const role = c.buyerId === user.id ? ('BUYER' as const) : c.sellerStore.ownerId === user.id ? ('SELLER' as const) : null;
    if (!role && !isStaff(user.roles)) throw new AppError(404, 'NOT_FOUND', 'Shartnoma topilmadi.');
    return { c, role };
  }

  // ───────────── creation ─────────────

  /** Called when the seller confirms an order: the contract is generated from the order, never typed by hand. */
  async createForOrder(orderId: string, actorId: string) {
    const existing = await this.prisma.contract.findUnique({ where: { orderId } });
    if (existing) return existing;
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true } } } },
        store: { select: { id: true, name: true, region: { select: { name: true } }, owner: { select: { profile: { select: { fullName: true } }, email: true } } } },
        items: { include: { product: { select: { name: true } }, unit: { select: { code: true } }, variant: { select: { name: true } } } },
      },
    });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');

    const number = await this.newNumber();
    const type: ContractTypeCode = 'SALE';
    const tpl = await this.clausesFor(type);
    const warrantyDays = await this.setting<number>('contracts.warrantyDays', 14);
    const lines = o.items.map((i) => ({ name: i.variant ? `${i.product.name} (${i.variant.name})` : i.product.name, quantity: num(i.quantity), unit: i.unit.code, unitPrice: num(i.unitPrice), total: round2(num(i.quantity) * num(i.unitPrice)) }));
    const buyerName = o.buyer.profile?.fullName ?? o.buyer.email;
    let clauses: Clause[];
    try {
      clauses = renderClauses(tpl.clauses, {
        sellerName: o.store.name, buyerName, goods: lines.map((l) => `${l.name} - ${l.quantity} ${l.unit}`).join('; '), total: String(num(o.totalAmount)),
        paymentMethod: PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod, deliveryMethod: DELIVERY_LABEL[o.deliveryMethod ?? 'PICKUP'] ?? 'olib ketish',
        deliveryAddress: o.deliveryAddress ? `Manzil: ${o.deliveryAddress}.` : 'Mahsulot sotuvchi do‘konidan olib ketiladi.', warrantyDays: String(warrantyDays), period: 'buyurtma bajarilguncha', number,
      });
    } catch (e) {
      if (e instanceof TemplateError) throw new AppError(500, 'TEMPLATE_INVALID', `Shartnoma shablonida qiymati yo‘q maydon bor: ${e.missing.join(', ')}`);
      throw e;
    }
    const body: ContractBody = {
      title: tpl.name, number, version: 1, createdAt: new Date().toISOString(),
      parties: { buyer: { name: buyerName, email: o.buyer.email, phone: o.buyer.phone }, seller: { store: o.store.name, owner: o.store.owner.profile?.fullName ?? o.store.owner.email, region: o.store.region.name } },
      lines, amounts: { subtotal: round2(lines.reduce((s, l) => s + l.total, 0)), discount: num(o.discountAmount), delivery: num(o.deliveryFee), total: num(o.totalAmount), currency: o.currency },
      delivery: { method: DELIVERY_LABEL[o.deliveryMethod ?? 'PICKUP'] ?? '', address: o.deliveryAddress }, payment: { method: PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod }, warrantyDays, clauses,
    };
    const v = await this.renderVersion(body, actorId);
    step('DRAFT', 'PENDING_REVIEW');
    step('PENDING_REVIEW', 'WAITING_FOR_BUYER'); // order contracts are generated from verified data, so no manual review step
    const c = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({ data: { number, type, status: 'WAITING_FOR_BUYER', orderId, buyerId: o.buyerId, sellerStoreId: o.store.id, expiresAt: new Date(Date.now() + 14 * 86_400_000) } });
      await tx.contractVersion.create({ data: { contractId: created.id, version: 1, body: body as unknown as Prisma.InputJsonValue, pdfKey: v.pdfKey, sha256: v.sha256, createdById: actorId } });
      await this.event(tx, created.id, actorId, 'CREATED_FROM_ORDER', { orderId });
      return created;
    });
    await this.audit.record({ actorId, action: 'CONTRACT_CREATE', entityType: 'contract', entityId: c.id, after: { number, orderId } });
    await this.notifyParties(c.id, 'waiting');
    return c;
  }

  async createManual(user: AuthUser, d: z.infer<typeof contractCreateSchema>) {
    const store = await this.prisma.store.findFirst({ where: { id: d.sellerStoreId, deletedAt: null, status: 'VERIFIED' }, include: { owner: { select: { email: true, profile: { select: { fullName: true } } } }, region: { select: { name: true } } } });
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Do‘kon topilmadi yoki tasdiqlanmagan.');
    let buyerId = user.id;
    let creator: 'BUYER' | 'SELLER' = 'BUYER';
    if (store.ownerId === user.id) {
      creator = 'SELLER';
      if (!d.buyerEmail) throw new AppError(400, 'BUYER_REQUIRED', 'Xaridorning ro‘yxatdan o‘tgan emailini kiriting.');
      const buyer = await this.prisma.user.findUnique({ where: { email: d.buyerEmail }, select: { id: true, status: true } });
      if (!buyer || buyer.status !== 'ACTIVE') throw new AppError(404, 'BUYER_NOT_FOUND', 'Bu email bilan faol foydalanuvchi topilmadi.');
      if (buyer.id === user.id) throw new AppError(400, 'SAME_PARTY', 'Shartnoma tomonlari turli foydalanuvchilar bo‘lishi kerak.');
      buyerId = buyer.id;
    }
    const number = await this.newNumber();
    const c = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({ data: { number, type: d.type, status: 'DRAFT', buyerId, sellerStoreId: store.id } });
      await this.event(tx, created.id, user.id, 'CREATED', { creator });
      return created;
    });
    await this.writeVersion(c.id, 1, d.terms, user.id);
    await this.audit.record({ actorId: user.id, action: 'CONTRACT_CREATE', entityType: 'contract', entityId: c.id, after: { number, type: d.type } });
    return c;
  }

  /** Builds body + PDF for manual contracts. */
  private async writeVersion(contractId: string, version: number, terms: Terms, actorId: string) {
    const c = await this.prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
      include: { buyer: { select: { email: true, phone: true, profile: { select: { fullName: true } } } }, sellerStore: { select: { name: true, region: { select: { name: true } }, owner: { select: { email: true, profile: { select: { fullName: true } } } } } } },
    });
    const tpl = await this.clausesFor(c.type);
    const buyerName = c.buyer.profile?.fullName ?? c.buyer.email;
    let clauses: Clause[];
    try {
      clauses = renderClauses(tpl.clauses, {
        sellerName: c.sellerStore.name, buyerName, goods: terms.subject, total: String(terms.amount === 0 ? '0' : terms.amount), paymentMethod: terms.paymentTerms,
        deliveryMethod: terms.deliveryTerms, deliveryAddress: terms.deliveryAddress, warrantyDays: String(terms.warrantyDays), period: terms.period, number: c.number,
      });
    } catch (e) {
      if (e instanceof TemplateError) throw new AppError(400, 'TEMPLATE_VALUES_MISSING', `Quyidagi maydonlar to‘ldirilmagan: ${e.missing.join(', ')}`);
      throw e;
    }
    clauses = [...clauses, ...terms.extraClauses];
    const body: ContractBody = {
      title: tpl.name, number: c.number, version, createdAt: new Date().toISOString(),
      parties: { buyer: { name: buyerName, email: c.buyer.email, phone: c.buyer.phone }, seller: { store: c.sellerStore.name, owner: c.sellerStore.owner.profile?.fullName ?? c.sellerStore.owner.email, region: c.sellerStore.region.name } },
      lines: [], amounts: { subtotal: terms.amount, discount: 0, delivery: 0, total: terms.amount, currency: 'UZS' },
      delivery: { method: terms.deliveryTerms, address: terms.deliveryAddress }, payment: { method: terms.paymentTerms }, warrantyDays: terms.warrantyDays, clauses,
    };
    const v = await this.renderVersion(body, actorId);
    // the terms are kept next to the rendered body so they can be edited again
    await this.prisma.contractVersion.create({ data: { contractId, version, body: { ...body, terms } as unknown as Prisma.InputJsonValue, pdfKey: v.pdfKey, sha256: v.sha256, createdById: actorId } });
  }

  // ───────────── editing and workflow ─────────────

  /** Manual contracts: edit terms in DRAFT. Every edit creates a NEW version; versions are never modified. */
  async updateTerms(user: AuthUser, id: string, terms: Terms) {
    const { c, role } = await this.party(user, id);
    if (!role) throw new AppError(403, 'FORBIDDEN', 'Faqat shartnoma tomonlari tahrirlashi mumkin.');
    if (c.orderId) throw new AppError(409, 'ORDER_CONTRACT', 'Buyurtma shartnomasining narx va mahsulotlarini o‘zgartirib bo‘lmaydi. Faqat qo‘shimcha bandlar qo‘shish mumkin.');
    if (c.status !== 'DRAFT') throw new AppError(409, 'NOT_DRAFT', 'Shartnomani tahrirlash uchun avval uni "Qoralama" holatiga qaytaring.');
    const last = await this.prisma.contractVersion.findFirst({ where: { contractId: id }, orderBy: { version: 'desc' }, select: { version: true } });
    await this.writeVersion(id, (last?.version ?? 0) + 1, terms, user.id);
    await this.prisma.contractEvent.create({ data: { contractId: id, actorId: user.id, type: 'NEW_VERSION', data: { version: (last?.version ?? 0) + 1 } } });
    return { version: (last?.version ?? 0) + 1 };
  }

  /** Order contracts: only extra clauses can be added (new version, signatures restart). */
  async updateOrderContract(user: AuthUser, id: string, d: z.infer<typeof orderContractTermsSchema>) {
    const { c, role } = await this.party(user, id);
    if (!role || !c.orderId) throw new AppError(403, 'FORBIDDEN', 'Bu amal mumkin emas.');
    if (c.status !== 'DRAFT') throw new AppError(409, 'NOT_DRAFT', 'Avval shartnomani "Qoralama" holatiga qaytaring.');
    const last = await this.prisma.contractVersion.findFirstOrThrow({ where: { contractId: id }, orderBy: { version: 'desc' } });
    const prev = last.body as unknown as ContractBody;
    const EXTRA = 'Qo‘shimcha: ';
    const base = prev.clauses.filter((cl) => !cl.title.startsWith(EXTRA));
    const body: ContractBody = { ...prev, version: last.version + 1, createdAt: new Date().toISOString(), clauses: [...base, ...d.extraClauses.map((cl) => ({ title: EXTRA + cl.title, text: cl.text }))] };
    const v = await this.renderVersion(body, user.id);
    await this.prisma.contractVersion.create({ data: { contractId: id, version: body.version, body: body as unknown as Prisma.InputJsonValue, pdfKey: v.pdfKey, sha256: v.sha256, createdById: user.id } });
    await this.prisma.contractEvent.create({ data: { contractId: id, actorId: user.id, type: 'NEW_VERSION', data: { version: body.version } } });
    return { version: body.version };
  }

  /** Back to DRAFT so the terms can change. Not possible once someone has signed (cancel and create a new one instead). */
  async reopen(user: AuthUser, id: string) {
    const { c, role } = await this.party(user, id);
    if (!role) throw new AppError(403, 'FORBIDDEN', 'Faqat tomonlar.');
    step(c.status as ContractStatus, 'DRAFT');
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({ where: { id }, data: { status: 'DRAFT' } });
      await this.event(tx, id, user.id, 'REOPENED');
    });
    return { status: 'DRAFT' };
  }

  async submit(user: AuthUser, id: string) {
    const { c, role } = await this.party(user, id);
    if (!role) throw new AppError(403, 'FORBIDDEN', 'Faqat tomonlar.');
    step(c.status as ContractStatus, 'PENDING_REVIEW');
    const review = await this.setting<boolean>('contracts.requireReview', false);
    const waiting: ContractStatus = role === 'SELLER' ? 'WAITING_FOR_BUYER' : 'WAITING_FOR_SELLER';
    if (!review) step('PENDING_REVIEW', waiting);
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({ where: { id }, data: { status: review ? 'PENDING_REVIEW' : waiting, expiresAt: new Date(Date.now() + 14 * 86_400_000) } });
      await this.event(tx, id, user.id, 'SUBMITTED', { review });
    });
    if (!review) await this.notifyParties(id, 'waiting', user.id);
    return { status: review ? 'PENDING_REVIEW' : waiting };
  }

  async queue(q: PageQuery) {
    const where = { status: 'PENDING_REVIEW' as const };
    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { sellerStore: { select: { name: true } }, buyer: { select: { email: true } } } }),
      this.prisma.contract.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async decide(user: AuthUser, id: string, d: z.infer<typeof contractDecisionSchema>) {
    const c = await this.prisma.contract.findUnique({ where: { id } });
    if (!c) throw new AppError(404, 'NOT_FOUND', 'Shartnoma topilmadi.');
    const created = await this.prisma.contractEvent.findFirst({ where: { contractId: id, type: 'SUBMITTED' }, orderBy: { createdAt: 'desc' }, select: { actorId: true } });
    const submitterIsSeller = created?.actorId ? (await this.prisma.store.count({ where: { id: c.sellerStoreId, ownerId: created.actorId } })) > 0 : true;
    const to: ContractStatus = d.action === 'REJECT' ? 'DRAFT' : submitterIsSeller ? 'WAITING_FOR_BUYER' : 'WAITING_FOR_SELLER';
    step(c.status as ContractStatus, to);
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({ where: { id }, data: { status: to } });
      await this.event(tx, id, user.id, `REVIEW_${d.action}`, { reason: d.reason });
      await tx.moderationAction.create({ data: { moderatorId: user.id, targetType: 'CONTRACT', targetId: id, action: d.action, reason: d.reason } });
    });
    await this.audit.record({ actorId: user.id, action: `CONTRACT_REVIEW_${d.action}`, entityType: 'contract', entityId: id, after: { reason: d.reason } });
    await this.notifyParties(id, d.action === 'APPROVE' ? 'waiting' : 'rejected', user.id, d.reason);
    return { status: to };
  }

  async cancel(user: AuthUser, id: string, reason: string) {
    const { c, role } = await this.party(user, id);
    if (!role) throw new AppError(403, 'FORBIDDEN', 'Faqat tomonlar.');
    step(c.status as ContractStatus, 'CANCELLED');
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({ where: { id }, data: { status: 'CANCELLED' } });
      await this.event(tx, id, user.id, 'CANCELLED', { reason });
    });
    await this.audit.record({ actorId: user.id, action: 'CONTRACT_CANCEL', entityType: 'contract', entityId: id, after: { reason } });
    return { status: 'CANCELLED' };
  }

  // ───────────── signing (E-IMZO) ─────────────

  eimzoStatus() {
    return this.eimzo.status();
  }

  /** What the web app needs to start signing: the exact document hash. */
  async signingInfo(user: AuthUser, id: string) {
    const { c, role } = await this.party(user, id);
    if (!role) throw new AppError(403, 'FORBIDDEN', 'Faqat tomonlar imzolaydi.');
    const v = await this.prisma.contractVersion.findFirstOrThrow({ where: { contractId: id }, orderBy: { version: 'desc' }, include: { signatures: { select: { partyRole: true } } } });
    return { contractId: id, status: c.status, version: v.version, documentSha256: v.sha256, myRole: role, alreadySigned: v.signatures.some((s) => s.partyRole === role), eimzo: this.eimzo.status(), demoSigning: this.env.DEMO_SIGNING === 'enabled' };
  }

  async sign(user: AuthUser, id: string, d: z.infer<typeof signSchema>) {
    const { c, role } = await this.party(user, id);
    if (!role) throw new AppError(403, 'FORBIDDEN', 'Faqat tomonlar imzolaydi.');
    if (!WAITING.includes(c.status as ContractStatus)) throw new AppError(409, 'NOT_SIGNABLE', 'Shartnoma hozir imzolash holatida emas.');
    const v = await this.prisma.contractVersion.findFirstOrThrow({ where: { contractId: id }, orderBy: { version: 'desc' }, include: { signatures: true } });
    if (v.signatures.some((s) => s.partyRole === role)) throw new AppError(409, 'ALREADY_SIGNED', 'Siz bu versiyani allaqachon imzolagansiz.');
    const file = v.pdfKey ? await this.storage.get(v.pdfKey) : null;
    if (!file) throw new AppError(500, 'DOCUMENT_MISSING', 'Shartnoma PDF fayli topilmadi.');
    const bytes = Buffer.from(file.data);
    if (file.sha256 !== v.sha256) throw new AppError(500, 'DOCUMENT_TAMPERED', 'Shartnoma fayli hash mos kelmadi. Imzolash to‘xtatildi.');

    // Throws 503/501 while E-IMZO is not configured: nothing is ever recorded as signed in that case.
    const check = await this.eimzo.verify({ documentSha256: v.sha256, documentBytes: bytes, pkcs7: Buffer.from(d.pkcs7Base64, 'base64') });
    if (!check.valid) {
      await this.prisma.contractEvent.create({ data: { contractId: id, actorId: user.id, type: 'SIGN_REJECTED', data: { role } } });
      throw new AppError(400, 'SIGNATURE_INVALID', 'Imzo tekshiruvdan o‘tmadi.');
    }
    if (check.certValidTo && check.certValidTo < new Date()) throw new AppError(400, 'CERTIFICATE_EXPIRED', 'Imzo sertifikati muddati tugagan.');

    await this.commitSignature(user, c, role, v, {
      signatureBlob: Buffer.from(d.pkcs7Base64, 'base64'), provider: 'EIMZO', certSerial: check.certSerial, certSubject: check.certSubject, certValidFrom: check.certValidFrom, certValidTo: check.certValidTo, timestampToken: check.timestampToken, verificationDetail: (check.detail ?? {}) as Prisma.InputJsonValue,
    });
    await this.audit.record({ actorId: user.id, action: 'CONTRACT_SIGN', entityType: 'contract', entityId: id, after: { role, version: v.version } });
    const after = await this.prisma.contract.findUniqueOrThrow({ where: { id }, select: { status: true } });
    await this.notifyParties(id, after.status === 'ACTIVE' ? 'signed' : 'waiting', user.id);
    return { status: after.status };
  }

  private async commitSignature(
    user: AuthUser,
    c: { id: string; status: string },
    role: 'BUYER' | 'SELLER',
    v: { id: string; version: number; sha256: string; signatures: unknown[] },
    sig: { signatureBlob: Buffer; provider: 'EIMZO' | 'DEMO_SIMPLE'; certSerial?: string | null; certSubject?: string | null; certValidFrom?: Date | null; certValidTo?: Date | null; timestampToken?: Buffer | null; verificationDetail: Prisma.InputJsonValue },
  ) {
    const id = c.id;
    await this.prisma.$transaction(async (tx) => {
      await tx.contractSignature.create({
        data: { contractId: id, versionId: v.id, signerId: user.id, partyRole: role, provider: sig.provider, signedDocSha256: v.sha256, signatureBlob: sig.signatureBlob, certSerial: sig.certSerial ?? undefined, certSubject: sig.certSubject ?? undefined, certValidFrom: sig.certValidFrom ?? undefined, certValidTo: sig.certValidTo ?? undefined, timestampToken: sig.timestampToken ?? undefined, verification: 'VALID', verificationDetail: sig.verificationDetail, verifiedAt: new Date() },
      });
      const count = v.signatures.length + 1;
      let status = c.status as ContractStatus;
      if (count === 1) {
        step(status, 'PARTIALLY_SIGNED');
        status = 'PARTIALLY_SIGNED';
      } else {
        if (status !== 'PARTIALLY_SIGNED') { step(status, 'PARTIALLY_SIGNED'); status = 'PARTIALLY_SIGNED'; }
        step(status, 'FULLY_SIGNED');
        step('FULLY_SIGNED', 'ACTIVE');
        status = 'ACTIVE';
      }
      await tx.contract.update({ where: { id }, data: { status, ...(count >= 2 ? { signedAt: new Date() } : {}) } });
      await this.event(tx, id, user.id, 'SIGNED', { role, version: v.version, provider: sig.provider, certSerial: sig.certSerial ?? null });
    });
  }

  /**
   * DEMO simple electronic signature. Each person signs for themselves: they must re-enter their own account password (identity check)
   * and tick the consent box. We store who, when, from which device/IP, and an HMAC receipt over (contract, version, signer, role, document hash, time).
   * It is clearly labelled DEMO_SIMPLE everywhere and is NOT an E-IMZO (qualified) signature. Only works when DEMO_SIGNING=enabled.
   */
  async signDemo(user: AuthUser, id: string, d: z.infer<typeof demoSignSchema>, ctx: { ip?: string; userAgent?: string }) {
    if (this.env.DEMO_SIGNING !== 'enabled') throw new AppError(503, 'DEMO_SIGNING_DISABLED', 'Demo imzo yoqilmagan.');
    const { c, role } = await this.party(user, id);
    if (!role) throw new AppError(403, 'FORBIDDEN', 'Faqat tomonlar imzolaydi.');
    if (!WAITING.includes(c.status as ContractStatus)) throw new AppError(409, 'NOT_SIGNABLE', 'Shartnoma hozir imzolash holatida emas.');
    const v = await this.prisma.contractVersion.findFirstOrThrow({ where: { contractId: id }, orderBy: { version: 'desc' }, include: { signatures: true } });
    if (v.signatures.some((s) => s.partyRole === role)) throw new AppError(409, 'ALREADY_SIGNED', 'Siz bu versiyani allaqachon imzolagansiz.');
    const file = v.pdfKey ? await this.storage.get(v.pdfKey) : null;
    if (!file) throw new AppError(500, 'DOCUMENT_MISSING', 'Shartnoma PDF fayli topilmadi.');
    if (file.sha256 !== v.sha256) throw new AppError(500, 'DOCUMENT_TAMPERED', 'Shartnoma fayli hash mos kelmadi. Imzolash to‘xtatildi.');

    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, email: true, profile: { select: { fullName: true } } } });
    const okPass = await argonVerify(me.passwordHash, d.password).catch(() => false);
    if (!okPass) {
      await this.prisma.contractEvent.create({ data: { contractId: id, actorId: user.id, type: 'SIGN_REJECTED', data: { role, reason: 'wrong_password' } } });
      throw new AppError(400, 'WRONG_PASSWORD', 'Parol noto‘g‘ri. Imzo qo‘yilmadi.');
    }
    const signedAt = new Date();
    const receipt = createHmac('sha256', createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? '').update('demo-sign-v1').digest())
      .update([id, v.id, user.id, role, v.sha256, signedAt.toISOString()].join('|')).digest();
    await this.commitSignature(user, c, role, v, {
      signatureBlob: receipt, provider: 'DEMO_SIMPLE', certSubject: `${me.profile?.fullName ?? me.email} <${me.email}>`,
      verificationDetail: { level: 'DEMO_SIMPLE', method: 'account_password_reenter', consent: true, signedAt: signedAt.toISOString(), ip: ctx.ip ?? null, userAgent: (ctx.userAgent ?? '').slice(0, 200), receiptHmacSha256: receipt.toString('hex'), notEimzo: true },
    });
    await this.audit.record({ actorId: user.id, action: 'CONTRACT_SIGN', entityType: 'contract', entityId: id, after: { role, version: v.version, provider: 'DEMO_SIMPLE' } });
    const after = await this.prisma.contract.findUniqueOrThrow({ where: { id }, select: { status: true } });
    await this.notifyParties(id, after.status === 'ACTIVE' ? 'signed' : 'waiting', user.id);
    return { status: after.status };
  }

  // ───────────── reading ─────────────

  async list(user: AuthUser, q: PageQuery & { as: 'buyer' | 'seller'; status?: ContractStatus; archive: boolean }) {
    const staff = isStaff(user.roles); // moderators and Super Admin oversee every contract (read-only; they are never a party)
    const where: Prisma.ContractWhereInput = {
      ...(staff ? {} : q.as === 'buyer' ? { buyerId: user.id } : { sellerStore: { ownerId: user.id } }),
      ...(q.archive ? { status: { in: ['FULLY_SIGNED', 'ACTIVE', 'COMPLETED'] as ContractStatus[] } } : q.status ? { status: q.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.contract.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { sellerStore: { select: { name: true } }, buyer: { select: { email: true, profile: { select: { fullName: true } } } }, order: { select: { number: true } }, _count: { select: { signatures: true } } } }),
      this.prisma.contract.count({ where }),
    ]);
    return paged(rows.map((c) => ({ id: c.id, number: c.number, type: c.type, status: c.status, storeName: c.sellerStore.name, buyerName: c.buyer.profile?.fullName ?? c.buyer.email, orderNumber: c.order?.number ?? null, signatures: c._count.signatures, signedAt: c.signedAt, expiresAt: c.expiresAt, updatedAt: c.updatedAt })), total, q);
  }

  async detail(user: AuthUser, id: string) {
    const { c, role } = await this.party(user, id);
    const [versions, events, order] = await Promise.all([
      this.prisma.contractVersion.findMany({ where: { contractId: id }, orderBy: { version: 'desc' }, include: { signatures: { select: { id: true, partyRole: true, certSubject: true, certSerial: true, certValidTo: true, verification: true, signedAt: true } } } }),
      this.prisma.contractEvent.findMany({ where: { contractId: id }, orderBy: { createdAt: 'asc' } }),
      c.orderId ? this.prisma.order.findUnique({ where: { id: c.orderId }, select: { id: true, number: true, status: true } }) : null,
    ]);
    const latest = versions[0]!;
    const signedByMe = role ? latest.signatures.some((s) => s.partyRole === role) : false;
    return {
      id: c.id, number: c.number, type: c.type, status: c.status, expiresAt: c.expiresAt, signedAt: c.signedAt, myRole: role ?? 'staff', order,
      body: latest.body, version: latest.version, documentSha256: latest.sha256,
      versions: versions.map((v) => ({ version: v.version, sha256: v.sha256, createdAt: v.createdAt, signatures: v.signatures })),
      events, eimzo: this.eimzo.status(),
      actions: {
        canEdit: !!role && c.status === 'DRAFT',
        canSubmit: !!role && c.status === 'DRAFT' && !c.orderId,
        canReopen: !!role && ['WAITING_FOR_BUYER', 'WAITING_FOR_SELLER'].includes(c.status),
        canSign: !!role && WAITING.includes(c.status as ContractStatus) && !signedByMe,
        canCancel: !!role && ['DRAFT', 'PENDING_REVIEW', 'WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'PARTIALLY_SIGNED', 'ACTIVE'].includes(c.status),
      },
    };
  }

  async pdf(user: AuthUser, id: string, version?: number) {
    await this.party(user, id);
    const v = await this.prisma.contractVersion.findFirst({ where: { contractId: id, ...(version ? { version } : {}) }, orderBy: { version: 'desc' } });
    const f = v?.pdfKey ? await this.storage.get(v.pdfKey) : null;
    if (!v || !f) throw new AppError(404, 'NOT_FOUND', 'Hujjat topilmadi.');
    return { bytes: Buffer.from(f.data), name: `${(await this.prisma.contract.findUniqueOrThrow({ where: { id }, select: { number: true } })).number}-v${v.version}.pdf` };
  }

  /** Archive package: PDF hash + every signature (PKCS#7) so the signatures can be verified later outside this system. */
  async bundle(user: AuthUser, id: string) {
    const { c } = await this.party(user, id);
    if (!['FULLY_SIGNED', 'ACTIVE', 'COMPLETED'].includes(c.status)) throw new AppError(409, 'NOT_SIGNED', 'Faqat to‘liq imzolangan shartnoma arxivlanadi.');
    const v = await this.prisma.contractVersion.findFirstOrThrow({ where: { contractId: id, signatures: { some: {} } }, orderBy: { version: 'desc' }, include: { signatures: true } });
    return {
      contractNumber: c.number, version: v.version, documentSha256: v.sha256, pdfFileId: v.pdfKey,
      signatures: v.signatures.map((s) => ({ role: s.partyRole, provider: s.provider, certSerial: s.certSerial, certSubject: s.certSubject, certValidFrom: s.certValidFrom, certValidTo: s.certValidTo, signedAt: s.signedAt, verification: s.verification, pkcs7Base64: s.signatureBlob ? Buffer.from(s.signatureBlob).toString('base64') : null })),
    };
  }

  async isSigned(orderId: string): Promise<boolean> {
    const c = await this.prisma.contract.findUnique({ where: { orderId }, select: { status: true } });
    return !!c && ['FULLY_SIGNED', 'ACTIVE', 'COMPLETED'].includes(c.status);
  }

  async forOrder(user: AuthUser, orderId: string) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, OR: [{ buyerId: user.id }, { store: { ownerId: user.id } }] }, select: { id: true, status: true } });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    if (['CREATED', 'CANCELLED'].includes(o.status)) throw new AppError(409, 'TOO_EARLY', 'Shartnoma buyurtma tasdiqlangandan keyin yaratiladi.');
    const c = await this.createForOrder(orderId, user.id); // idempotent: also repairs an order whose contract failed to generate
    return { id: c.id };
  }

  async cancelForOrder(orderId: string, actorId: string) {
    const c = await this.prisma.contract.findUnique({ where: { orderId } });
    if (!c || !['DRAFT', 'PENDING_REVIEW', 'WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'PARTIALLY_SIGNED', 'ACTIVE'].includes(c.status)) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({ where: { id: c.id }, data: { status: 'CANCELLED' } });
      await this.event(tx, c.id, actorId, 'CANCELLED', { reason: 'Buyurtma bekor qilindi' });
    });
  }

  async completeForOrder(orderId: string, actorId: string) {
    const c = await this.prisma.contract.findUnique({ where: { orderId } });
    if (!c || c.status !== 'ACTIVE') return;
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({ where: { id: c.id }, data: { status: 'COMPLETED' } });
      await this.event(tx, c.id, actorId, 'COMPLETED');
    });
  }

  /** Delivery / acceptance act for a delivered order. Generated on demand from recorded platform events. */
  async deliveryAct(user: AuthUser, orderId: string) {
    const o = await this.prisma.order.findFirst({
      where: { id: orderId, OR: [{ buyerId: user.id }, { store: { ownerId: user.id } }] },
      include: { store: { select: { name: true } }, buyer: { select: { email: true, profile: { select: { fullName: true } } } }, delivery: true, items: { include: { product: { select: { name: true } }, unit: { select: { code: true } } } } },
    });
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Buyurtma topilmadi.');
    if (!['DELIVERED', 'ACCEPTED', 'COMPLETED', 'DISPUTED'].includes(o.status) || !o.delivery?.deliveredAt) throw new AppError(409, 'NOT_DELIVERED', 'Dalolatnoma buyurtma topshirilgandan keyin shakllanadi.');
    const data: DeliveryActData = {
      number: `DA-${o.number}`, orderNumber: o.number, seller: o.store.name, buyer: o.buyer.profile?.fullName ?? o.buyer.email, address: o.deliveryAddress, method: DELIVERY_LABEL[o.deliveryMethod ?? 'PICKUP'] ?? '',
      deliveredAt: o.delivery.deliveredAt.toISOString(), acceptedAt: o.delivery.acceptedAt?.toISOString() ?? null, carrier: o.delivery.carrier, trackingRef: o.delivery.trackingRef,
      lines: o.items.map((i) => ({ name: i.product.name, quantity: num(i.quantity), unit: i.unit.code })),
    };
    return { bytes: Buffer.from(await buildDeliveryActPdf(data)), name: `${data.number}.pdf` };
  }

  // ───────────── notifications ─────────────

  private async notifyParties(contractId: string, kind: 'waiting' | 'signed' | 'rejected', exceptUserId?: string, note?: string) {
    const c = await this.prisma.contract.findUnique({ where: { id: contractId }, include: { sellerStore: { select: { ownerId: true } } } });
    if (!c) return;
    const targets = [c.buyerId, c.sellerStore.ownerId].filter((u) => u !== exceptUserId);
    for (const uid of targets) {
      await this.notif.notify(
        uid,
        { type: kind === 'signed' ? 'CONTRACT_SIGNED' : kind === 'rejected' ? 'CONTRACT_REJECTED' : 'CONTRACT_WAITING', title: kind === 'signed' ? `Shartnoma imzolandi ${c.number}` : kind === 'rejected' ? `Shartnoma qaytarildi ${c.number}` : `Shartnoma imzo kutmoqda ${c.number}`, body: note ?? 'Shartnomani ko‘rib chiqing.', url: `/contracts/${c.id}` },
        { email: { template: 'contract', data: { contractNumber: c.number, status: kind === 'signed' ? 'signed' : 'waiting', url: `/contracts/${c.id}` } } },
      );
    }
  }
}
