-- Phase 1: Technical Debt Fixes - Add audit fields to billing models
-- Migration: add_audit_fields_to_billing
-- NOTE: All column names use camelCase to match existing Prisma convention

-- ============================================================
-- 1. Add audit fields to Invoice
-- ============================================================
ALTER TABLE "invoices" 
  ADD COLUMN "createdBy" UUID,
  ADD COLUMN "updatedBy" UUID;

-- Backfill existing invoices with hospital admin user
UPDATE "invoices" 
SET "createdBy" = (
  SELECT id FROM "users" 
  WHERE role = 'HOSPITAL_ADMIN' 
  AND "hospitalId" = "invoices"."hospitalId" 
  LIMIT 1
);

-- Fallback: if any invoices still have NULL createdBy, use any admin
UPDATE "invoices" 
SET "createdBy" = (
  SELECT id FROM "users" 
  WHERE role = 'HOSPITAL_ADMIN' 
  LIMIT 1
)
WHERE "createdBy" IS NULL;

-- ============================================================
-- 2. Update Payment table - add createdBy
-- ============================================================
ALTER TABLE "payments" 
  ADD COLUMN "createdBy" UUID;

-- For existing payments, try to map receivedBy string to User.id
-- If receivedBy is a valid UUID, use it; otherwise use first admin
UPDATE "payments" 
SET "createdBy" = 
  CASE 
    WHEN "receivedBy" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
      THEN "receivedBy"::UUID
    ELSE (
      SELECT id FROM "users" 
      WHERE role = 'HOSPITAL_ADMIN' 
      LIMIT 1
    )
  END;

-- Add partial unique index on referenceNumber (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_payment_reference_idx" 
  ON "payments" ("referenceNumber") 
  WHERE "referenceNumber" IS NOT NULL;

-- ============================================================
-- 3. Add audit fields and new fields to InsuranceClaim
-- ============================================================
ALTER TABLE "insurance_claims" 
  ADD COLUMN "insurancePayerId" UUID,
  ADD COLUMN "denialReasonCode" TEXT,
  ADD COLUMN "appealNotes" TEXT,
  ADD COLUMN "appealDate" TIMESTAMP(3),
  ADD COLUMN "appealStatus" TEXT,
  ADD COLUMN "createdBy" UUID,
  ADD COLUMN "updatedBy" UUID,
  ADD COLUMN "submittedBy" UUID,
  ADD COLUMN "processedBy" UUID;

-- Backfill createdBy for existing claims
UPDATE "insurance_claims" 
SET "createdBy" = (
  SELECT id FROM "users" 
  WHERE role = 'HOSPITAL_ADMIN' 
  LIMIT 1
);

-- Add foreign key for insurancePayerId
ALTER TABLE "insurance_claims" 
  ADD CONSTRAINT "insurance_claims_insurancePayerId_fkey" 
  FOREIGN KEY ("insurancePayerId") 
  REFERENCES "insurance_payers"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Add index for FK
CREATE INDEX "insurance_claims_insurancePayerId_idx" 
  ON "insurance_claims"("insurancePayerId");
