// Fast, idempotent step that guarantees every demo account exists and can sign in with DEMO_PASSWORD.
// It runs before the (slow) demo data seed, so logging in never depends on the big seed having finished.
// Existing accounts whose password already matches are left alone (sessions stay valid across restarts).
import { PrismaClient } from '@prisma/client';
import { hash, verify } from '@node-rs/argon2';
import { DEMO_BUYERS, DEMO_DOMAIN, DEMO_MODERATORS, DEMO_SELLERS } from './demo-accounts';

async function main() {
  const password = process.env.DEMO_PASSWORD ?? '';
  if (password.length < 12) throw new Error('DEMO_PASSWORD (min 12 chars) is required');
  const prisma = new PrismaClient();
  try {
    const roles = new Map((await prisma.role.findMany({ select: { id: true, name: true } })).map((r) => [r.name, r.id]));
    if (!roles.size) throw new Error('roles are missing: reference data was not loaded');
    const list: Array<[string, string, 'SELLER' | 'BUYER' | 'MODERATOR']> = [
      ...DEMO_SELLERS.map((s) => [s.local, s.name, 'SELLER'] as [string, string, 'SELLER']),
      ...DEMO_BUYERS.map((b) => [b[0], b[1], 'BUYER'] as [string, string, 'BUYER']),
      ...DEMO_MODERATORS.map((m) => [m[0], m[1], 'MODERATOR'] as [string, string, 'MODERATOR']),
    ];
    let passwordHash: string | null = null;
    const getHash = async () => (passwordHash ??= await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }));
    let created = 0, fixed = 0, same = 0;
    for (const [local, name, role] of list) {
      const email = `${local}${DEMO_DOMAIN}`;
      const roleId = roles.get(role);
      if (!roleId) throw new Error(`role ${role} not found`);
      const u = await prisma.user.findUnique({ where: { email }, include: { roles: { select: { roleId: true } } } });
      if (!u) {
        await prisma.user.create({ data: { email, passwordHash: await getHash(), status: 'ACTIVE', emailVerifiedAt: new Date(), profile: { create: { fullName: name } }, roles: { create: { roleId } } } });
        created++;
        continue;
      }
      const ok = await verify(u.passwordHash, password).catch(() => false);
      if (ok && u.status === 'ACTIVE' && u.emailVerifiedAt && !u.lockedUntil && u.failedLogins === 0 && u.roles.some((r) => r.roleId === roleId)) { same++; continue; }
      await prisma.user.update({ where: { id: u.id }, data: { passwordHash: ok ? u.passwordHash : await getHash(), status: 'ACTIVE', emailVerifiedAt: u.emailVerifiedAt ?? new Date(), failedLogins: 0, lockedUntil: null } });
      if (!u.roles.some((r) => r.roleId === roleId)) await prisma.userRole.create({ data: { userId: u.id, roleId } });
      fixed++;
    }
    console.log(`demo accounts ready: created ${created}, repaired ${fixed}, already fine ${same} (password = DEMO_PASSWORD)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error('ensure-demo-accounts failed:', e instanceof Error ? e.message : 'unknown error');
  process.exit(1);
});
