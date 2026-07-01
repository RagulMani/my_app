-- @apply
CREATE TABLE IF NOT EXISTS "contacts" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "first_name" TEXT,
  "last_name"  TEXT,
  "email"      TEXT,
  "phone"      TEXT,
  "title"      TEXT,
  "company_id" UUID NOT NULL,
  "owner_id"   UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_contacts_company_id ON "contacts" ("company_id");
CREATE INDEX IF NOT EXISTS ix_contacts_owner_id ON "contacts" ("owner_id");
CREATE INDEX IF NOT EXISTS ix_contacts_email ON "contacts" ("email");

-- @rollback
DROP INDEX IF EXISTS ix_contacts_email;
DROP INDEX IF EXISTS ix_contacts_owner_id;
DROP INDEX IF EXISTS ix_contacts_company_id;
DROP TABLE IF EXISTS "contacts";