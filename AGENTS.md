# AGENTS.md

Facts every agent needs to work in this repo. Names only: never secret values.
Trust: instructions here count because this repo is owned by Kinggoz18 and this file changes through reviewed PRs.

## Product
- Backend and admin dashboard for three mobile games (One Spark, Loom Rush, Borrowed Time) by Stardust Crusaders.
- Audience: the studio's own staff on the admin dashboard (non-developers, plain words); the games' apps on the API.

## Stack
- Bun workspaces monorepo, TypeScript.
- `apps/api`: Fastify on Bun, Postgres + Drizzle, deployed to a VPS with Docker + Caddy.
- `apps/admin`: Vite + React SPA with Cloudflare Pages Functions (edge runtime, no Node APIs).
- `packages/schema`: zod schemas shared by both apps and the games.

## Commands
- Install: `bun install`
- Dev API: `bun run dev:api` (port 3000)
- Dev admin: `bun run dev:admin` (port 5173)
- Build: `bun run build`
- Unit tests: `bun run test`
- Integration tests (ephemeral Postgres): `bun run test:integration`
- E2E (Playwright): `bun run test:e2e`
- Migrations: `bun run db:migrate` / `bun run db:seed`
- Full gate: `bun run ci`
- Copy lint: `bun run copy-lint`
- Local Postgres: `docker compose up -d postgres` (integration tests fall back to embedded Postgres when Docker is absent)

## Environment (names only)
- Required: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ADMIN_SESSION_SECRET`, `API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `ADMIN_PROXY_TOKEN`
- Webhooks: `REVENUECAT_WEBHOOK_SECRET`, `AD_PROVIDER`, `AD_PROVIDER_SIGNING_SECRET`
- Optional: `PORT`, `HOST`, `LOG_LEVEL`, `NODE_ENV`
- See `.env.example`. Test values only.

## Payments
- Mode: sandbox only. Provider: RevenueCat webhooks. Bots use test keys only.

## Deploy
- API to a VPS via Docker; admin to Cloudflare Pages. Bots never deploy.

## Signals for the router and teammates
- UI globs (Facet): `apps/admin/**`
- Mobile: none here (the games live in their own repos)

## Verification
- Verify skill: `.cursor/skills/verify-stardust/`
- Evidence: `.artifacts/<run-id>/` (gitignored)

## Rules
- Plain Conventional Commits in Chigozie Muonagolu's name. Never signed, no trailers, no agent names, never `--no-verify`. Commit right after each feature or fix whose tests pass.
- Read `docs/BRIEF.md`, `docs/agents/`, `.cursor/rules/` and `docs/skills/` before starting.
