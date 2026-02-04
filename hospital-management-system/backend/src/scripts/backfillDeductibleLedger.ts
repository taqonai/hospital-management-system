/**
 * GAP 4: Backfill DeductibleLedger from existing CopayPayment records.
 *
 * This script aggregates all CopayPayment records by patient+year and creates/updates
 * DeductibleLedger entries so the ledger matches the actual payment history.
 *
 * Usage: npx ts-node src/scripts/backfillDeductibleLedger.ts
 *
 * Safe to run multiple times (idempotent — uses upsert).
 */
import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

async function backfillDeductibleLedger() {
  console.log('[BACKFILL] Starting DeductibleLedger backfill from CopayPayment records...');

  // Get all copay payments grouped by patient + year
  const payments = await prisma.copayPayment.findMany({
    select: {
      patientId: true,
      amount: true,
      paymentDate: true,
    },
    orderBy: { paymentDate: 'asc' },
  });

  if (payments.length === 0) {
    console.log('[BACKFILL] No CopayPayment records found. Nothing to backfill.');
    return;
  }

  console.log(`[BACKFILL] Found ${payments.length} CopayPayment records.`);

  // Aggregate by patientId + year
  const aggregated: Record<string, { total: number; patientId: string; year: number }> = {};

  for (const payment of payments) {
    const year = new Date(payment.paymentDate).getFullYear();
    const key = `${payment.patientId}_${year}`;
    if (!aggregated[key]) {
      aggregated[key] = { total: 0, patientId: payment.patientId, year };
    }
    aggregated[key].total += Number(payment.amount);
  }

  const entries = Object.values(aggregated);
  console.log(`[BACKFILL] Aggregated into ${entries.length} patient-year combinations.`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      // Look up patient's hospital and insurance
      const patient = await prisma.patient.findUnique({
        where: { id: entry.patientId },
        select: { hospitalId: true },
      });

      if (!patient) {
        console.warn(`[BACKFILL] Patient ${entry.patientId} not found, skipping.`);
        errors++;
        continue;
      }

      const insurance = await prisma.patientInsurance.findFirst({
        where: { patientId: entry.patientId, isActive: true, isPrimary: true },
        select: { id: true, annualDeductible: true, annualCopayMax: true },
      });

      const maxDeductible = Number(insurance?.annualDeductible || 500);
      const maxCopay = Number(insurance?.annualCopayMax || 0);

      // Upsert the ledger entry
      const existing = await prisma.deductibleLedger.findUnique({
        where: {
          hospitalId_patientId_fiscalYear: {
            hospitalId: patient.hospitalId,
            patientId: entry.patientId,
            fiscalYear: entry.year,
          },
        },
      });

      if (existing) {
        await prisma.deductibleLedger.update({
          where: { id: existing.id },
          data: {
            accumulatedAmount: new Decimal(entry.total),
            copayAccumulated: new Decimal(entry.total),
            maxDeductible: new Decimal(maxDeductible),
            maxCopay: maxCopay > 0 ? new Decimal(maxCopay) : null,
            lastUpdated: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.deductibleLedger.create({
          data: {
            hospitalId: patient.hospitalId,
            patientId: entry.patientId,
            insurancePolicyId: insurance?.id,
            fiscalYear: entry.year,
            accumulatedAmount: new Decimal(entry.total),
            copayAccumulated: new Decimal(entry.total),
            maxDeductible: new Decimal(maxDeductible),
            maxCopay: maxCopay > 0 ? new Decimal(maxCopay) : null,
          },
        });
        created++;
      }
    } catch (err) {
      console.error(`[BACKFILL] Error processing patient ${entry.patientId} year ${entry.year}:`, err);
      errors++;
    }
  }

  console.log(`[BACKFILL] Complete. Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
}

backfillDeductibleLedger()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[BACKFILL] Fatal error:', err);
    process.exit(1);
  });
