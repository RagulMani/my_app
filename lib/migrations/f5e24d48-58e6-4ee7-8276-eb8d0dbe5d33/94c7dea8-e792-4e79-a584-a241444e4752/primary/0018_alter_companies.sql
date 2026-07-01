-- @apply
ALTER TABLE IF EXISTS "companies"
  ADD COLUMN IF NOT EXISTS "hubspot_company_id" TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS "companies"
  ALTER COLUMN "hubspot_company_id" DROP DEFAULT;

CREATE INDEX IF NOT EXISTS ix_companies_hubspot_company_id ON "companies" ("hubspot_company_id");

-- @rollback
DROP INDEX IF EXISTS ix_companies_hubspot_company_id;

ALTER TABLE IF EXISTS "companies"
  DROP COLUMN IF EXISTS "hubspot_company_id";