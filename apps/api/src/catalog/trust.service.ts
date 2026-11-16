import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { num } from '../common/util';
import { median } from '../domain/pricing';
import { TrustResult, computeTrust } from '../domain/trust';
import { PrismaService } from '../prisma/prisma.service';

/** Collects the real evidence for a price record and runs the pure trust rules. Nothing is guessed. */
@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService) {}

  /** Approved, live, same-unit prices of the product in the same region: the reference for "regional fit". */
  async regionReference(productId: string, regionId: string, unitId: string, excludeId?: string): Promise<{ median: number | undefined; count: number }> {
    const rows = await this.prisma.priceRecord.findMany({
      where: { productId, regionId, unitId, variantId: null, moderationStatus: 'APPROVED', deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { price: true },
    });
    const m = rows.length >= 2 ? median(rows.map((r) => num(r.price))) : null; // one data point is not a reference
    return { median: m ?? undefined, count: rows.length };
  }

  async assess(priceRecordId: string, persist = true): Promise<TrustResult | null> {
    const r = await this.prisma.priceRecord.findUnique({
      where: { id: priceRecordId },
      include: { store: { select: { status: true } }, _count: { select: { evidence: true } } },
    });
    if (!r) return null;

    const [ref, history, confirmations] = await Promise.all([
      this.regionReference(r.productId, r.regionId, r.unitId, r.id),
      this.prisma.priceHistory.count({ where: { productId: r.productId, regionId: r.regionId } }),
      this.prisma.priceRecord.count({
        where: {
          id: { not: r.id },
          productId: r.productId,
          regionId: r.regionId,
          unitId: r.unitId,
          variantId: r.variantId,
          storeId: { not: r.storeId },
          moderationStatus: 'APPROVED',
          deletedAt: null,
          updatedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
          price: { gte: new Prisma.Decimal(num(r.price) * 0.9), lte: new Prisma.Decimal(num(r.price) * 1.1) },
        },
      }),
    ]);

    const result = computeTrust({
      price: num(r.price),
      sellerVerified: r.store.status === 'VERIFIED',
      ageHours: (Date.now() - r.confirmedAt.getTime()) / 3_600_000,
      hasPhotoEvidence: r._count.evidence > 0,
      independentConfirmations: confirmations,
      historyPoints: history,
      regionMedian: ref.median,
      moderation: r.moderationStatus,
    });

    if (persist) {
      await this.prisma.trustAssessment.create({
        data: { priceRecordId, status: result.status, score: result.score, factors: result.factors as Prisma.InputJsonValue },
      });
    }
    return result;
  }
}
