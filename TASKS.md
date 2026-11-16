# Tasks

## Needs YOU (cannot be done from here)
- [ ] `npm install` in `apps/api` and `apps/web`; run `npx prisma validate`, `npx prisma migrate dev --name init`, commit `prisma/migrations`.
- [ ] `npm run build` in both apps and fix the first round of type errors (code was never compiled).
- [ ] Deploy mail script (apps/mail-script/README.md) → `GAS_URL`, `GAS_SECRET`.
- [ ] Generate VAPID keys (`npx web-push generate-vapid-keys`) to enable push.
- [ ] E-IMZO: obtain the official integration docs / server-side verification service and credentials, then implement `EimzoService.verify` (src/contracts/eimzo.adapter.ts) and set `EIMZO_MODE=enabled`; then switch the setting `orders.requireSignedContract` on.
- [ ] Payment provider (Payme/Click/Uzum…): implement the `PaymentProvider` interface in `src/trade/payments.service.ts`.
- [ ] SMS provider for phone OTP.
- [ ] GitHub push and Render deployment (only when you decide; not done).

## Code still open
- [ ] Unicode font embedding in PDFs (currently Latin transliteration).
- [ ] Redis pub/sub for `EventsHub` if more than one API instance is ever run.
- [ ] Object storage (S3/R2) instead of PostgreSQL `bytea` for files once volume grows.
- [ ] Real map tiles (Leaflet/OSM) — the current map is an offline SVG plot of store coordinates.
- [ ] Trained price-forecast model — only data preparation + a linear-trend baseline exist.
- [ ] Automated API/e2e tests (need a Postgres + installed deps); only pure-logic tests and `npm run smoke` exist.
- [ ] Frontend: TanStack Query was replaced by a small `useApi` hook (no installs possible); swap if caching is wanted.
- [ ] Moderator UI for contract templates beyond SALE, and for category rename.
- [ ] Seller: dedicated screen for stock ledger export and bulk price import (CSV).
- [ ] i18n: all text is Uzbek (Latin); Russian/English not started.
