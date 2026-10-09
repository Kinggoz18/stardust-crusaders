FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages/schema/package.json packages/schema/
COPY apps/api/package.json apps/api/
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1.2-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/api ./apps/api
COPY packages/schema ./packages/schema
COPY apps/api ./apps/api
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
