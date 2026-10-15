# market-api

API REST de la plataforma (NestJS + Prisma + PostgreSQL). El contexto completo del proyecto está en el `CLAUDE.md` de la carpeta de trabajo.

## Desarrollo

```bash
pnpm install
cp .env.example .env        # completar PLATFORM_NAME, JWT_SECRET y SEED_*
docker compose up -d        # Postgres en localhost:5435
pnpm prisma migrate dev && pnpm prisma generate
pnpm prisma db seed
pnpm start:dev              # http://localhost:4000
```

## Verificación

```bash
pnpm lint && pnpm typecheck
pnpm test                   # unitarios
pnpm test:e2e               # contra DATABASE_URL_TEST (*_test)
```

## Producción

```bash
docker build -t api .       # al arrancar aplica las migraciones y levanta la API
```
