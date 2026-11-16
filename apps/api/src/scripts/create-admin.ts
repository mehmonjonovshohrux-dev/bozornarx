// One-off: create the first Super Admin. Run it yourself after the first deploy:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long passphrase' ADMIN_NAME='Your Name' npm run create:admin
// The password is read from the environment, hashed with Argon2id, and never printed or stored in plain text.
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const name = (process.env.ADMIN_NAME ?? 'Administrator').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('ADMIN_EMAIL is missing or invalid');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!role) throw new Error('SUPER_ADMIN role not found: run "npm run seed:reference" first');
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('a user with this email already exists; nothing was changed');

    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        profile: { create: { fullName: name } },
        roles: { create: { roleId: role.id } },
      },
    });
    await prisma.auditLog.create({ data: { actorId: user.id, action: 'ADMIN_CREATED', entityType: 'user', entityId: user.id } });
    console.log(`super admin created: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error('create-admin failed:', e instanceof Error ? e.message : 'unknown error');
  process.exit(1);
});
