# BozorNarx — Bozor narxlari, bir joyda
Local market price tracking, comparison and safe-trade platform (Uzbekistan): web + installable PWA. Roles: Guest, Buyer, Seller, Moderator, Super Admin (permission-based). Status: PROJECT_STATUS.md · open work: TASKS.md · known issues: BUGS.md · design choices: DECISIONS.md · structure: ARCHITECTURE.md.

## Local run
```
docker compose up -d postgres
cp .env.example apps/api/.env           # fill secrets
cd apps/api && npm install && npx prisma migrate dev --name init && npm run build && npm run seed:reference && npm start
cd apps/web && npm install && API_URL=http://localhost:3001 npm run dev
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long passphrase' npm run create:admin   # in apps/api
```
Optional demo content (throw-away DB only): `ALLOW_DEMO_SEED=yes DEMO_PASSWORD='…' npm run seed:demo` · remove: add `DEMO_CLEANUP=yes`.
## Tests
`cd apps/api && npm test` (56 pure-logic tests) · `node apps/mail-script/mail-script.test.mjs` · after deploy: `API_URL=https://… npm run smoke`.
## Integrations
| Integration | State |
|---|---|
| Email (Apps Script) | implemented; needs `GAS_URL`/`GAS_SECRET` |
| Web push | implemented; needs VAPID keys |
| E-IMZO | adapter only — signing is refused until implemented with official docs |
| Card payments | interface only — cash on delivery works |
| SMS | not connected |
Deploy: docs/DEPLOY_RENDER.md · Email server: apps/mail-script/README.md
