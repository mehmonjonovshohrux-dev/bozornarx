import { Injectable } from '@nestjs/common';
import { num } from '../common/util';
import { alertTriggered, round2 } from '../domain/pricing';
import { UNITS, baseUnitCode } from '../domain/units';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalize } from './catalog.service';
import { RegionsService } from './regions.service';

const COOLDOWN_MS = 6 * 3_600_000; // the same alert is not repeated more than once per 6 hours

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService, private readonly notif: NotificationsService, private readonly regions: RegionsService) {}

  /** Call after a price becomes visible (approved / changed). Compares the new price with every active alert of the product. */
  async onPriceVisible(priceRecordId: string): Promise<void> {
    const r = await this.prisma.priceRecord.findUnique({
      where: { id: priceRecordId },
      include: { product: { select: { name: true, slug: true } }, unit: true, variant: { include: { unit: true } } },
    });
    if (!r || r.moderationStatus !== 'APPROVED' || r.deletedAt) return;
    const n = normalize(r);
    if (n.perBase === null || !n.baseUnit) return;

    const alerts = await this.prisma.priceAlert.findMany({ where: { productId: r.productId, active: true } });
    for (const a of alerts) {
      if (a.lastTriggeredAt && Date.now() - a.lastTriggeredAt.getTime() < COOLDOWN_MS) continue;
      if (baseUnitCode(a.unitCode) !== n.baseUnit) continue; // different dimension: cannot compare
      if (a.regionId && !(await this.regions.withDescendants(a.regionId)).includes(r.regionId)) continue;
      const perAlertUnit = round2(n.perBase * (UNITS[a.unitCode]?.toBase ?? 1));
      if (!alertTriggered(a.direction, num(a.targetPrice), perAlertUnit)) continue;
      await this.prisma.priceAlert.update({ where: { id: a.id }, data: { lastTriggeredAt: new Date() } });
      const wantsEmail = a.channels.includes('EMAIL');
      await this.notif.notify(
        a.userId,
        {
          type: 'PRICE_DROP',
          title: `${r.product.name}: narx ${a.direction === 'BELOW' ? 'tushdi' : 'oshdi'}`,
          body: `${perAlertUnit.toLocaleString('uz-UZ')} so‘m/${a.unitCode} (maqsad: ${num(a.targetPrice).toLocaleString('uz-UZ')})`,
          data: { productId: r.productId, priceRecordId: r.id },
          url: `/catalog/${r.product.slug}`,
        },
        {
          skipPush: !a.channels.includes('PUSH'),
          email: wantsEmail ? { template: 'price_alert', data: { product: r.product.name, price: String(perAlertUnit), unit: a.unitCode, target: String(num(a.targetPrice)), url: `/catalog/${r.product.slug}` } } : undefined,
        },
      );
    }
  }
}
