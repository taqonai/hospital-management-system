-- Phase 1: Technical Debt Fixes - Add audit fields to billing models
-- Migration: add_audit_fields_to_billing
-- NOTE: All IDs are TEXT type to match existing Prisma schema convention

-- ============================================================
-- 1. Add audit fields to Invoice
-- ============================================================
ALTER TABLE "invoices" 
  ADD COLUMN "createdBy" TEXT,
  ADD COLUMN "updatedBy" TEXT;

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
  ADD COLUMN "createdBy" TEXT;

-- For existing payments, copy receivedBy value as createdBy
UPDATE "payments" 
SET "createdBy" = "receivedBy";

-- Fallback for any NULLs
UPDATE "payments" 
SET "createdBy" = (
  SELECT id FROM "users" 
  WHERE role = 'HOSPITAL_ADMIN' 
  LIMIT 1
)
WHERE "createdBy" IS NULL;

-- Add partial unique index on referenceNumber (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_payment_reference_idx" 
  ON "payments" ("referenceNumber") 
  WHERE "referenceNumber" IS NOT NULL;

-- ============================================================
-- 3. Add audit fields and new fields to InsuranceClaim
-- ============================================================
ALTER TABLE "insurance_claims" 
  ADD COLUMN "insurancePayerId" TEXT,
  ADD COLUMN "denialReasonCode" TEXT,
  ADD COLUMN "appealNotes" TEXT,
  ADD COLUMN "appealDate" TIMESTAMP(3),
  ADD COLUMN "appealStatus" TEXT,
  ADD COLUMN "createdBy" TEXT,
  ADD COLUMN "updatedBy" TEXT,
  ADD COLUMN "submittedBy" TEXT,
  ADD COLUMN "processedBy" TEXT;

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
