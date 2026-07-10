/*
  Warnings:

  - Added the required column `organizationId` to the `feedback_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "feedback_requests" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "feedback_requests_organizationId_idx" ON "feedback_requests"("organizationId");

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
