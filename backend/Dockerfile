# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY drizzle.config.ts ./

RUN npm run build
# Copy migration files (non-TS, not handled by tsc)
RUN cp -r src/db/migrations dist/db/migrations

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY drizzle.config.ts ./

RUN mkdir -p /uploads

EXPOSE 3000

CMD ["node", "dist/server.js"]
