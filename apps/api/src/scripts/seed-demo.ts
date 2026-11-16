// DEMO DATA — never part of the normal deploy. It makes the platform look "used" so every screen and flow can be tested:
//   ALLOW_DEMO_SEED=yes DEMO_PASSWORD='<min 12 chars>' npm run seed:demo      (create / refresh; safe to run twice)
//   ALLOW_DEMO_SEED=yes DEMO_CLEANUP=yes npm run seed:demo                     (remove exactly the demo rows)
// Everything is tagged: emails end with @demo.bozornarx.invalid, stores/markets start with "[DEMO]", product slugs start with "demo-",
// order numbers start with "ORD-DEMO-". Real data is never touched. Contracts are NOT seeded: confirm a CREATED demo order as the
// seller and the platform generates a real contract (so the contract flow is tested with real code, not fake rows).
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const DOMAIN = '@demo.bozornarx.invalid';
const DAY = 86_400_000;
const slug = (s: string) => s.toLowerCase().replace(/[ʻʼ‘’`']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const round100 = (n: number) => Math.round(n / 100) * 100;
function rng(seed: number) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const SELLERS = [
  { local: 'seller1', name: 'Akmal Karimov', store: '[DEMO] Chorsu Mevasabzavot', region: 'Toshkent shahri', market: '[DEMO] Chorsu bozori', status: 'VERIFIED' },
  { local: 'seller2', name: 'Dilnoza Rasulova', store: '[DEMO] Yunusobod Market', region: 'Toshkent shahri', market: null, status: 'VERIFIED' },
  { local: 'seller3', name: 'Jasur Tursunov', store: '[DEMO] Siyob Savdo', region: 'Samarqand viloyati', market: '[DEMO] Siyob bozori', status: 'VERIFIED' },
  { local: 'seller4', name: 'Malika Yusupova', store: '[DEMO] Farg‘ona Dehqon', region: 'Farg‘ona viloyati', market: null, status: 'VERIFIED' },
  { local: 'seller5', name: 'Bobur Ergashev', store: '[DEMO] Yangi Do‘kon (tasdiq kutilmoqda)', region: 'Toshkent viloyati', market: null, status: 'PENDING' },
] as const;
const BUYERS = [['buyer1', 'Sardor Aliyev'], ['buyer2', 'Nodira Karimova'], ['buyer3', 'Otabek Qodirov'], ['buyer4', 'Zilola Ahmedova']] as const;
// [name, category, unit, base price]
const PRODUCTS: Array<[string, string, string, number]> = [
  ['Kartoshka', 'Kartoshka, piyoz, sabzi', 'kg', 7000], ['Piyoz', 'Kartoshka, piyoz, sabzi', 'kg', 5000], ['Sabzi', 'Kartoshka, piyoz, sabzi', 'kg', 6000],
  ['Pomidor', 'Pomidor, bodring, qalampir', 'kg', 14000], ['Bodring', 'Pomidor, bodring, qalampir', 'kg', 9000], ['Olma', 'Mavsumiy mevalar', 'kg', 12000],
  ['Mol go‘shti (suyaksiz)', 'Mol go‘shti', 'kg', 110000], ['Tovuq go‘shti', 'Tovuq va tuxum', 'kg', 38000], ['Tuxum', 'Tovuq va tuxum', 'dona', 1200],
  ['Sut', 'Sut', 'l', 11000], ['Un (oliy nav)', 'Un', 'kg', 8500], ['Guruch (lazer)', 'Guruch', 'kg', 18000],
  ['O‘simlik yog‘i', 'O‘simlik yog‘i', 'l', 20000], ['Shakar', 'Tuz va shakar', 'kg', 13000], ['Non (patir)', 'Non', 'dona', 4000],
];

async function cleanup(prisma: PrismaClient) {
  const users = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  const uid = users.map((u) => u.id);
  const stores = await prisma.store.findMany({ where: { name: { startsWith: '[DEMO]' } }, select: { id: true } });
  const sid = stores.map((s) => s.id);
  const orders = await prisma.order.findMany({ where: { number: { startsWith: 'ORD-DEMO-' } }, select: { id: true } });
  const oid = orders.map((o) => o.id);
  const prices = await prisma.priceRecord.findMany({ where: { storeId: { in: sid } }, select: { id: true } });
  const pid = prices.map((p) => p.id);
  const contracts = await prisma.contract.count({ where: { OR: [{ orderId: { in: oid } }, { buyerId: { in: uid } }, { sellerStoreId: { in: sid } }] } });
  if (contracts > 0) throw new Error(`${contracts} contract(s) were created from demo orders; contracts are append-only and are not deleted. Cleanup stopped, nothing was changed.`);
  await prisma.complaint.deleteMany({ where: { filedById: { in: uid } } });
  await prisma.review.deleteMany({ where: { OR: [{ storeId: { in: sid } }, { authorId: { in: uid } }] } });
  await prisma.message.deleteMany({ where: { conversation: { storeId: { in: sid } } } });
  await prisma.conversation.deleteMany({ where: { storeId: { in: sid } } });
  await prisma.notification.deleteMany({ where: { userId: { in: uid } } });
  await prisma.favorite.deleteMany({ where: { userId: { in: uid } } });
  await prisma.priceAlert.deleteMany({ where: { userId: { in: uid } } });
  await prisma.offer.deleteMany({ where: { storeId: { in: sid } } });
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
  await prisma.market.deleteMany({ where: { name: { startsWith: '[DEMO]' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: uid } } });
  await prisma.user.deleteMany({ where: { id: { in: uid } } });
  console.log(`demo data removed (users ${uid.length}, stores ${sid.length}, orders ${oid.length}).`);
}

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== 'yes') throw new Error('Refusing to run: set ALLOW_DEMO_SEED=yes.');
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'yes') throw new Error('Refusing to seed demo data with NODE_ENV=production.');
  const prisma = new PrismaClient();
  try {
    if (process.env.DEMO_CLEANUP === 'yes') return await cleanup(prisma);
    const password = process.env.DEMO_PASSWORD ?? '';
    if (password.length < 12) throw new Error('DEMO_PASSWORD (min 12 chars) is required; demo accounts get no built-in password.');
    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const rnd = rng(20261116);
    const roleId = async (name: string) => (await prisma.role.findUniqueOrThrow({ where: { name } })).id;
    const regionBySlug = async (name: string) => prisma.region.findFirstOrThrow({ where: { slug: slug(name) } });

    // ---- users
    const mk = async (local: string, fullName: string, role: string, regionName?: string) => {
      const email = `${local}${DOMAIN}`;
      const found = await prisma.user.findUnique({ where: { email } });
      if (found) return found;
      const region = regionName ? await regionBySlug(regionName) : null;
      return prisma.user.create({ data: { email, passwordHash, status: 'ACTIVE', emailVerifiedAt: new Date(), profile: { create: { fullName, regionId: region?.id } }, roles: { create: { roleId: await roleId(role) } } } });
    };
    const sellers = [];
    for (const s of SELLERS) sellers.push(await mk(s.local, s.name, 'SELLER', s.region));
    const buyers = [];
    for (const [l, n] of BUYERS) buyers.push(await mk(l, n, 'BUYER', 'Toshkent shahri'));
    await mk('moderator1', 'Demo Moderator', 'MODERATOR');

    // ---- markets + stores
    const stores = [];
    for (const [i, s] of SELLERS.entries()) {
      const region = await regionBySlug(s.region);
      let market = null;
      if (s.market) market = (await prisma.market.findFirst({ where: { name: s.market } })) ?? (await prisma.market.create({ data: { name: s.market, regionId: region.id, address: `${s.region}, markaziy bozor`, lat: (region.lat ?? 41.3) + 0.01, lng: (region.lng ?? 69.2) + 0.01 } }));
      const found = await prisma.store.findFirst({ where: { name: s.store } });
      stores.push(found ?? (await prisma.store.create({ data: {
        name: s.store, slug: `demo-${slug(s.local)}`, ownerId: sellers[i]!.id, regionId: region.id, marketId: market?.id, status: s.status, verifiedAt: s.status === 'VERIFIED' ? new Date() : null,
        description: 'Demo do‘kon: sinov uchun yaratilgan.', lat: (region.lat ?? 41.3) + (rnd() - 0.5) * 0.06, lng: (region.lng ?? 69.2) + (rnd() - 0.5) * 0.06,
      } })));
    }

    // ---- products
    const products = [];
    for (const [name, catName, unitCode, base] of PRODUCTS) {
      const cat = await prisma.category.findFirstOrThrow({ where: { name: catName } });
      const unit = await prisma.unit.findUniqueOrThrow({ where: { code: unitCode } });
      const sl = `demo-${slug(name)}`;
      const p = await prisma.product.upsert({ where: { slug: sl }, update: {}, create: { name, slug: sl, categoryId: cat.id, unitId: unit.id, status: 'APPROVED', description: 'Demo mahsulot.', createdById: sellers[0]!.id } });
      products.push({ p, unit, base });
    }
    const pendingCat = await prisma.category.findFirstOrThrow({ where: { name: 'Choy va qahva' } });
    const pendingUnit = await prisma.unit.findUniqueOrThrow({ where: { code: 'kg' } });
    await prisma.product.upsert({ where: { slug: 'demo-yashil-choy-kutilmoqda' }, update: {}, create: { name: 'Yashil choy (moderatsiya kutilmoqda)', slug: 'demo-yashil-choy-kutilmoqda', categoryId: pendingCat.id, unitId: pendingUnit.id, status: 'PENDING', createdById: sellers[1]!.id } });

    // ---- prices + 30 days of history. Store 0 sells everything; others skip every third product. One stale, one awaiting moderation.
    const priceOf = new Map<string, string>(); // `${storeIdx}:${productIdx}` -> priceRecord id
    for (const [si, st] of stores.entries()) {
      if (st.status !== 'VERIFIED') continue;
      for (const [pi, { p, unit, base }] of products.entries()) {
        if (si > 0 && (pi + si) % 3 === 0) continue;
        const existing = await prisma.priceRecord.findFirst({ where: { storeId: st.id, productId: p.id, variantId: null } });
        if (existing) { priceOf.set(`${si}:${pi}`, existing.id); continue; }
        const price = round100(base * (0.9 + rnd() * 0.25));
        const stale = si === 2 && pi === 0;
        const pending = si === 1 && pi === 3;
        const ageDays = stale ? 12 : Math.floor(rnd() * 4);
        const rec = await prisma.priceRecord.create({ data: {
          productId: p.id, storeId: st.id, regionId: st.regionId, marketId: st.marketId, unitId: unit.id, price, createdById: sellers[si]!.id,
          moderationStatus: pending ? 'PENDING' : 'APPROVED', availability: pi % 7 === 6 ? 'LOW_STOCK' : 'IN_STOCK', quantityAvailable: 50 + Math.floor(rnd() * 450), deliveryAvailable: si % 2 === 0,
          confirmedAt: new Date(Date.now() - ageDays * DAY),
        } });
        priceOf.set(`${si}:${pi}`, rec.id);
        let walk = price * (0.92 + rnd() * 0.1);
        for (let d = 30; d >= 0; d--) {
          walk = d === 0 ? price : Math.max(base * 0.7, walk * (0.985 + rnd() * 0.035));
          await prisma.priceHistory.create({ data: { priceRecordId: rec.id, productId: p.id, regionId: st.regionId, price: round100(walk), availability: 'IN_STOCK', recordedAt: new Date(Date.now() - d * DAY) } });
        }
      }
    }

    // ---- orders in every state (buyer side + seller side can be tested)
    type Item = [number, number]; // [productIdx, qty]
    const ORDERS: Array<{ n: string; b: number; s: number; status: 'COMPLETED' | 'DELIVERED' | 'SHIPPED' | 'CONFIRMED' | 'CREATED' | 'CANCELLED'; ago: number; items: Item[]; rating?: number; review?: string }> = [
      { n: '0001', b: 0, s: 0, status: 'COMPLETED', ago: 20, items: [[0, 10], [1, 5]], rating: 5, review: 'Mahsulot yangi, narx bozordagidan arzon. Rahmat!' },
      { n: '0002', b: 0, s: 1, status: 'COMPLETED', ago: 12, items: [[5, 4]], rating: 4, review: 'Yaxshi, faqat yetkazish biroz kechikdi.' },
      { n: '0003', b: 1, s: 0, status: 'COMPLETED', ago: 9, items: [[6, 2]], rating: 5, review: 'Go‘sht sifatli, tavsiya qilaman.' },
      { n: '0004', b: 2, s: 2, status: 'DELIVERED', ago: 2, items: [[11, 25], [13, 10]] },
      { n: '0005', b: 0, s: 0, status: 'SHIPPED', ago: 1, items: [[3, 3]] },
      { n: '0006', b: 1, s: 1, status: 'CONFIRMED', ago: 1, items: [[10, 50]] },
      { n: '0007', b: 0, s: 0, status: 'CREATED', ago: 0, items: [[2, 8], [0, 20]] },
      { n: '0008', b: 3, s: 3, status: 'CREATED', ago: 0, items: [[9, 12], [14, 30]] },
      { n: '0009', b: 2, s: 0, status: 'CANCELLED', ago: 5, items: [[7, 3]] },
    ];
    for (const o of ORDERS) {
      const number = `ORD-DEMO-${o.n}`;
      if (await prisma.order.findUnique({ where: { number } })) continue;
      const lines = [];
      for (const [pi, qty] of o.items) {
        const prId = priceOf.get(`${o.s}:${pi}`);
        if (!prId) continue;
        const pr = await prisma.priceRecord.findUniqueOrThrow({ where: { id: prId } });
        lines.push({ pr, qty });
      }
      if (lines.length === 0) continue;
      const total = lines.reduce((sum, l) => sum + Number(l.pr.price) * l.qty, 0);
      const createdAt = new Date(Date.now() - o.ago * DAY);
      const delivery = o.s % 2 === 0;
      const order = await prisma.order.create({ data: {
        number, buyerId: buyers[o.b]!.id, storeId: stores[o.s]!.id, status: o.status, totalAmount: total, paymentMethod: 'CASH_ON_DELIVERY', createdAt,
        deliveryMethod: delivery ? 'DELIVERY' : 'PICKUP', deliveryAddress: delivery ? 'Toshkent sh., Chilonzor tumani, 7-mavze, 12-uy' : null,
        items: { create: lines.map((l) => ({ productId: l.pr.productId, unitId: l.pr.unitId, quantity: l.qty, unitPrice: l.pr.price, priceRecordId: l.pr.id })) },
      } });
      if (['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(o.status)) {
        await prisma.delivery.create({ data: { orderId: order.id, status: o.status === 'SHIPPED' ? 'IN_TRANSIT' : o.status === 'DELIVERED' ? 'DELIVERED' : 'ACCEPTED', address: order.deliveryAddress, deliveredAt: o.status === 'SHIPPED' ? null : new Date(createdAt.getTime() + DAY), acceptedAt: o.status === 'COMPLETED' ? new Date(createdAt.getTime() + 1.2 * DAY) : null } });
      }
      if (o.status === 'COMPLETED') {
        await prisma.payment.create({ data: { orderId: order.id, provider: 'CASH', providerRef: `cash-${order.id}`, amount: total, status: 'PAID' } });
        if (o.rating) await prisma.review.create({ data: { authorId: buyers[o.b]!.id, storeId: stores[o.s]!.id, orderId: order.id, rating: o.rating, comment: o.review, status: 'APPROVED' } });
      }
    }

    // ---- offer, discount, favorites, alerts, complaint
    const beefPrice = priceOf.get('0:6');
    if (beefPrice && !(await prisma.offer.findFirst({ where: { buyerId: buyers[1]!.id, storeId: stores[0]!.id } }))) {
      await prisma.offer.create({ data: { buyerId: buyers[1]!.id, storeId: stores[0]!.id, priceRecordId: beefPrice, quantity: 5, offeredUnitPrice: 100000, message: 'Ulgurji olaman, narxni tushira olasizmi?', deliveryMethod: 'PICKUP', expiresAt: new Date(Date.now() + 3 * DAY) } });
    }
    await prisma.discount.upsert({ where: { storeId_code: { storeId: stores[0]!.id, code: 'DEMO10' } }, update: {}, create: { storeId: stores[0]!.id, code: 'DEMO10', percent: 10, minAmount: 50000 } });
    for (const pi of [0, 3, 6]) await prisma.favorite.upsert({ where: { userId_productId: { userId: buyers[0]!.id, productId: products[pi]!.p.id } }, update: {}, create: { userId: buyers[0]!.id, productId: products[pi]!.p.id } });
    if (!(await prisma.priceAlert.findFirst({ where: { userId: buyers[0]!.id } }))) {
      await prisma.priceAlert.create({ data: { userId: buyers[0]!.id, productId: products[0]!.p.id, direction: 'BELOW', targetPrice: 6500, unitCode: 'kg', channels: ['IN_APP'] } });
    }
    const complaintTarget = priceOf.get('0:3');
    if (complaintTarget && !(await prisma.complaint.findFirst({ where: { filedById: buyers[2]!.id } }))) {
      await prisma.complaint.create({ data: { filedById: buyers[2]!.id, targetType: 'PRICE', targetId: complaintTarget, reason: 'Narx noto‘g‘ri', details: 'Do‘konda narx boshqacha edi.' } });
    }

    // ---- chat + notifications (created once)
    if (!(await prisma.conversation.findFirst({ where: { buyerId: buyers[0]!.id, storeId: stores[0]!.id } }))) {
      const conv = await prisma.conversation.create({ data: { buyerId: buyers[0]!.id, storeId: stores[0]!.id, lastMessageAt: new Date() } });
      const lines: Array<[string, string, number, boolean]> = [
        [buyers[0]!.id, 'Assalomu alaykum, kartoshka bugun bormi?', 50, true], [sellers[0]!.id, 'Vaalaykum assalom! Ha, yangi hosil, 7 000 so‘mdan.', 45, true],
        [buyers[0]!.id, 'Ertaga 20 kg olsam bo‘ladimi?', 30, true], [sellers[0]!.id, 'Albatta, ertalab tayyor bo‘ladi.', 5, false],
      ];
      for (const [senderId, body, minsAgo, read] of lines) await prisma.message.create({ data: { conversationId: conv.id, senderId, body, createdAt: new Date(Date.now() - minsAgo * 60_000), readAt: read ? new Date() : null } });
      await prisma.notification.createMany({ data: [
        { userId: buyers[0]!.id, type: 'ORDER_STATUS', title: 'Buyurtma ORD-DEMO-0005: SHIPPED', body: 'Buyurtmangiz yo‘lda.', data: { url: '/orders' } },
        { userId: buyers[0]!.id, type: 'PRICE_DROP', title: 'Kartoshka narxi tushdi', body: 'Kuzatuvingizdagi mahsulot arzonlashdi.', data: { url: '/catalog' } },
        { userId: sellers[0]!.id, type: 'ORDER_NEW', title: 'Yangi buyurtma ORD-DEMO-0007', body: 'Tasdiqlang: shartnoma avtomatik yaratiladi.', data: { url: '/seller/orders' } },
      ] });
    }

    console.log('demo data ready.');
    console.log(`Accounts (password = DEMO_PASSWORD): ${SELLERS.map((s) => s.local).join(', ')}, ${BUYERS.map((b) => b[0]).join(', ')}, moderator1  @demo.bozornarx.invalid`);
    console.log('Test ideas: seller1 confirms ORD-DEMO-0007 (contract is generated); moderator1 approves seller5 store, the pending product, and the pending price; buyer2 offer -> seller1 counters.');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e: unknown) => { console.error('seed-demo failed:', e instanceof Error ? e.message : 'unknown'); process.exit(1); });
