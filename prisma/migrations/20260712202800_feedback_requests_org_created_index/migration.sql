-- DropIndex
DROP INDEX "feedback_requests_organizationId_idx";

-- CreateIndex
CREATE INDEX "feedback_requests_organizationId_createdAt_idx" ON "feedback_requests"("organizationId", "createdAt");
