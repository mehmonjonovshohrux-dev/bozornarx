# Deploying BozorNarx on Render

I could not deploy for you (no access to your Render account). Do these steps; nothing here is claimed to be done.

## 0. Before the first deploy (on your computer, needs internet)
```
cd apps/api && npm install
npx prisma validate
npx prisma migrate dev --name init     # needs a local Postgres (docker compose up -d postgres)
git add prisma/migrations              # COMMIT the migrations; the container refuses to start without them
cd ../web && npm install && npm run build
```
## 0b. Order of the first run
`prisma migrate deploy` → `seed-reference` (regions, categories, templates) run automatically in the container entrypoint. Then create the admin (step 4). Optional: VAPID keys for push (`npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). After deploy run `API_URL=https://<api> npm run smoke` in apps/api.
## 1. Email server
Follow `apps/mail-script/README.md`; you get `GAS_URL` and `GAS_SECRET`.
## 2. Render
1. Push the repo to GitHub. Render → **New → Blueprint** → pick the repo (uses `render.yaml`).
2. Fill the `sync:false` variables. Order matters: create API first → copy its URL → set `API_URL` on the web service (build time) → copy web URL → set `WEB_ORIGIN` and `APP_URL` on the API.
3. Check `https://<api>/health` → `{"success":true,...}`; it returns 503 `DB_DOWN` if Postgres is unreachable.
4. Create the first admin: API service → **Shell** → `ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... node dist/scripts/create-admin.js`. No demo data is created in production.
## Free-tier limits (be aware)
- Web services sleep after 15 min idle; first request takes ~1 min.
- Free Postgres expires after 30 days and has no backups → **use a paid database for real users**.
- Free filesystem is ephemeral (no uploads stored on disk).
Recommended for production: API Starter + web Starter + Postgres Basic.
## Backups
Paid Postgres has automatic backups. Also run weekly: `pg_dump "$DATABASE_URL" -Fc -f bozornarx-$(date +%F).dump` and store it off Render. Test a restore with `pg_restore -d <empty db> file.dump`.
## Env var list
See `.env.example`. Secrets: JWT_ACCESS_SECRET, OTP_HASH_PEPPER, GAS_SECRET, DATABASE_URL, SENTRY_DSN, ADMIN_PASSWORD. Never in frontend code, URLs or logs.
## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| API exits “prisma/migrations empty” | Run step 0 and commit migrations |
| Browser “CORS” error | `WEB_ORIGIN` must equal the web URL exactly (https, no trailing slash) |
| `/api/*` returns 404 on web | `API_URL` missing at build time → set it and redeploy web |
| Login works but session lost on reload | web and API reached through different hosts; use the `/api` rewrite, keep `x-client: web` |
| No email arrives | see mail-script README; check `MAIL_*` codes in API logs |
| Install button missing | PWA needs HTTPS and a production build (`npm run build`) |
## PWA
Manifest, icons (192/512/maskable), service worker (`/sw.js`, API never cached, offline fallback `/offline`), update toast, install prompt, iOS hint are in `apps/web`. Push: the worker handles `push`; the API sends with `web-push` once VAPID keys are set (users enable it on the Notifications page). iOS needs the app added to the Home Screen first.
## Not connected on purpose
E-IMZO (`EIMZO_MODE=disabled`), card payments (`PAYMENT_PROVIDER_MODE=none`), SMS. The UI states this instead of faking success. Realtime uses one API instance (do not scale out without Redis).
