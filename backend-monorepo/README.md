# TOT backend monorepo

The active backend is the NestJS monorepo. `admin-api`, `client-api`, and `driver-api` share the Prisma schema and the PostgreSQL database. The old standalone Express servers are preserved under `archive/legacy-backends/` and are not part of local or production startup.

## Local development

Install dependencies from this directory, generate Prisma Client, and start PostgreSQL with the repository's `docker-compose.yml` if needed:

```powershell
npm ci
npx prisma generate --schema libs/database/prisma/schema.prisma
```

Set `DATABASE_URL`, `JWT_SECRET`, and the API-specific keys in your local environment. Start each service in a separate terminal from this directory:

```powershell
npm run start:dev -- admin-api
npm run start:dev -- client-api
npm run start:dev -- driver-api
```

The default ports are 3000, 3001, and 3004. Never run production migrations against a local database with important data; use `npm run db:migrate:deploy` only for the intended database.

## API rate limits

All three APIs limit each route to 120 requests per client IP per 60 seconds by default. Configure `API_RATE_LIMIT_LIMIT` and `API_RATE_LIMIT_TTL_MS` to change the limit and window. The Nest guard returns HTTP 429 after the budget is exhausted and includes rate-limit headers.

The tracker uses Express's trusted-proxy setting. `TRUST_PROXY_HOPS` defaults to `0`; set the exact number of trusted reverse-proxy hops in the deployment environment only when requests are guaranteed to pass through those proxies. Do not trust forwarded headers from clients that can reach the API directly. The built-in storage is per process, so multiple replicas need shared throttler storage before horizontal scaling; otherwise each replica has its own budget.

## Validation

```powershell
npm test -- --runInBand
npx jest --config apps/admin-api/test/jest-e2e.json --runInBand
npx jest --config apps/client-api/test/jest-e2e.json --runInBand
npx jest --config apps/driver-api/test/jest-e2e.json --runInBand
npx nest build admin-api
npx nest build client-api
npx nest build driver-api
```

The disposable PostgreSQL 15 integration harness is `npm run test:plan01:postgres`. It starts and removes its own uniquely named test container and refuses non-local database URLs. It does not connect to the developer's `tot_db` container.

Production Compose uses the root `backend.Dockerfile` and starts the three compiled Nest applications. Production rollout instructions remain in the repository's `DEPLOY_GUIDE_COOLIFY.md`.
