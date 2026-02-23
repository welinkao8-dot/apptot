# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL in builder specific for Prisma generation
RUN apk add --no-cache openssl

# Copy root configurations
COPY package*.json ./
COPY backend-monorepo/package*.json ./backend-monorepo/

# Install dependencies
RUN npm install

# Copy source
COPY backend-monorepo/ ./backend-monorepo/

# Generate Prisma Client
WORKDIR /app/backend-monorepo
RUN npx prisma@5.21.0 generate --schema ./libs/database/prisma/schema.prisma

# Build ALL apps
RUN npx nest build admin-api
RUN npx nest build client-api
RUN npx nest build driver-api
RUN npx nest build backend-monorepo

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma (OpenSSL 3)
# We ensure the builder also used OpenSSL 3 so the engine matches
RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend-monorepo/package*.json ./backend-monorepo/
COPY --from=builder /app/backend-monorepo/dist ./backend-monorepo/dist
COPY --from=builder /app/backend-monorepo/node_modules ./backend-monorepo/node_modules
COPY --from=builder /app/backend-monorepo/libs/database/prisma ./backend-monorepo/libs/database/prisma
COPY --from=builder /app/backend-monorepo/scripts ./backend-monorepo/scripts
COPY --from=builder /app/backend-monorepo/tsconfig.json ./backend-monorepo/tsconfig.json

EXPOSE 3000 3001 3004

# Coolify will override this via CMD for each service, but we set a sane default that syncs the DB
# Coolify will override this via CMD for each service, but we set a sane default that syncs the DB and seeds the admin
CMD ["sh", "-c", "npx prisma@5.21.0 db push --schema=backend-monorepo/libs/database/prisma/schema.prisma --accept-data-loss && (cd backend-monorepo && npm run seed:admin) && node backend-monorepo/dist/apps/admin-api/main.js"]
