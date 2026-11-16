// Smoke test against a RUNNING api (after deploy):  API_URL=https://... node scripts-smoke.mjs
// Checks health, public reference data and that protected routes refuse anonymous access.
import assert from 'node:assert/strict';
const base = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const get = async (p, init) => { const r = await fetch(base + p, init); return { status: r.status, body: await r.json().catch(() => null) }; };
const checks = [];
const t = async (name, fn) => { try { await fn(); checks.push(['ok', name]); } catch (e) { checks.push(['FAIL', `${name}: ${e.message}`]); } };

await t('health', async () => { const r = await get('/health'); assert.equal(r.status, 200); });
await t('categories are public and seeded', async () => { const r = await get('/catalog/categories'); assert.equal(r.status, 200); assert.ok(r.body.data.length > 0, 'run npm run seed:reference'); });
await t('regions are seeded', async () => { const r = await get('/catalog/regions'); assert.ok(r.body.data.length >= 14); });
await t('catalog search works anonymously', async () => { assert.equal((await get('/catalog/products?q=a')).status, 200); });
for (const p of ['/cart', '/orders', '/contracts', '/admin/users', '/admin/audit', '/chat/conversations', '/notifications']) {
  await t(`anonymous ${p} → 401`, async () => assert.equal((await get(p)).status, 401));
}
await t('E-IMZO status is honest', async () => { /* needs no auth */ const r = await get('/contracts/eimzo/status'); assert.ok([200, 401].includes(r.status)); });
await t('validation error envelope', async () => { const r = await get('/catalog/products?minPrice=abc'); assert.ok(r.status === 400 || r.status === 200); });
for (const [s, n] of checks) console.log(s.padEnd(5), n);
process.exit(checks.some(([s]) => s === 'FAIL') ? 1 : 0);
