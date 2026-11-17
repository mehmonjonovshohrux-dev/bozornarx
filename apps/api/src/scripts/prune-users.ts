// One-off, driven by PRUNE_USERS=yes in the Render environment (the entrypoint runs it in the background; remove the variable afterwards).
// Deletes every account except: the demo accounts (demo.*@example.com), the account whose email is ADMIN_EMAIL, and any Super Admin.
// Users that cannot be deleted (e.g. they have signed contracts, which are never deleted) are suspended instead, never left active.
import { PrismaClient } from '@prisma/client';
import { purge } from './purge';
import { DEMO_DOMAIN } from './demo-accounts';

async function main() {
  if (process.env.PRUNE_USERS !== 'yes') throw new Error('Refusing to run: set PRUNE_USERS=yes.');
  const prisma = new PrismaClient();
  try {
    const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
    const users = await prisma.user.findMany({ select: { id: true, email: true, status: true, roles: { select: { role: { select: { name: true } } } } } });
    let removed = 0, suspended = 0, kept = 0;
    for (const u of users) {
      const isAdmin = u.roles.some((r) => r.role.name === 'SUPER_ADMIN');
      if (isAdmin || u.email === adminEmail || u.email.endsWith(DEMO_DOMAIN)) { kept++; continue; }
      try {
        const stores = await prisma.store.findMany({ where: { ownerId: u.id }, select: { id: true } });
        const sid = stores.map((s) => s.id);
        const orders = await prisma.order.findMany({ where: { OR: [{ buyerId: u.id }, { storeId: { in: sid } }] }, select: { id: true } });
        await purge(prisma, { uid: [u.id], sid, oid: orders.map((o) => o.id) });
        removed++;
      } catch (e) {
        await prisma.user.update({ where: { id: u.id }, data: { status: 'SUSPENDED' } }).catch(() => undefined);
        await prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }).catch(() => undefined);
        suspended++;
        console.error(`prune: could not delete a user, suspended instead (${e instanceof Error ? e.message.slice(0, 120) : 'error'})`);
      }
    }
    // Legacy demo accounts from the old domain are removed above (they are not in the keep list); their [DEMO] markets too.
    await prisma.market.deleteMany({ where: { name: { startsWith: '[DEMO]' }, stores: { none: {} } } }).catch(() => undefined);
    console.log(`prune finished: kept ${kept}, deleted ${removed}, suspended ${suspended}.`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e: unknown) => { console.error('prune-users failed:', e instanceof Error ? e.message : 'unknown'); process.exit(1); });
