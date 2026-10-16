FROM node:24-slim AS base
# Prisma necesita openssl para el motor de migraciones.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS deps-prod
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

FROM base
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=deps-prod --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
USER node
EXPOSE 4000
# Las migraciones no se aplican acá: desde Fly.io el motor de migraciones de
# Prisma no logra conectarse a Supabase (P1001), aunque la API sí. Se aplican
# desde la máquina local antes del deploy (ver CLAUDE.md).
CMD ["node", "dist/main.js"]
