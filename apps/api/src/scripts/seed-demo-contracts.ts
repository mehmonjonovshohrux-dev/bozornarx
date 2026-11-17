// DEMO: contracts for the demo orders, created and signed through the REAL service code (same PDF, hash and signature flow users get).
//   Needs: DEMO_SIGNING=enabled, DEMO_PASSWORD (the same one the demo accounts use). Idempotent: orders that already have a contract are skipped.
// Result: every contract state is visible: unsigned, signed by one party, fully signed (active), and completed.
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../app.module';
import { ContractsService } from '../contracts/contracts.service';

// order number -> who has signed (buyer first, then seller)
const PLAN: Record<string, Array<'BUYER' | 'SELLER'>> = {
  '0001': ['BUYER', 'SELLER'], '0002': ['BUYER', 'SELLER'], '0003': ['BUYER', 'SELLER'], '0010': ['BUYER', 'SELLER'], '0011': ['BUYER', 'SELLER'], '0012': ['BUYER', 'SELLER'], '0016': ['BUYER', 'SELLER'],
  '0004': ['BUYER', 'SELLER'], '0013': ['BUYER', 'SELLER'],
  '0005': ['BUYER'], '0014': ['BUYER'], '0006': ['SELLER'], '0015': [],
};

async function main() {
  if (process.env.DEMO_SIGNING !== 'enabled') throw new Error('DEMO_SIGNING=enabled is required');
  const password = process.env.DEMO_PASSWORD ?? '';
  if (password.length < 12) throw new Error('DEMO_PASSWORD is required');
  const prisma = new PrismaClient();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const contracts = app.get(ContractsService, { strict: false });
    let made = 0;
    for (const [n, signers] of Object.entries(PLAN)) {
      const order = await prisma.order.findUnique({ where: { number: `ORD-DEMO-${n}` }, include: { store: { select: { ownerId: true } }, contract: { select: { id: true } } } });
      if (!order) continue;
      if (order.contract) {
        // A contract from an earlier seed: make its parties match the order (demo data only).
        await prisma.contract.update({ where: { id: order.contract.id }, data: { buyerId: order.buyerId, sellerStoreId: order.storeId } });
        continue;
      }
      const c = await contracts.createForOrder(order.id, order.store.ownerId);
      for (const role of signers) {
        const uid = role === 'BUYER' ? order.buyerId : order.store.ownerId;
        await contracts.signDemo({ id: uid, roles: [role === 'BUYER' ? 'BUYER' : 'SELLER'], sessionId: 'demo-seed' }, c.id, { password, agree: true }, { ip: '127.0.0.1', userAgent: 'demo-seed' });
      }
      if (order.status === 'COMPLETED' && signers.length === 2) await prisma.contract.update({ where: { id: c.id }, data: { status: 'COMPLETED' } });
      made++;
    }
    console.log(`demo contracts ready: ${made} new (others already existed)`);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().then(() => process.exit(0)).catch((e: unknown) => {
  console.error('seed-demo-contracts failed:', e instanceof Error ? e.message : 'unknown error');
  process.exit(1);
});
