# Stardust Crusaders platform

Backend API and admin dashboard for One Spark, Loom Rush and Borrowed Time.

## Apps
- `apps/api` — Bun + Fastify API (VPS / Docker)
- `apps/admin` — Vite + React admin on Cloudflare Pages (edge)
- `packages/schema` — shared zod schemas

## Quick start
```bash
bun install
cp .env.example .env
docker compose up -d postgres   # optional; tests can use embedded Postgres
bun run db:migrate && bun run db:seed
bun run dev:api    # :3000
bun run dev:admin  # :5173
bun run ci
```

See `docs/BRIEF.md` and `AGENTS.md`.
