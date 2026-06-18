FROM node:22-bookworm-slim AS base
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package*.json ./
ENV NODE_ENV=development
RUN npm ci --include=dev --audit=false

FROM base AS build
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/build
RUN npm run db:generate
RUN npm run build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev --omit=optional --audit=false && rm -f package-lock.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/scripts/wait-for-db.mjs ./scripts/wait-for-db.mjs
COPY --from=build /app/scripts/apply-migrations.mjs ./scripts/apply-migrations.mjs
EXPOSE 3000
CMD ["sh", "-c", "npm run db:wait && npm run db:migrate && npm run start"]
