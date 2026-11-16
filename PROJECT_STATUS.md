# Status (2026-11-16)

**Written (all five roles, all main modules, front and back wired):** auth + registration fix · catalog/categories/units/regions/markets · products CRUD + images + variants · prices CRUD, history, stock ledger, wholesale tiers, evidence, staleness, Trust Score, moderation · search + multi-filter + compare · stores + documents + discounts · cart · orders (state machine, cash on delivery, delivery evidence, reviews) · buyer–seller offers · contracts (templates, versions, PDF, review, sign adapter, archive, delivery act) · disputes + appeal · chat (SSE, files) · notifications (in-app, email, web-push) · price alerts · favorites · complaints · admin (users, roles, plans, settings, audit + CSV, templates, regions/markets/categories) · analytics (regional stats, store map, movers, forecast preparation) · maintenance job · PWA (manifest, service worker, offline page, icons) · mobile bottom nav.

**Verified by running:** 56 domain tests, 12 Apps Script tests (pass).
**Verified statically:** syntax of every file, import/export resolution, Prisma relation symmetry, Prisma delegate names, permission names.
**NOT verified:** TypeScript type-checking, `prisma validate`, `next build`, any HTTP request, any database query. No network was available.
**External, not connected (honestly reported as such):** E-IMZO, card payments, SMS. Push needs VAPID keys.
