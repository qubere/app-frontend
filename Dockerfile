# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS builder
WORKDIR /app

# Prisma and sharp both require native runtime libraries on Alpine.
RUN apk add --no-cache libc6-compat openssl

COPY . .

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_ENV=demo
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG GIT_COMMIT_SHA=unknown

# NEXT_PUBLIC values are intentionally provided at image build time because
# Next.js freezes them into browser bundles during `next build`.
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV VERCEL_GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN npm ci
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=apps/custom

FROM node:20-alpine AS web
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/apps/custom/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/custom/.next/static ./apps/custom/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/custom/public ./apps/custom/public

USER nextjs
EXPOSE 8080
CMD ["node", "apps/custom/server.js"]

# Demo worker target. It intentionally retains the installed workspace because
# the existing worker entry point is TypeScript and runs through tsx. This is
# larger than the web image, but keeps the demo deployment deterministic while
# the worker is later moved to a separately compiled package.
FROM builder AS worker
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=2048
CMD ["npm", "run", "worker:documents", "--workspace=apps/custom"]
