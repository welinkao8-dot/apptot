# Backend production startup and migrations

## Runtime contract

The API containers run compiled Node entrypoints and never run `prisma db push`. Database changes use the checked-in Prisma migrations. Each API exposes `GET /health`; it returns HTTP 200 only after PostgreSQL responds to `SELECT 1`.

Configure these values in the deployment environment before validating Compose:

- `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` — Postgres container credentials.
- `DATABASE_URL` — Prisma connection URL using `db` as the Compose hostname, for example `postgresql://user:percent-encoded-password@db:5432/database?schema=public`. URL-encode reserved characters in the password.
- `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` — independent random secrets.
- `ALLOWED_ORIGINS` — comma-separated production web origins. Native apps do not send browser CORS origins.
- `HERE_ROUTING_API_KEY` — required by the server quote endpoint.
- `DRIVER_API_URL=http://driver-api:3004` — internal admin-to-driver API destination.
- `ADMIN_API_URL` — public base URL used in uploaded service-image links.
- Optional host ports: `ADMIN_API_HOST_PORT`, `CLIENT_API_HOST_PORT`, and `DRIVER_API_HOST_PORT`.

The Compose file rejects missing required variables. Do not print the resolved Compose configuration in logs because it contains credentials.

## Fresh database

1. Take a backup location seriously even for the first release; confirm the target database is the intended one.
2. Run `docker compose -f docker-compose.prod.yml run --rm migrate`. This waits for PostgreSQL health and runs `prisma migrate deploy`.
3. Start the services with `docker compose -f docker-compose.prod.yml up -d --build`.
4. Check the health state for `admin-api`, `client-api`, and `driver-api`, then request `/health` through each configured API URL.

The baseline migration `20261012000000_initial_baseline` represents the Prisma schema from commit `c98cd16`. The following migrations add trip quotes and payment settlement. The migrations service is a manual deployment step; it is intentionally not run independently by every API replica.

## Existing database previously managed by `db push`

Do not run the fresh-database sequence against an existing database until its schema and migration history have been inspected. Earlier deployment files ran `db push --accept-data-loss`, and the actual production schema is not available in this repository. `migrate deploy` will try to create the baseline tables if the baseline is not recorded and can fail against an already populated schema.

1. Take and verify a restorable database backup; inspect `_prisma_migrations` and compare all existing tables, columns, indexes, foreign keys, and checks with the intended schema.
2. If the database exactly matches the historical baseline and contains none of the later objects, record only the baseline with `prisma migrate resolve --applied 20261012000000_initial_baseline`, then run `migrate deploy` to apply the two additive migrations.
3. If it already contains the quote/payment objects, compare each object to its migration SQL and record only the migrations proven fully applied with `prisma migrate resolve --applied <migration-id>`; do not resolve a partial migration.
4. If the schema differs or any migration is partial, stop and prepare a reviewed, database-specific repair migration and recovery plan before applying anything.

The existing-database baseline operation is deliberately manual. No automatic schema push, reset, seeding, or baseline resolution runs at container startup. Run `seed:admin` only as a separate, reviewed one-time operation if required.

## Rollback and readiness

Prisma migrations are forward-only here. Before deployment, retain a restorable backup and the previous image tags. If migration application fails, keep API rollout stopped, inspect `_prisma_migrations`, restore the backup or repair forward with a reviewed migration, then retry. Do not remove migration records or run a destructive schema reset as a rollback.

PostgreSQL uses `pg_isready`; each API healthcheck calls its unauthenticated database readiness route. Compose orders API startup after database readiness, but migration application remains an explicit pre-deploy step so the operator can verify the correct database and baseline first.
