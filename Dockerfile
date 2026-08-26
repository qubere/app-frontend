FROM node:20-alpine AS builder
WORKDIR /app

# Copy root and workspace dependencies
COPY package*.json turbo.json ./
COPY packages/db/package*.json ./packages/db/
COPY apps/custom/package*.json ./apps/custom/

# Copy all source files
COPY . .

# Install dependencies and build
RUN npm ci
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=apps/custom

# Production runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy standalone output and static assets
COPY --from=builder /app/apps/custom/.next/standalone ./
COPY --from=builder /app/apps/custom/.next/static ./apps/custom/.next/static
COPY --from=builder /app/apps/custom/public ./apps/custom/public

EXPOSE 8080
CMD ["node", "apps/custom/server.js"]
