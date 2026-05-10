-- AlterTable
ALTER TABLE "Worker" ADD COLUMN "homeHubId" TEXT;

-- CreateIndex
CREATE INDEX "Worker_homeHubId_idx" ON "Worker"("homeHubId");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_homeHubId_fkey" FOREIGN KEY ("homeHubId") REFERENCES "Hub"("id") ON DELETE SET NULL ON UPDATE CASCADE;
