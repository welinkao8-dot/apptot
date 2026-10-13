CREATE TABLE "trip_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "method" VARCHAR(30) NOT NULL DEFAULT 'cash',
    "amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "confirmed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),
    CONSTRAINT "trip_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trip_payments_method_check" CHECK ("method" = 'cash'),
    CONSTRAINT "trip_payments_status_check" CHECK ("status" IN ('pending', 'confirmed')),
    CONSTRAINT "trip_payments_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "trip_payments_confirmation_check" CHECK (
        ("status" = 'pending' AND "confirmed_by" IS NULL AND "confirmed_at" IS NULL)
        OR ("status" = 'confirmed' AND "confirmed_by" IS NOT NULL AND "confirmed_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "trip_payments_trip_id_key" ON "trip_payments"("trip_id");
CREATE INDEX "trip_payments_status_created_at_idx" ON "trip_payments"("status", "created_at");
ALTER TABLE "trip_payments" ADD CONSTRAINT "trip_payments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "trip_payments" ADD CONSTRAINT "trip_payments_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
