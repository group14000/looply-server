-- AlterEnum
ALTER TYPE "FeedbackRequestStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX "feedback_requests_token_key";

-- AlterTable
ALTER TABLE "feedback_requests" DROP COLUMN "token",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "emailStatus" TEXT,
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" TEXT NOT NULL,
    "feedbackRequestId" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_submissions_feedbackRequestId_key" ON "feedback_submissions"("feedbackRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_requests_tokenHash_key" ON "feedback_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "feedback_requests_status_createdAt_idx" ON "feedback_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_feedbackRequestId_fkey" FOREIGN KEY ("feedbackRequestId") REFERENCES "feedback_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
