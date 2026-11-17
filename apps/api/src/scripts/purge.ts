// Shared, careful deletion of users together with everything that hangs off them. Used by the demo cleanup and by prune-users.
// Contracts are append-only legal records: if any exist for the scope, nothing is deleted and an error is thrown.
import { PrismaClient } from '@prisma/client';

export interface PurgeScope { uid: string[]; sid: string[]; oid: string[] }

export async function purge(prisma: PrismaClient, { uid, sid, oid }: PurgeScope): Promise<void> {
  const prices = await prisma.priceRecord.findMany({ where: { storeId: { in: sid } }, select: { id: true } });
  const pid = prices.map((p) => p.id);
  const contracts = await prisma.contract.count({ where: { OR: [{ orderId: { in: oid } }, { buyerId: { in: uid } }, { sellerStoreId: { in: sid } }] } });
  if (contracts > 0) throw new Error(`${contracts} contract(s) exist; contracts are append-only and are not deleted. Nothing was changed.`);
  await prisma.complaint.deleteMany({ where: { filedById: { in: uid } } });
  await prisma.review.deleteMany({ where: { OR: [{ storeId: { in: sid } }, { authorId: { in: uid } }] } });
  await prisma.message.deleteMany({ where: { OR: [{ conversation: { storeId: { in: sid } } }, { conversation: { buyerId: { in: uid } } }, { senderId: { in: uid } }] } });
  await prisma.conversation.deleteMany({ where: { OR: [{ storeId: { in: sid } }, { buyerId: { in: uid } }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: uid } } });
  await prisma.favorite.deleteMany({ where: { userId: { in: uid } } });
  await prisma.priceAlert.deleteMany({ where: { userId: { in: uid } } });
  await prisma.offer.deleteMany({ where: { OR: [{ storeId: { in: sid } }, { buyerId: { in: uid } }] } });
  await prisma.payment.deleteMany({ where: { orderId: { in: oid } } });
  await prisma.delivery.deleteMany({ where: { orderId: { in: oid } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: oid } } });
  await prisma.order.deleteMany({ where: { id: { in: oid } } });
  await prisma.discount.deleteMany({ where: { storeId: { in: sid } } });
  await prisma.stockMovement.deleteMany({ where: { priceRecordId: { in: pid } } });
  await prisma.priceHistory.deleteMany({ where: { priceRecordId: { in: pid } } });
  await prisma.priceRecord.deleteMany({ where: { id: { in: pid } } });
  await prisma.product.deleteMany({ where: { createdById: { in: uid } } });
  await prisma.store.deleteMany({ where: { id: { in: sid } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: uid } } });
  await prisma.user.deleteMany({ where: { id: { in: uid } } });
}
