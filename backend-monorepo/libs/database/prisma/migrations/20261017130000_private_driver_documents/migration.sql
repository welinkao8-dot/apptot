BEGIN;

CREATE TABLE "driver_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "document_type" VARCHAR(32) NOT NULL,
    "content" BYTEA,
    "mime_type" VARCHAR(32) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ(6),
    "retention_until" TIMESTAMPTZ(6),
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deletion_reason" VARCHAR(32),
    CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "driver_documents_type_check" CHECK ("document_type" IN ('bi_frente', 'bi_verso', 'carta')),
    CONSTRAINT "driver_documents_mime_check" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT "driver_documents_size_check" CHECK ("size_bytes" BETWEEN 1 AND 8388608),
    CONSTRAINT "driver_documents_tombstone_check" CHECK (
      ("content" IS NOT NULL AND "deleted_at" IS NULL)
      OR ("content" IS NULL AND "deleted_at" IS NOT NULL)
    ),
    CONSTRAINT "driver_documents_drivers_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "driver_documents_driver_type_lifecycle_idx"
  ON "driver_documents"("driver_id", "document_type", "superseded_at", "deleted_at");
CREATE INDEX "driver_documents_retention_lifecycle_idx"
  ON "driver_documents"("retention_until", "legal_hold", "deleted_at");
CREATE UNIQUE INDEX "driver_documents_one_current_type_idx"
  ON "driver_documents"("driver_id", "document_type")
  WHERE "superseded_at" IS NULL AND "deleted_at" IS NULL;

DO $$
DECLARE
  legacy record;
  document_bytes BYTEA;
  image_mime TEXT;
  base64_body TEXT;
  invalid_bytes BOOLEAN;
BEGIN
  FOR legacy IN
    SELECT d."id" AS driver_id, source.document_type, source.data_uri
    FROM "drivers" d
    CROSS JOIN LATERAL (VALUES
      ('bi_frente'::TEXT, d."doc_bi_frente"),
      ('bi_verso'::TEXT, d."doc_bi_verso"),
      ('carta'::TEXT, d."doc_carta_conducao")
    ) AS source(document_type, data_uri)
    WHERE source.data_uri IS NOT NULL
  LOOP
    IF legacy.data_uri !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$' THEN
      RAISE EXCEPTION 'Cannot migrate malformed legacy document for driver % (%).', legacy.driver_id, legacy.document_type;
    END IF;

    image_mime := split_part(split_part(legacy.data_uri, ';', 1), ':', 2);
    base64_body := split_part(legacy.data_uri, ',', 2);
    IF length(base64_body) = 0 OR length(base64_body) % 4 <> 0 THEN
      RAISE EXCEPTION 'Cannot migrate malformed legacy document for driver % (%).', legacy.driver_id, legacy.document_type;
    END IF;

    document_bytes := decode(base64_body, 'base64');
    IF octet_length(document_bytes) < 1 OR octet_length(document_bytes) > 8388608 THEN
      RAISE EXCEPTION 'Cannot migrate out-of-range legacy document for driver % (%).', legacy.driver_id, legacy.document_type;
    END IF;

    invalid_bytes := CASE image_mime
      WHEN 'image/jpeg' THEN octet_length(document_bytes) < 3 OR get_byte(document_bytes, 0) <> 255 OR get_byte(document_bytes, 1) <> 216 OR get_byte(document_bytes, 2) <> 255
      WHEN 'image/png' THEN octet_length(document_bytes) < 8 OR substring(document_bytes FROM 1 FOR 8) <> decode('89504e470d0a1a0a', 'hex')
      WHEN 'image/webp' THEN octet_length(document_bytes) < 12 OR substring(document_bytes FROM 1 FOR 4) <> convert_to('RIFF', 'UTF8') OR substring(document_bytes FROM 9 FOR 4) <> convert_to('WEBP', 'UTF8')
      ELSE TRUE
    END;
    IF invalid_bytes THEN
      RAISE EXCEPTION 'Cannot migrate document whose MIME and signature disagree for driver % (%).', legacy.driver_id, legacy.document_type;
    END IF;
  END LOOP;
END $$;

INSERT INTO "driver_documents" ("driver_id", "document_type", "content", "mime_type", "size_bytes", "uploaded_at")
SELECT d."id", source.document_type,
       decode(split_part(source.data_uri, ',', 2), 'base64'),
       split_part(split_part(source.data_uri, ';', 1), ':', 2),
       octet_length(decode(split_part(source.data_uri, ',', 2), 'base64')),
       COALESCE(d."updated_at"::timestamptz, d."created_at"::timestamptz, CURRENT_TIMESTAMP)
FROM "drivers" d
CROSS JOIN LATERAL (VALUES
  ('bi_frente'::TEXT, d."doc_bi_frente"),
  ('bi_verso'::TEXT, d."doc_bi_verso"),
  ('carta'::TEXT, d."doc_carta_conducao")
) AS source(document_type, data_uri)
WHERE source.data_uri IS NOT NULL;

ALTER TABLE "drivers"
  DROP COLUMN "doc_bi_frente",
  DROP COLUMN "doc_bi_verso",
  DROP COLUMN "doc_carta_conducao";

COMMIT;
