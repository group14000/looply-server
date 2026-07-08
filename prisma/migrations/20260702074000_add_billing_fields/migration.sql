-- AlterTable
ALTER TABLE "users" ADD COLUMN     "billingPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "billingPlanId" TEXT,
ADD COLUMN     "billingStatus" TEXT,
ADD COLUMN     "billingSubscriptionId" TEXT,
ADD COLUMN     "billingSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "imageUrl" TEXT,
    "billingPlanId" TEXT,
    "billingStatus" TEXT,
    "billingSubscriptionId" TEXT,
    "billingPeriodEnd" TIMESTAMP(3),
    "billingSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "svixId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_clerkOrgId_key" ON "organizations"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhook_events_svixId_key" ON "processed_webhook_events"("svixId");
