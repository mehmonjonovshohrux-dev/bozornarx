// Idempotent REFERENCE data only: roles, permissions, units. Safe to run on every deploy.
// It never creates users, products, prices or any demo data.
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS } from '../domain/permissions';
import { DEFAULT_TEMPLATES, ContractTypeCode } from '../domain/contract-templates';
import { UNITS } from '../domain/units';

// Real reference data (not demo data): the 14 first-level administrative units of Uzbekistan with approximate centre points,
// and a starting category tree. Admins can add or edit both in the admin panel; existing rows are never overwritten.
const REGIONS: Array<[string, number, number]> = [
  ['Toshkent shahri', 41.3111, 69.2797], ['Toshkent viloyati', 41.0, 69.8], ['Andijon viloyati', 40.78, 72.34], ['Buxoro viloyati', 39.77, 64.42],
  ['Farg‘ona viloyati', 40.38, 71.78], ['Jizzax viloyati', 40.12, 67.84], ['Xorazm viloyati', 41.55, 60.63], ['Namangan viloyati', 41.0, 71.67],
  ['Navoiy viloyati', 40.1, 65.37], ['Qashqadaryo viloyati', 38.86, 65.79], ['Qoraqalpog‘iston Respublikasi', 43.8, 59.0], ['Samarqand viloyati', 39.65, 66.96],
  ['Sirdaryo viloyati', 40.5, 68.78], ['Surxondaryo viloyati', 37.94, 67.57],
];
const CATEGORIES: Record<string, string[]> = {
  Sabzavotlar: ['Kartoshka, piyoz, sabzi', 'Pomidor, bodring, qalampir', 'Ko‘katlar'],
  Mevalar: ['Mavsumiy mevalar', 'Quruq mevalar', 'Sitrus va tropik mevalar'],
  'Go‘sht va parranda': ['Mol go‘shti', 'Qo‘y go‘shti', 'Tovuq va tuxum'],
  'Sut mahsulotlari': ['Sut', 'Qatiq va qaymoq', 'Pishloq va yog‘'],
  'Non va un': ['Non', 'Un', 'Makaron'],
  'Don va yormalar': ['Guruch', 'Grechka va yormalar', 'Dukkaklilar'],
  'Yog‘ va ziravorlar': ['O‘simlik yog‘i', 'Ziravorlar', 'Tuz va shakar'],
  'Ichimliklar': ['Suv', 'Choy va qahva', 'Sharbatlar'],
  'Uy-ro‘zg‘or': ['Tozalash vositalari', 'Gigiyena'],
};
const slug = (s: string) => s.toLowerCase().replace(/[ʻʼ‘’`']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const key of PERMISSIONS) {
      await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
    }
    for (const name of ROLES) {
      if (name === 'GUEST') continue; // GUEST = no session, not stored
      const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
      const wanted = new Set<string>(ROLE_PERMISSIONS[name]);
      const perms = await prisma.permission.findMany({ where: { key: { in: [...wanted] } } });
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
        prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) }),
      ]);
    }
    for (const u of Object.values(UNITS)) {
      await prisma.unit.upsert({
        where: { code: u.code },
        update: { name: u.name, dimension: u.dimension, toBase: u.toBase },
        create: { code: u.code, name: u.name, dimension: u.dimension, toBase: u.toBase },
      });
    }
    for (const [name, lat, lng] of REGIONS) {
      await prisma.region.upsert({ where: { slug: slug(name) }, update: {}, create: { name, slug: slug(name), type: name === 'Toshkent shahri' ? 'SHAHAR' : 'VILOYAT', lat, lng } });
    }
    let order = 0;
    for (const [parent, kids] of Object.entries(CATEGORIES)) {
      const p = await prisma.category.upsert({ where: { slug: slug(parent) }, update: {}, create: { name: parent, slug: slug(parent), sortOrder: order++ } });
      let k = 0;
      for (const kid of kids) await prisma.category.upsert({ where: { slug: slug(`${parent}-${kid}`) }, update: {}, create: { name: kid, slug: slug(`${parent}-${kid}`), parentId: p.id, sortOrder: k++ } });
    }
    // default contract templates: only created when no template of that type exists, so admin edits are never overwritten
    for (const [type, t] of Object.entries(DEFAULT_TEMPLATES) as Array<[ContractTypeCode, (typeof DEFAULT_TEMPLATES)[ContractTypeCode]]>) {
      if (await prisma.contractTemplate.count({ where: { type } })) continue;
      await prisma.contractTemplate.create({ data: { type, name: t.name, version: 1, clauses: t.clauses as unknown as object } });
    }
    console.log(`reference data ok: ${PERMISSIONS.length} permissions, ${ROLES.length - 1} roles, ${Object.keys(UNITS).length} units`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error('seed-reference failed:', e instanceof Error ? e.message : 'unknown error');
  process.exit(1);
});
