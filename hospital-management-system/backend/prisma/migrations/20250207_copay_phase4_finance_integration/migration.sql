-- Phase 4: Copay Finance Integration Migration
-- Add new fields to copay_payments table for partial payments and finance sync

-- Create the CopayPaymentStatus enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "CopayPaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED', 'WAIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to copay_payments table
ALTER TABLE "copay_payments" 
ADD COLUMN IF NOT EXISTS "expectedAmount" DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remainingBalance" DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "status" "CopayPaymentStatus" DEFAULT 'PAID',
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "syncedToFinance" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "financeSyncDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "financeRecordId" TEXT,
ADD COLUMN IF NOT EXISTS "glAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "revenueCategory" TEXT DEFAULT 'COPAY';

-- Update existing records to have expectedAmount equal to amount (they were fully paid)
UPDATE "copay_payments" 
SET "expectedAmount" = "amount",
    "remainingBalance" = 0,
    "status" = 'PAID',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "expectedAmount" = 0 OR "expectedAmount" IS NULL;

-- Make expectedAmount required (NOT NULL) after backfilling
ALTER TABLE "copay_payments" ALTER COLUMN "expectedAmount" SET NOT NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "copay_payments_patientId_idx" ON "copay_payments"("patientId");
CREATE INDEX IF NOT EXISTS "copay_payments_appointmentId_idx" ON "copay_payments"("appointmentId");
CREATE INDEX IF NOT EXISTS "copay_payments_syncedToFinance_idx" ON "copay_payments"("syncedToFinance");
CREATE INDEX IF NOT EXISTS "copay_payments_paymentDate_idx" ON "copay_payments"("paymentDate");
