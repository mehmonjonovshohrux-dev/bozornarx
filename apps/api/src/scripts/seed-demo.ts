// DEMO DATA — never part of the normal deploy. Run only on a throw-away database to see the platform with content:
//   ALLOW_DEMO_SEED=yes DEMO_PASSWORD='<choose one>' npm run seed:demo
// Every record created here is tagged (emails end with @demo.bozornarx.invalid, store names start with "[DEMO]"),
// so `DEMO_CLEANUP=yes npm run seed:demo` removes exactly these rows and nothing else.
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const DOMAIN = '@demo.bozornarx.invalid';

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== 'yes') throw new Error('Refusing to run: set ALLOW_DEMO_SEED=yes (never on the production database).');
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'yes') throw new Error('Refusing to seed demo data with NODE_ENV=production.');
  const prisma = new PrismaClient();
  try {
    if (process.env.DEMO_CLEANUP === 'yes') {
      const users = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
      const stores = await prisma.store.findMany({ where: { name: { startsWith: '[DEMO]' } }, select: { id: true } });
      const sid = stores.map((s) => s.id);
      await prisma.priceHistory.deleteMany({ where: { priceRecord: { storeId: { in: sid } } } });
      await prisma.priceRecord.deleteMany({ where: { storeId: { in: sid } } });
      await prisma.store.deleteMany({ where: { id: { in: sid }, orders: { none: {} }, contracts: { none: {} }, conversations: { none: {} } } });
      await prisma.product.deleteMany({ where: { createdById: { in: users.map((u) => u.id) }, priceRecords: { none: {} }, orderItems: { none: {} } } });
      console.log(`cleanup done (stores matched: ${sid.length}); users with orders/contracts are kept — remove them by hand if needed`);
      return;
    }
    const password = process.env.DEMO_PASSWORD ?? '';
    if (password.length < 12) throw new Error('DEMO_PASSWORD (min 12 chars) is required; demo accounts get no built-in password.');
    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const role = async (name: string) => (await prisma.role.findUniqueOrThrow({ where: { name } })).id;
    const mk = async (local: string, fullName: string, r: string) => prisma.user.upsert({
      where: { email: `${local}${DOMAIN}` }, update: {},
      create: { email: `${local}${DOMAIN}`, passwordHash, status: 'ACTIVE', emailVerifiedAt: new Date(), profile: { create: { fullName } }, roles: { create: { roleId: await role(r) } } },
    });
    const seller = await mk('seller', 'Demo Sotuvchi', 'SELLER'); await mk('buyer', 'Demo Xaridor', 'BUYER'); await mk('moderator', 'Demo Moderator', 'MODERATOR');
    const region = await prisma.region.findFirstOrThrow({ where: { slug: 'toshkent-shahri' } });
    const kg = await prisma.unit.findUniqueOrThrow({ where: { code: 'kg' } });
    const cat = await prisma.category.findFirstOrThrow({ where: { name: 'Kartoshka, piyoz, sabzi' } });
    const stores = [];
    for (const n of ['A', 'B', 'C']) {
      const name = `[DEMO] Do‘kon ${n}`;
      stores.push(await prisma.store.findFirst({ where: { name } }) ?? await prisma.store.create({ data: { name, slug: `demo-dokon-${n.toLowerCase()}`, ownerId: seller.id, regionId: region.id, status: 'VERIFIED', verifiedAt: new Date(), lat: 41.3 + Math.random() / 20, lng: 69.2 + Math.random() / 20 } }));
    }
    const product = await prisma.product.upsert({ where: { slug: 'demo-kartoshka' }, update: {}, create: { name: 'Kartoshka (demo)', slug: 'demo-kartoshka', categoryId: cat.id, unitId: kg.id, status: 'APPROVED', createdById: seller.id } });
    const prices = [7000, 7500, 8200];
    for (const [i, s] of stores.entries()) {
      if (await prisma.priceRecord.findFirst({ where: { storeId: s.id, productId: product.id } })) continue;
      const r = await prisma.priceRecord.create({ data: { storeId: s.id, productId: product.id, regionId: s.regionId, unitId: kg.id, price: prices[i]!, createdById: seller.id, moderationStatus: 'APPROVED', availability: 'IN_STOCK', quantityAvailable: 500, deliveryAvailable: i !== 1 } });
      for (let d = 14; d >= 0; d--) await prisma.priceHistory.create({ data: { priceRecordId: r.id, productId: product.id, regionId: s.regionId, price: prices[i]! - d * 15 + (d % 3) * 20, availability: 'IN_STOCK', recordedAt: new Date(Date.now() - d * 86_400_000) } });
    }
    console.log('demo data created. Accounts: seller|buyer|moderator' + DOMAIN + ' (password = DEMO_PASSWORD)');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e: unknown) => { console.error('seed-demo failed:', e instanceof Error ? e.message : 'unknown'); process.exit(1); });
