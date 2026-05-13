-- Hub profile, bus partners, transport partners, hub truck bookings, gig assignments.
-- Note: `PartnerTruckBooking` is separate from seller-scoped `TruckBooking`.

CREATE TYPE "HubGigRole" AS ENUM ('PICKUP', 'DELIVERY');
CREATE TYPE "TruckOwnership" AS ENUM ('OWN', 'COMMISSION');
CREATE TYPE "PartnerTruckBookingStatus" AS ENUM (
  'REQUESTED',
  'CONFIRMED',
  'LOADING',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED'
);

CREATE TABLE "HubProfile" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "photoUrl" TEXT,
  "description" TEXT,
  "managerName" TEXT NOT NULL,
  "managerPhone" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HubProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HubProfile_hubId_key" ON "HubProfile"("hubId");
ALTER TABLE "HubProfile" ADD CONSTRAINT "HubProfile_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BusServicePartner" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "driverName" TEXT NOT NULL,
  "driverPhone" TEXT NOT NULL,
  "busNumber" TEXT NOT NULL,
  "busType" TEXT NOT NULL,
  "routeFrom" TEXT NOT NULL,
  "routeTo" TEXT NOT NULL,
  "departureTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "pricePerParcel" DOUBLE PRECISION NOT NULL DEFAULT 40,
  "maxParcels" INTEGER NOT NULL DEFAULT 50,
  "photoUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusServicePartner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusServicePartner_hubId_idx" ON "BusServicePartner"("hubId");
CREATE UNIQUE INDEX "BusServicePartner_hubId_busNumber_key" ON "BusServicePartner"("hubId", "busNumber");
ALTER TABLE "BusServicePartner" ADD CONSTRAINT "BusServicePartner_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TransportPartner" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "ownerPhone" TEXT NOT NULL,
  "ownerPhone2" TEXT,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "photoUrl" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransportPartner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransportPartner_hubId_idx" ON "TransportPartner"("hubId");
ALTER TABLE "TransportPartner" ADD CONSTRAINT "TransportPartner_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Truck" (
  "id" TEXT NOT NULL,
  "transportPartnerId" TEXT NOT NULL,
  "truckNumber" TEXT NOT NULL,
  "truckType" TEXT NOT NULL,
  "capacityTons" DOUBLE PRECISION NOT NULL,
  "photoUrl" TEXT,
  "ownershipType" "TruckOwnership" NOT NULL DEFAULT 'OWN',
  "commissionPercent" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Truck_truckNumber_key" ON "Truck"("truckNumber");
CREATE INDEX "Truck_transportPartnerId_idx" ON "Truck"("transportPartnerId");
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_transportPartnerId_fkey" FOREIGN KEY ("transportPartnerId") REFERENCES "TransportPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerTruckBooking" (
  "id" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "bookedByHubId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "pickupAddress" TEXT NOT NULL,
  "deliveryAddress" TEXT NOT NULL,
  "goodsType" TEXT NOT NULL,
  "weightTons" DOUBLE PRECISION NOT NULL,
  "agreedPrice" DOUBLE PRECISION NOT NULL,
  "appCommission" DOUBLE PRECISION NOT NULL,
  "status" "PartnerTruckBookingStatus" NOT NULL DEFAULT 'REQUESTED',
  "scheduledDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerTruckBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerTruckBooking_truckId_idx" ON "PartnerTruckBooking"("truckId");
CREATE INDEX "PartnerTruckBooking_bookedByHubId_idx" ON "PartnerTruckBooking"("bookedByHubId");
ALTER TABLE "PartnerTruckBooking" ADD CONSTRAINT "PartnerTruckBooking_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerTruckBooking" ADD CONSTRAINT "PartnerTruckBooking_bookedByHubId_fkey" FOREIGN KEY ("bookedByHubId") REFERENCES "Hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HubWorkerAssignment" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "gigRole" "HubGigRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HubWorkerAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HubWorkerAssignment_hubId_workerId_key" ON "HubWorkerAssignment"("hubId", "workerId");
CREATE INDEX "HubWorkerAssignment_workerId_idx" ON "HubWorkerAssignment"("workerId");
ALTER TABLE "HubWorkerAssignment" ADD CONSTRAINT "HubWorkerAssignment_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubWorkerAssignment" ADD CONSTRAINT "HubWorkerAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "busServicePartnerId" TEXT;
CREATE INDEX "Order_busServicePartnerId_idx" ON "Order"("busServicePartnerId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_busServicePartnerId_fkey" FOREIGN KEY ("busServicePartnerId") REFERENCES "BusServicePartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
