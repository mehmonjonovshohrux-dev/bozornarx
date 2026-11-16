#!/bin/sh
# Safe start sequence: migrate, load reference data (roles, permissions, units, regions, categories, default contract templates; never demo data), then start the API.
set -eu

if [ ! -d prisma/migrations ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "ERROR: prisma/migrations is empty. Create the first migration locally with:"
  echo "  npx prisma migrate dev --name init"
  echo "then commit apps/api/prisma/migrations and redeploy. Refusing to start without migrations."
  exit 1
fi

echo "[entrypoint] applying database migrations (prisma migrate deploy)"
npx prisma migrate deploy

echo "[entrypoint] loading reference data"
node dist/scripts/seed-reference.js

# Optional one-off tasks, driven by environment variables set in the Render dashboard (remove them afterwards).
# They never stop the API from starting; failures are only logged.
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] creating first super admin (skipped if the email already exists)"
  node dist/scripts/create-admin.js || echo "[entrypoint] create-admin did not change anything (see message above)"
fi
if [ "${DEMO_SEED:-}" = "yes" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  echo "[entrypoint] loading DEMO data (tagged @demo.bozornarx.invalid)"
  ALLOW_DEMO_SEED=yes ALLOW_DEMO_IN_PRODUCTION=yes node dist/scripts/seed-demo.js || echo "[entrypoint] demo seed failed (see message above)"
fi
if [ "${DEMO_CLEANUP:-}" = "yes" ]; then
  echo "[entrypoint] removing DEMO data"
  ALLOW_DEMO_SEED=yes ALLOW_DEMO_IN_PRODUCTION=yes DEMO_CLEANUP=yes node dist/scripts/seed-demo.js || echo "[entrypoint] demo cleanup failed (see message above)"
fi

echo "[entrypoint] starting API"
exec node dist/main.js
