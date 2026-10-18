CREATE TABLE "admin_auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_auth_sessions_refresh_token_hash_key"
    ON "admin_auth_sessions"("refresh_token_hash");

CREATE INDEX "admin_auth_sessions_admin_id_revoked_at_expires_at_idx"
    ON "admin_auth_sessions"("admin_id", "revoked_at", "expires_at");

ALTER TABLE "admin_auth_sessions"
    ADD CONSTRAINT "admin_auth_sessions_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
