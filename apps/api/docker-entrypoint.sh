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

echo "[entrypoint] making sure every table has row-level security (blocks public REST access)"
node dist/scripts/ensure-rls.js || echo "[entrypoint] ensure-rls failed (see message above); continuing"

echo "[entrypoint] loading reference data"
node dist/scripts/seed-reference.js

# Optional one-off tasks, driven by environment variables set in the Render dashboard (remove them afterwards).
# They never stop or delay the API from starting; the demo tasks run in the background and failures are only logged.
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] super admin: create, or sync the password from ADMIN_PASSWORD"
  node dist/scripts/create-admin.js || echo "[entrypoint] create-admin did not change anything (see message above)"
fi
# Demo accounts must always be able to sign in: this step is fast (seconds) and independent of the big demo seed below.
if [ -n "${DEMO_PASSWORD:-}" ] && [ "${DEMO_CLEANUP:-}" != "yes" ]; then
  echo "[entrypoint] ensuring demo accounts (demo.*@example.com) can sign in with DEMO_PASSWORD"
  node dist/scripts/ensure-demo-accounts.js || echo "[entrypoint] ensure-demo-accounts failed (see message above)"
fi
# Background chain: prune (optional) -> demo seed (optional) -> demo cleanup (optional). The seed over a remote database takes many minutes
# and must never delay the port (Render kills a deploy that does not open its port), so none of this blocks the API start.
(
  if [ "${PRUNE_USERS:-}" = "yes" ]; then
    echo "[entrypoint] pruning accounts (keeps demo accounts, ADMIN_EMAIL and Super Admins)"
    PRUNE_USERS=yes node dist/scripts/prune-users.js || echo "[entrypoint] prune failed (see message above)"
  fi
  if [ "${DEMO_SEED:-}" = "yes" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
    echo "[entrypoint] loading DEMO data (accounts demo.*@example.com)"
    ALLOW_DEMO_SEED=yes ALLOW_DEMO_IN_PRODUCTION=yes node dist/scripts/seed-demo.js && echo "[entrypoint] demo seed finished" || echo "[entrypoint] demo seed failed (see message above)"
  fi
  if [ "${DEMO_SEED:-}" = "yes" ] && [ -n "${DEMO_PASSWORD:-}" ] && [ "${DEMO_SIGNING:-}" = "enabled" ]; then
    echo "[entrypoint] creating and signing DEMO contracts"
    node dist/scripts/seed-demo-contracts.js || echo "[entrypoint] demo contracts failed (see message above)"
  fi
  if [ "${DEMO_SEED:-}" = "yes" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
    node dist/scripts/seed-demo-extra.js || echo "[entrypoint] demo extra data failed (see message above)"
  fi
  if [ "${DEMO_CLEANUP:-}" = "yes" ]; then
    echo "[entrypoint] removing DEMO data"
    ALLOW_DEMO_SEED=yes ALLOW_DEMO_IN_PRODUCTION=yes DEMO_CLEANUP=yes node dist/scripts/seed-demo.js && echo "[entrypoint] demo cleanup finished" || echo "[entrypoint] demo cleanup failed (see message above)"
  fi
) &

echo "[entrypoint] starting API"
exec node dist/main.js
