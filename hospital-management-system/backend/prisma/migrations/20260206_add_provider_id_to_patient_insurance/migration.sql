-- Add providerId column to patient_insurances
ALTER TABLE "patient_insurances" ADD COLUMN "providerId" TEXT;

-- Create index on providerId
CREATE INDEX "patient_insurances_providerId_idx" ON "patient_insurances"("providerId");

-- Add foreign key constraint
ALTER TABLE "patient_insurances" ADD CONSTRAINT "patient_insurances_providerId_fkey" 
FOREIGN KEY ("providerId") REFERENCES "insurance_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unique constraint on provider name per hospital (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'insurance_providers_hospitalId_name_key'
  ) THEN
    ALTER TABLE "insurance_providers" ADD CONSTRAINT "insurance_providers_hospitalId_name_key" 
    UNIQUE ("hospitalId", "name");
  END IF;
END $$;

-- Add unique constraint for patient insurance duplicates
-- Using a partial unique index to handle NULL providerId
CREATE UNIQUE INDEX "patient_insurances_patientId_providerId_policyNumber_key" 
ON "patient_insurances"("patientId", "providerId", "policyNumber") 
WHERE "providerId" IS NOT NULL;

-- Migrate existing data: link providerName to providerId where matches exist
UPDATE "patient_insurances" pi
SET "providerId" = ip.id
FROM "insurance_providers" ip
WHERE pi."providerName" = ip.name
AND pi."providerId" IS NULL;
