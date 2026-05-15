-- Extended KYC + onboarding gate (fee + training) for worker gig eligibility.

ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "aadhaarBackPhotoUrl" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "panNumber" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "panFrontPhotoUrl" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "panBackPhotoUrl" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "vehicleFrontPhotoUrl" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "vehicleBackPhotoUrl" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "vehicleFuelType" TEXT;
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "onboardingFeePaidAt" TIMESTAMP(3);
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "trainingCompletedAt" TIMESTAMP(3);
