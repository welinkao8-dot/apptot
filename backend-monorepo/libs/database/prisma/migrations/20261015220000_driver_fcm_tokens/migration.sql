CREATE TABLE "driver_fcm_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_fcm_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "driver_fcm_tokens_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "driver_fcm_tokens_token_key" ON "driver_fcm_tokens"("token");
CREATE INDEX "driver_fcm_tokens_driver_id_idx" ON "driver_fcm_tokens"("driver_id");
