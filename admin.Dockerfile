FROM node:20-alpine AS builder
WORKDIR /app/backend-monorepo
RUN apk add --no-cache openssl
COPY backend-monorepo/package*.json ./
RUN npm ci
COPY backend-monorepo/ ./
RUN npx prisma generate --schema libs/database/prisma/schema.prisma \
    && npx nest build admin-api \
    && npx nest build client-api \
    && npx nest build driver-api \
    && npx nest build backend-monorepo

FROM node:20-alpine AS runtime
WORKDIR /app/backend-monorepo
ENV NODE_ENV=production
RUN apk add --no-cache openssl \
    && mkdir -p /app/backend-monorepo/uploads/services \
    && chown -R node:node /app/backend-monorepo/uploads
COPY --from=builder --chown=node:node /app/backend-monorepo/package*.json ./
COPY --from=builder --chown=node:node /app/backend-monorepo/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/backend-monorepo/dist ./dist
COPY --from=builder --chown=node:node /app/backend-monorepo/libs/database/prisma ./libs/database/prisma
USER node
EXPOSE 3000 3001 3004
CMD ["node", "dist/apps/admin-api/main.js"]
