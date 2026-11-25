// Runs at every start (after migrations): enables Row-Level Security on any public table that does not have it yet, so tables added by
// future migrations are protected too. Idempotent and quick. Prisma (table owner) is unaffected; REST access with the public key stays denied.
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT c.relname AS tablename FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`;
    for (const r of rows) await prisma.$executeRawUnsafe(`ALTER TABLE public."${r.tablename.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`);
    console.log(`row-level security: ${rows.length} table(s) newly protected`);
  } finally {
    await prisma.$disconnect();
  }
}
main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ensure-rls failed:', e instanceof Error ? e.message : 'unknown error'); process.exit(1); });
