# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS source
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl jq git postgresql-client
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm ci
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

FROM source AS customs-builder
ARG CUSTOMS_APP_URL
ARG NEXT_PUBLIC_APP_ENV=demo
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG GIT_COMMIT_SHA=unknown
ENV NEXT_PUBLIC_APP_URL=${CUSTOMS_APP_URL} NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} GIT_COMMIT_SHA=${GIT_COMMIT_SHA} NEXT_PUBLIC_GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
RUN export NEXT_PUBLIC_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && \
    export NEXT_PUBLIC_DEPLOYMENT_LOG=$(git log -n 15 --pretty=format:'{"hash":"%h","date":"%aI","summary":"%s","author":"%an"}' 2>/dev/null | jq -cs . 2>/dev/null || echo "[]") && \
    npm run build --workspace=apps/custom

FROM node:20-alpine AS customs-web
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=customs-builder --chown=nextjs:nodejs /app/apps/custom/.next/standalone ./
COPY --from=customs-builder --chown=nextjs:nodejs /app/apps/custom/.next/static ./apps/custom/.next/static
COPY --from=customs-builder --chown=nextjs:nodejs /app/apps/custom/public ./apps/custom/public
USER nextjs
EXPOSE 8080
CMD ["node", "apps/custom/server.js"]

FROM source AS tms-builder
ARG TMS_APP_URL
ARG NEXT_PUBLIC_APP_ENV=demo
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG GIT_COMMIT_SHA=unknown
ENV NEXT_PUBLIC_APP_URL=${TMS_APP_URL} NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} GIT_COMMIT_SHA=${GIT_COMMIT_SHA} NEXT_PUBLIC_GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
RUN export NEXT_PUBLIC_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && \
    export NEXT_PUBLIC_DEPLOYMENT_LOG=$(git log -n 15 --pretty=format:'{"hash":"%h","date":"%aI","summary":"%s","author":"%an"}' 2>/dev/null | jq -cs . 2>/dev/null || echo "[]") && \
    npm run build --workspace=apps/tms

FROM node:20-alpine AS tms-web
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=tms-builder --chown=nextjs:nodejs /app/apps/tms/.next/standalone ./
COPY --from=tms-builder --chown=nextjs:nodejs /app/apps/tms/.next/static ./apps/tms/.next/static
COPY --from=tms-builder --chown=nextjs:nodejs /app/apps/tms/public ./apps/tms/public
USER nextjs
EXPOSE 8080
CMD ["node", "apps/tms/server.js"]

FROM source AS database
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy", "--schema=packages/db/prisma/schema.prisma"]

FROM source AS document-worker
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=1536
CMD ["sh", "infrastructure/gcp/run-document-job.sh"]

FROM source AS db-backup
ENV NODE_ENV=production
CMD ["sh", "infrastructure/gcp/run-db-backup.sh"]

