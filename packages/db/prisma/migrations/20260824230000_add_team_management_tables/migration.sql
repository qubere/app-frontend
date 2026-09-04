-- CreateTable
CREATE TABLE "UserClientAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "UserClientAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamClientAssignment" (
    "teamId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamClientAssignment_pkey" PRIMARY KEY ("teamId","clientId")
);

-- CreateIndex
CREATE INDEX "UserClientAssignment_userId_idx" ON "UserClientAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserClientAssignment_clientId_idx" ON "UserClientAssignment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "UserClientAssignment_userId_clientId_key" ON "UserClientAssignment"("userId", "clientId");

-- CreateIndex
CREATE INDEX "Team_accountId_idx" ON "Team"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_accountId_name_key" ON "Team"("accountId", "name");

-- CreateIndex
CREATE INDEX "AccountTeamMembership_userId_idx" ON "AccountTeamMembership"("userId");

-- CreateIndex
CREATE INDEX "AccountTeamMembership_teamId_idx" ON "AccountTeamMembership"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTeamMembership_teamId_userId_key" ON "AccountTeamMembership"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TeamClientAssignment_clientId_idx" ON "TeamClientAssignment"("clientId");

-- AddForeignKey
ALTER TABLE "UserClientAssignment" ADD CONSTRAINT "UserClientAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserClientAssignment" ADD CONSTRAINT "UserClientAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTeamMembership" ADD CONSTRAINT "AccountTeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTeamMembership" ADD CONSTRAINT "AccountTeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamClientAssignment" ADD CONSTRAINT "TeamClientAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamClientAssignment" ADD CONSTRAINT "TeamClientAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
