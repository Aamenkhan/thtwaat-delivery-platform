-- Worker profile fields, OTP sessions, order gig payout + lifecycle timestamps.

CREATE TYPE "OtpType" AS ENUM (
  'PICKUP_FROM_SELLER',
  'DELIVERY_TO_CUSTOMER',
  'DROP_AT_HUB'
);

ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "vehicleNumber" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "vehicleType" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "aadhaarNumber" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "aadhaarPhotoUrl" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "drivingLicenseNo" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "drivingLicenseUrl" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "lastLat" DOUBLE PRECISION;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "lastLng" DOUBLE PRECISION;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "bankIfsc" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;

CREATE TABLE "WorkerOtpSession" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "hubId" TEXT,
  "otpType" "OtpType" NOT NULL,
  "otp" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "isUsed" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "workerId" TEXT,
  CONSTRAINT "WorkerOtpSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkerOtpSession_orderId_otpType_isUsed_idx" ON "WorkerOtpSession"("orderId", "otpType", "isUsed");
CREATE INDEX "WorkerOtpSession_phone_otpType_expiresAt_idx" ON "WorkerOtpSession"("phone", "otpType", "expiresAt");
CREATE INDEX "WorkerOtpSession_workerId_idx" ON "WorkerOtpSession"("workerId");
ALTER TABLE "WorkerOtpSession" ADD CONSTRAINT "WorkerOtpSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickupWorkerEarningCents" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryWorkerEarningCents" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "otpVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "atSourceHubAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "uploadedByWorkerId" TEXT;

-- New order statuses (PostgreSQL 15+ supports IF NOT EXISTS on enum values).
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKUP_SCANNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'SELLER_CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_ASSIGNED';
