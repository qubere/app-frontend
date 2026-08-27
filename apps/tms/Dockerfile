FROM node:20-alpine AS builder
WORKDIR /app

# Copy root and workspace package files
COPY package*.json turbo.json ./
COPY packages/db/package*.json ./packages/db/
COPY apps/custom/package*.json ./apps/custom/
COPY apps/tms/package*.json ./apps/tms/

# Copy all source files
COPY . .

# Install dependencies, generate Prisma client, and build TMS app
RUN npm ci
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=apps/tms

# Production runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy standalone output and static assets for TMS
COPY --from=builder --chown=nextjs:nodejs /app/apps/tms/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/tms/.next/static ./apps/tms/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/tms/public ./apps/tms/public

USER nextjs
EXPOSE 8080

CMD ["node", "apps/tms/server.js"]
