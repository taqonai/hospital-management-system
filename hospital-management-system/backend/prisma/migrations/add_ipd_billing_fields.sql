-- Phase 2: IPD Billing + Discharge Flow
-- Migration: add_ipd_billing_fields
-- Date: 2025-01-20

-- Add admissionId to invoices table (FK to admissions)
ALTER TABLE "invoices" 
  ADD COLUMN "admissionId" TEXT,
  ADD COLUMN "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "lastBedChargeDate" TIMESTAMP(3);

-- Add foreign key constraint
ALTER TABLE "invoices" 
  ADD CONSTRAINT "invoices_admissionId_fkey" 
  FOREIGN KEY ("admissionId") 
  REFERENCES "admissions"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Add index for faster admission invoice lookups
CREATE INDEX "invoices_admissionId_idx" ON "invoices"("admissionId");

-- Update existing invoices to set depositAmount to 0 (already default)
-- No action needed due to DEFAULT value

-- Note: The reverse relation (invoices on Admission model) is handled by Prisma automatically
