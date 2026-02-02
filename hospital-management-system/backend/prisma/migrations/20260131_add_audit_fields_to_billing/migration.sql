-- Phase 1: Technical Debt Fixes - Add audit fields to billing models
-- Migration: add_audit_fields_to_billing

-- ============================================================
-- 1. Add audit fields to Invoice
-- ============================================================
ALTER TABLE "invoices" 
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "updated_by" UUID;

-- Backfill existing invoices with a system user (hospital admin)
-- Note: This will be updated after migration runs
UPDATE "invoices" 
SET "created_by" = (
  SELECT id FROM "users" 
  WHERE role = 'HOSPITAL_ADMIN' 
  AND "hospital_id" = "invoices"."hospital_id" 
  LIMIT 1
);

-- Make created_by NOT NULL after backfill
ALTER TABLE "invoices" 
  ALTER COLUMN "created_by" SET NOT NULL;

-- ============================================================
-- 2. Update Payment table - rename receivedBy, add createdBy
-- ============================================================

-- Add new createdBy column
ALTER TABLE "payments" 
  ADD COLUMN "created_by" UUID;

-- For existing payments, try to map receivedBy string to User.id
-- If receivedBy is a UUID, use it; otherwise use first admin
UPDATE "payments" 
SET "created_by" = 
  CASE 
    WHEN "received_by" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
      THEN "received_by"::UUID
    ELSE (
      SELECT id FROM "users" 
      WHERE role = 'HOSPITAL_ADMIN' 
      LIMIT 1
    )
  END;

-- Drop old receivedBy column
ALTER TABLE "payments" 
  DROP COLUMN "received_by";

-- Make created_by NOT NULL
ALTER TABLE "payments" 
  ALTER COLUMN "created_by" SET NOT NULL;

-- Add partial unique index on referenceNumber (when not null)
CREATE UNIQUE INDEX "unique_payment_reference_idx" 
  ON "payments" ("reference_number") 
  WHERE "reference_number" IS NOT NULL;

-- Add regular index for queries
CREATE INDEX "payments_reference_number_idx" 
  ON "payments" ("reference_number");

-- ============================================================
-- 3. Add audit fields and new fields to InsuranceClaim
-- ============================================================
ALTER TABLE "insurance_claims" 
  ADD COLUMN "insurance_payer_id" UUID,
  ADD COLUMN "denial_reason_code" TEXT,
  ADD COLUMN "appeal_notes" TEXT,
  ADD COLUMN "appeal_date" TIMESTAMP(3),
  ADD COLUMN "appeal_status" TEXT,
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "submitted_by" UUID,
  ADD COLUMN "processed_by" UUID;

-- Backfill created_by for existing claims
UPDATE "insurance_claims" 
SET "created_by" = (
  SELECT id FROM "users" 
  WHERE role = 'HOSPITAL_ADMIN' 
  LIMIT 1
);

-- Make created_by NOT NULL
ALTER TABLE "insurance_claims" 
  ALTER COLUMN "created_by" SET NOT NULL;

-- Add foreign key for insurancePayerId
ALTER TABLE "insurance_claims" 
  ADD CONSTRAINT "insurance_claims_insurance_payer_id_fkey" 
  FOREIGN KEY ("insurance_payer_id") 
  REFERENCES "insurance_payers"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Add index for FK
CREATE INDEX "insurance_claims_insurance_payer_id_idx" 
  ON "insurance_claims"("insurance_payer_id");
