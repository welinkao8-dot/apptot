CREATE TABLE "trip_driver_offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'offered',
    "offered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "responded_at" TIMESTAMPTZ,
    CONSTRAINT "trip_driver_offers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trip_driver_offers_status_check" CHECK ("status" IN ('offered', 'accepted', 'rejected', 'expired', 'cancelled')),
    CONSTRAINT "trip_driver_offers_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trip_driver_offers_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "trip_driver_offers_trip_id_driver_id_key" ON "trip_driver_offers"("trip_id", "driver_id");
CREATE INDEX "trip_driver_offers_driver_id_status_expires_at_idx" ON "trip_driver_offers"("driver_id", "status", "expires_at");
CREATE INDEX "trip_driver_offers_trip_id_status_expires_at_idx" ON "trip_driver_offers"("trip_id", "status", "expires_at");
