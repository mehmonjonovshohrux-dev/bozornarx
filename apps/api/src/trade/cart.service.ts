import { Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { num } from '../common/util';
import { orderTotals, round2, unitPriceFor } from '../domain/pricing';
import { normalize } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async cartId(userId: string): Promise<string> {
    const c = await this.prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
    return c.id;
  }

  /** A price record a buyer may order from right now. */
  async assertOrderable(priceRecordId: string, quantity: number) {
    const r = await this.prisma.priceRecord.findFirst({
      where: { id: priceRecordId, moderationStatus: 'APPROVED', deletedAt: null, store: { status: 'VERIFIED', deletedAt: null } },
      include: { store: { select: { id: true, ownerId: true, name: true } }, product: { select: { id: true, name: true, status: true } }, unit: true, variant: { include: { unit: true } } },
    });
    if (!r || r.product.status !== 'APPROVED') throw new AppError(404, 'NOT_FOUND', 'Bu taklif mavjud emas yoki sotuvdan olingan.');
    if (r.availability === 'OUT_OF_STOCK') throw new AppError(409, 'OUT_OF_STOCK', 'Mahsulot qolmagan.');
    if (r.quantityAvailable !== null && quantity > num(r.quantityAvailable)) throw new AppError(409, 'INSUFFICIENT_STOCK', `Omborda faqat ${num(r.quantityAvailable)} ${r.unit.code} bor.`, { available: num(r.quantityAvailable) });
    return r;
  }

  async add(user: AuthUser, d: { priceRecordId: string; quantity: number }) {
    const r = await this.assertOrderable(d.priceRecordId, d.quantity);
    if (r.store.ownerId === user.id) throw new AppError(400, 'OWN_STORE', 'O‘z do‘koningizdan buyurtma bera olmaysiz.');
    const cartId = await this.cartId(user.id);
    const existing = await this.prisma.cartItem.findUnique({ where: { cartId_priceRecordId: { cartId, priceRecordId: d.priceRecordId } } });
    const quantity = (existing ? num(existing.quantity) : 0) + d.quantity;
    if (r.quantityAvailable !== null && quantity > num(r.quantityAvailable)) throw new AppError(409, 'INSUFFICIENT_STOCK', `Omborda faqat ${num(r.quantityAvailable)} ${r.unit.code} bor.`);
    await this.prisma.cartItem.upsert({ where: { cartId_priceRecordId: { cartId, priceRecordId: d.priceRecordId } }, create: { cartId, priceRecordId: d.priceRecordId, quantity }, update: { quantity } });
    return this.get(user);
  }

  async update(user: AuthUser, itemId: string, quantity: number) {
    const cartId = await this.cartId(user.id);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Savatdagi mahsulot topilmadi.');
    await this.assertOrderable(item.priceRecordId, quantity);
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.get(user);
  }

  async remove(user: AuthUser, itemId: string) {
    const cartId = await this.cartId(user.id);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
    return this.get(user);
  }

  async clear(user: AuthUser) {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
    return { items: [], stores: [] };
  }

  /** Cart grouped by store. Prices are always the CURRENT ones (wholesale tiers applied), not what was seen earlier. */
  async get(user: AuthUser) {
    const cart = await this.prisma.cart.findUnique({ where: { userId: user.id }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    const items = cart?.items ?? [];
    const recs = await this.prisma.priceRecord.findMany({
      where: { id: { in: items.map((i) => i.priceRecordId) } },
      include: { store: { select: { id: true, name: true } }, product: { select: { id: true, name: true, slug: true } }, unit: true, variant: { include: { unit: true } } },
    });
    const tiers = await this.prisma.wholesaleTier.findMany({ where: { priceRecordId: { in: recs.map((r) => r.id) } } });
    const byRec = new Map(recs.map((r) => [r.id, r]));
    const lines = items.flatMap((i) => {
      const r = byRec.get(i.priceRecordId);
      if (!r) return [];
      const q = num(i.quantity);
      const base = normalize(r).effectivePrice;
      const unitPrice = round2(unitPriceFor(base, q, tiers.filter((t) => t.priceRecordId === r.id).map((t) => ({ minQuantity: num(t.minQuantity), unitPrice: num(t.unitPrice) }))));
      const available = r.moderationStatus === 'APPROVED' && !r.deletedAt && r.availability !== 'OUT_OF_STOCK' && (r.quantityAvailable === null || q <= num(r.quantityAvailable));
      return [{ id: i.id, priceRecordId: r.id, product: r.product, variant: r.variant?.name ?? null, unit: r.unit.code, store: r.store, quantity: q, unitPrice, lineTotal: round2(q * unitPrice), available }];
    });
    const stores = [...new Set(lines.map((l) => l.store.id))].map((sid) => {
      const ls = lines.filter((l) => l.store.id === sid);
      return { store: ls[0]!.store, ...orderTotals(ls), allAvailable: ls.every((l) => l.available), lineIds: ls.map((l) => l.id) };
    });
    return { items: lines, stores };
  }
}
