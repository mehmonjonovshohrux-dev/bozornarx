// DEMO: extra activity so every screen of every demo account has something to show (favorites, alerts, chats, offers, disputes,
// moderation queue, notifications). Idempotent: every block checks for its own rows first, so running it twice adds nothing.
// Only touches demo.*@example.com accounts, "[DEMO]" stores and demo-* products.
import { PrismaClient, type Store, type User } from '@prisma/client';
import { DEMO_BUYERS, DEMO_DOMAIN, DEMO_SELLERS } from './demo-accounts';

const DAY = 86_400_000;
const MIN = 60_000;
const slug = (s: string) => s.toLowerCase().replace(/[ʻʼ‘’`']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function main() {
  const prisma = new PrismaClient();
  try {
    const buyers: Array<User | null> = [];
    for (const [l] of DEMO_BUYERS) buyers.push(await prisma.user.findUnique({ where: { email: `${l}${DEMO_DOMAIN}` } }));
    const sellers: Array<User | null> = [];
    for (const s of DEMO_SELLERS) sellers.push(await prisma.user.findUnique({ where: { email: `${s.local}${DEMO_DOMAIN}` } }));
    const stores: Array<Store | null> = [];
    for (const s of DEMO_SELLERS) stores.push(await prisma.store.findFirst({ where: { name: s.store } }));
    if (buyers.some((b) => !b) || sellers.some((s) => !s) || stores.slice(0, 4).some((s) => !s)) throw new Error('demo accounts/stores missing: run seed-demo first');
    const B = (i: number) => buyers[i]!;
    const S = (i: number) => sellers[i]!;
    const ST = (i: number) => stores[i]!;
    const productBy = async (name: string) => prisma.product.findUnique({ where: { slug: `demo-${slug(name)}` } });
    const NAMES = ['Kartoshka', 'Piyoz', 'Sabzi', 'Pomidor', 'Bodring', 'Olma', 'Mol go‘shti (suyaksiz)', 'Tovuq go‘shti', 'Tuxum', 'Sut', 'Un (oliy nav)', 'Guruch (lazer)', 'O‘simlik yog‘i', 'Shakar', 'Non (patir)'];
    const prod = new Map<number, Awaited<ReturnType<typeof productBy>>>();
    for (const [i, n] of NAMES.entries()) prod.set(i, await productBy(n));
    const priceAt = async (si: number, pi: number) => { const p = prod.get(pi); return p ? prisma.priceRecord.findFirst({ where: { storeId: ST(si).id, productId: p.id, variantId: null, deletedAt: null } }) : null; };
    let added = 0;

    // ---- favorites: every buyer follows 4 products
    const FAV: number[][] = [[0, 3, 6, 8], [2, 5, 7, 10], [1, 4, 9, 11], [3, 12, 13, 14]];
    for (const [bi, list] of FAV.entries()) for (const pi of list) {
      const p = prod.get(pi); if (!p) continue;
      await prisma.favorite.upsert({ where: { userId_productId: { userId: B(bi).id, productId: p.id } }, update: {}, create: { userId: B(bi).id, productId: p.id } });
    }

    // ---- price alerts (both directions)
    const ALERTS: Array<[number, number, 'BELOW' | 'ABOVE', number, string]> = [
      [0, 3, 'BELOW', 13000, 'kg'], [1, 6, 'BELOW', 105000, 'kg'], [1, 10, 'ABOVE', 9500, 'kg'], [2, 11, 'BELOW', 17000, 'kg'], [2, 9, 'BELOW', 10500, 'l'], [3, 12, 'BELOW', 19000, 'l'], [3, 13, 'ABOVE', 14000, 'kg'],
    ];
    for (const [bi, pi, dir, target, unit] of ALERTS) {
      const p = prod.get(pi); if (!p) continue;
      if (await prisma.priceAlert.findFirst({ where: { userId: B(bi).id, productId: p.id } })) continue;
      await prisma.priceAlert.create({ data: { userId: B(bi).id, productId: p.id, direction: dir, targetPrice: target, unitCode: unit, channels: ['IN_APP'] } }); added++;
    }

    // ---- chats: (buyer, store, messages [fromBuyer?, text, minutesAgo])
    const CHATS: Array<[number, number, Array<[boolean, string, number]>]> = [
      [1, 0, [[true, 'Salom, mol go‘shti bugun yangi keldimi?', 300], [false, 'Vaalaykum assalom, ha, ertalab keldi. 110 000 dan.', 280], [true, '5 kg olsam narxni tushirasizmi?', 260], [false, 'Taklif yuboring, ko‘rib chiqaman.', 240]]],
      [2, 1, [[true, 'Un 50 kg bor-yo‘qligini bilmoqchiydim.', 1500], [false, 'Bor, oliy nav. Yetkazib berish ham bor.', 1480], [true, 'Yaxshi, buyurtma beraman.', 1470], [false, 'Kutamiz, rahmat!', 1465]]],
      [3, 0, [[true, 'Kartoshka va piyoz yangi hosilmi?', 3000], [false, 'Ha, shu hafta keldi.', 2990], [true, 'Rahmat, buyurtma berdim, qabul qiling.', 2980]]],
      [1, 2, [[true, 'Assalomu alaykum, kartoshka 15 kg kerak edi.', 900], [false, 'Salom! Tayyor, ertaga olib ketishingiz mumkin.', 880], [true, 'Rahmat, ertaga kelaman.', 870], [false, 'Kutamiz.', 860]]],
      [2, 2, [[true, 'Guruchning narxi o‘zgarmadimi?', 120], [false, 'Hozircha o‘sha narxda, 18 000.', 100]]],
      [0, 1, [[true, 'Olma qachon yangilanadi?', 600], [false, 'Ertaga yangi partiya keladi.', 580], [true, 'Yaxshi, yana yozaman.', 570]]],
      [3, 3, [[true, 'Sut va non yetkazasizmi?', 200], [false, 'Ha, shahar ichida bepul.', 190], [true, 'Zo‘r, ertalabga kerak.', 180]]],
      [0, 2, [[true, 'Pomidor 3 kg uchun sizda nima narx?', 45], [false, 'Hozir 14 000, sifatli.', 30]]],
    ];
    for (const [bi, si, lines] of CHATS) {
      if (await prisma.conversation.findFirst({ where: { buyerId: B(bi).id, storeId: ST(si).id } })) continue;
      const conv = await prisma.conversation.create({ data: { buyerId: B(bi).id, storeId: ST(si).id, lastMessageAt: new Date(Date.now() - lines[lines.length - 1]![2] * MIN) } });
      for (const [fromBuyer, body, ago] of lines) {
        await prisma.message.create({ data: { conversationId: conv.id, senderId: fromBuyer ? B(bi).id : S(si).id, body, createdAt: new Date(Date.now() - ago * MIN), readAt: ago > 60 ? new Date(Date.now() - (ago - 5) * MIN) : null } });
      }
      added++;
    }

    // ---- offers in every state: [buyer, store, product, qty, offered price, counter, status, message, linked order]
    const OFFERS: Array<[number, number, number, number, number, number | null, 'PENDING' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED', string, string | null]> = [
      [3, 0, 0, 100, 6200, null, 'PENDING', 'Ulgurji 100 kg kartoshka, narxni tushiring.', null],
      [2, 1, 10, 80, 8000, 8400, 'COUNTERED', 'Un 80 kg, 8 000 dan bo‘ladimi?', null],
      [0, 1, 5, 4, 10500, null, 'ACCEPTED', 'Olma 4 kg, 10 500 dan.', 'ORD-DEMO-0002'],
      [0, 2, 3, 20, 9000, null, 'REJECTED', 'Pomidor 20 kg, 9 000 dan.', null],
      [1, 3, 9, 30, 8000, null, 'EXPIRED', 'Sut 30 litr, 8 000 dan.', null],
      [2, 0, 7, 10, 33000, 36000, 'COUNTERED', 'Tovuq go‘shti 10 kg, 33 000 dan.', null],
    ];
    for (const [bi, si, pi, qty, offered, counter, status, message, orderNo] of OFFERS) {
      const pr = await priceAt(si, pi); if (!pr) continue;
      if (await prisma.offer.findFirst({ where: { buyerId: B(bi).id, storeId: ST(si).id, message } })) continue;
      const order = orderNo ? await prisma.order.findUnique({ where: { number: orderNo } }) : null;
      await prisma.offer.create({ data: {
        buyerId: B(bi).id, storeId: ST(si).id, priceRecordId: pr.id, quantity: qty, offeredUnitPrice: offered, counterUnitPrice: counter, message, status, orderId: order?.id ?? null,
        deliveryMethod: 'PICKUP', expiresAt: new Date(Date.now() + (status === 'EXPIRED' ? -2 : 3) * DAY), createdAt: new Date(Date.now() - (status === 'PENDING' ? 0.2 : 2) * DAY),
      } }); added++;
    }

    // ---- disputes: open, in review, resolved (each with a complaint, linked to a demo order and its contract)
    const DISPUTES: Array<[string, number, 'OPEN' | 'IN_REVIEW' | 'RESOLVED', string, string, string | null]> = [
      ['ORD-DEMO-0004', 2, 'OPEN', 'Mahsulot sifati', 'Guruch va shakar qadog‘i ochilgan holda keldi.', null],
      ['ORD-DEMO-0013', 3, 'IN_REVIEW', 'Miqdor mos kelmadi', 'Buyurtma qilingan 20 kg o‘rniga 17 kg keldi.', null],
      ['ORD-DEMO-0012', 2, 'RESOLVED', 'Yetkazish kechikdi', 'Kelishilgan vaqtdan 3 soat kech topshirildi.', 'Sotuvchi uzr so‘radi, keyingi buyurtmaga 5% chegirma berildi. Nizo yopildi.'],
    ];
    for (const [number, bi, status, reason, details, resolution] of DISPUTES) {
      const order = await prisma.order.findUnique({ where: { number }, include: { contract: { select: { id: true } } } });
      if (!order) continue;
      if (await prisma.dispute.findFirst({ where: { orderId: order.id } })) continue;
      const complaint = await prisma.complaint.create({ data: { filedById: B(bi).id, targetType: 'STORE', targetId: order.storeId, reason, details, status: status === 'RESOLVED' ? 'RESOLVED' : status === 'IN_REVIEW' ? 'IN_REVIEW' : 'OPEN' } });
      await prisma.dispute.create({ data: { complaintId: complaint.id, orderId: order.id, contractId: order.contract?.id ?? null, openedById: B(bi).id, status, resolution, createdAt: new Date(Date.now() - (status === 'RESOLVED' ? 4 : 1) * DAY) } });
      added++;
    }
    // a few plain complaints about prices/products for the moderator queue
    for (const [bi, si, pi, reason, details] of [[1, 2, 0, 'Narx eskirgan', 'Do‘konda narx boshqacha ekan.'], [3, 3, 11, 'Narx noto‘g‘ri', 'Guruch narxi bozordagidan ancha baland ko‘rsatilgan.']] as const) {
      const pr = await priceAt(si, pi); if (!pr) continue;
      if (await prisma.complaint.findFirst({ where: { filedById: B(bi).id, targetId: pr.id } })) continue;
      await prisma.complaint.create({ data: { filedById: B(bi).id, targetType: 'PRICE', targetId: pr.id, reason, details } }); added++;
    }

    // ---- moderation queue: two more products awaiting approval, each with a pending price from seller 1
    const extra: Array<[string, string, string, number]> = [['Qora choy (kutilmoqda)', 'Choy va qahva', 'kg', 65000], ['Zaytun yog‘i (kutilmoqda)', 'O‘simlik yog‘i', 'l', 85000]];
    for (const [name, catName, unitCode, price] of extra) {
      const cat = await prisma.category.findFirst({ where: { name: catName } });
      const unit = await prisma.unit.findUnique({ where: { code: unitCode } });
      if (!cat || !unit) continue;
      const sl = `demo-${slug(name)}`;
      const p = await prisma.product.upsert({ where: { slug: sl }, update: {}, create: { name, slug: sl, categoryId: cat.id, unitId: unit.id, status: 'PENDING', description: 'Demo mahsulot: moderator tasdiqlashi kutilmoqda.', createdById: S(0).id } });
      if (!(await prisma.priceRecord.findFirst({ where: { storeId: ST(0).id, productId: p.id } }))) {
        await prisma.priceRecord.create({ data: { productId: p.id, storeId: ST(0).id, regionId: ST(0).regionId, marketId: ST(0).marketId, unitId: unit.id, price, createdById: S(0).id, moderationStatus: 'PENDING', availability: 'IN_STOCK', quantityAvailable: 40 } }); added++;
      }
    }

    // ---- notifications that match the activity above (once per user+title)
    const note = async (userId: string, type: string, title: string, body: string, link: string) => {
      if (await prisma.notification.findFirst({ where: { userId, title } })) return;
      await prisma.notification.create({ data: { userId, type, title, body, data: { link }, createdAt: new Date(Date.now() - Math.floor(Math.random() * 6 * 60) * MIN) } });
    };
    await note(S(0).id, 'OFFER_NEW', 'Yangi taklif: kartoshka 100 kg', 'Otabek Qodirov 6 200 so‘mdan taklif yubordi.', '/offers');
    await note(B(2).id, 'OFFER_COUNTER', 'Sotuvchi qarshi taklif berdi', 'Un 80 kg uchun 8 400 so‘m taklif qilindi.', '/offers');
    await note(B(0).id, 'OFFER_ACCEPTED', 'Taklifingiz qabul qilindi', 'Olma 4 kg bo‘yicha taklifingiz qabul qilindi.', '/offers');
    await note(B(0).id, 'OFFER_REJECTED', 'Taklifingiz rad etildi', 'Pomidor 20 kg bo‘yicha taklif rad etildi.', '/offers');
    await note(S(0).id, 'CHAT_MESSAGE', 'Yangi xabar: Nodira Karimova', 'Mol go‘shti bugun yangi keldimi?', '/chat');
    await note(B(2).id, 'DISPUTE_UPDATE', 'Nizongiz ko‘rib chiqilmoqda', 'ORD-DEMO-0004 bo‘yicha murojaatingiz qabul qilindi.', '/disputes');
    await note(B(3).id, 'DISPUTE_UPDATE', 'Nizo ko‘rib chiqish bosqichida', 'ORD-DEMO-0013 bo‘yicha moderator ish boshladi.', '/disputes');
    await note(S(3).id, 'DISPUTE_UPDATE', 'Siz haqingizda nizo ochildi', 'ORD-DEMO-0013: miqdor mos kelmadi, javob bering.', '/disputes');
    await note(B(3).id, 'PRICE_DROP', 'Narx tushdi: o‘simlik yog‘i', 'Kuzatayotgan mahsulotingiz narxi 19 000 so‘mdan pasaydi.', '/alerts');
    await note(B(1).id, 'PRICE_DROP', 'Narx tushdi: mol go‘shti', 'Kuzatayotgan mahsulotingiz narxi 105 000 so‘mdan pasaydi.', '/alerts');

    console.log(`demo extra data ready (${added} new rows/groups; the rest already existed)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().then(() => process.exit(0)).catch((e: unknown) => {
  console.error('seed-demo-extra failed:', e instanceof Error ? e.message : 'unknown error');
  process.exit(1);
});
