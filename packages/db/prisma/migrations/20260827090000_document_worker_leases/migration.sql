CREATE TABLE "DocumentWorkerLease" (
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentWorkerLease_pkey" PRIMARY KEY ("name")
);
CREATE INDEX "DocumentWorkerLease_expiresAt_idx" ON "DocumentWorkerLease"("expiresAt");
