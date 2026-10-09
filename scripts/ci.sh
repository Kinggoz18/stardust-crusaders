#!/usr/bin/env bash
# One entry point for lint, typecheck, unit/integration tests, builds, and migration up/down.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.bun/bin:${PATH}"

echo "==> install"
bun install --frozen-lockfile 2>/dev/null || bun install

echo "==> lint"
bun run lint

echo "==> typecheck"
bun run typecheck

echo "==> unit tests"
bun run --filter '@stardust/schema' test
bun run --filter '@stardust/api' test
bun run --filter '@stardust/admin' test

echo "==> integration tests (ephemeral Postgres)"
bun run --filter '@stardust/api' test:integration

echo "==> migration up/down check"
bun run --filter '@stardust/api' db:migrate:check

echo "==> build"
bun run build

echo "==> copy lint (admin)"
bash scripts/check-ui-copy.sh apps/admin || true

echo "==> e2e (admin) — skipped if Playwright browsers missing"
if bun run --filter '@stardust/admin' test:e2e; then
  echo "e2e ok"
else
  echo "e2e failed or skipped; see output above"
  exit 1
fi

echo "==> ci ok"
