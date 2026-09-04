-- AddForeignKey
ALTER TABLE "RdpsPartyOutcome" ADD CONSTRAINT "RdpsPartyOutcome_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
