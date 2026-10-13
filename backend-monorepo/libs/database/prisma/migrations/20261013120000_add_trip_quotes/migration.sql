CREATE TABLE "trip_quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "service_config_id" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "origin_address" TEXT NOT NULL,
    "origin_lat" DOUBLE PRECISION NOT NULL,
    "origin_lng" DOUBLE PRECISION NOT NULL,
    "dest_address" TEXT NOT NULL,
    "dest_lat" DOUBLE PRECISION NOT NULL,
    "dest_lng" DOUBLE PRECISION NOT NULL,
    "delivery_info" JSONB,
    "distance_meters" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "estimated_fare" DECIMAL(10,2) NOT NULL,
    "pricing_snapshot" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trip_quotes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trip_quotes_route_metrics_check" CHECK ("distance_meters" > 0 AND "duration_seconds" > 0),
    CONSTRAINT "trip_quotes_fare_nonnegative_check" CHECK ("estimated_fare" >= 0)
);

CREATE INDEX "trip_quotes_client_id_expires_at_idx" ON "trip_quotes"("client_id", "expires_at");
ALTER TABLE "trips" ADD COLUMN "quote_id" UUID;
CREATE UNIQUE INDEX "trips_quote_id_key" ON "trips"("quote_id");
ALTER TABLE "trips" ADD CONSTRAINT "trips_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "trip_quotes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
