/**
 * Update Test Insurance Data for Md Kamil
 * Sets networkTier, annualDeductible, and annualCopayMax
 */

import prisma from '../config/database';

async function updateTestInsurance() {
  try {
    console.log('[TEST DATA] Updating insurance for Md Kamil...');

    // Find Md Kamil by ID or name
    const patient = await prisma.patient.findFirst({
      where: {
        OR: [
          { id: '8d86603e-04ea-4c9e-a841-bfaf645ecfd4' },
          {
            AND: [
              { firstName: { contains: 'Kamil', mode: 'insensitive' } },
              { lastName: { contains: 'Md', mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: {
        insurances: { where: { isActive: true } },
      },
    });

    if (!patient) {
      console.error('[TEST DATA] Patient Md Kamil not found');
      return;
    }

    console.log(`[TEST DATA] Found patient: ${patient.firstName} ${patient.lastName} (ID: ${patient.id})`);

    // Update all active insurances
    for (const insurance of patient.insurances) {
      await prisma.patientInsurance.update({
        where: { id: insurance.id },
        data: {
          networkTier: 'IN_NETWORK',
          annualDeductible: 500,
          annualCopayMax: 1000,
        },
      });
      console.log(`[TEST DATA] Updated insurance: ${insurance.providerName} (ID: ${insurance.id})`);
      console.log('  - networkTier: IN_NETWORK');
      console.log('  - annualDeductible: 500');
      console.log('  - annualCopayMax: 1000');
    }

    // Ensure Daman payer has correct copayPercentage
    const hospital = await prisma.hospital.findFirst({
      where: { id: patient.hospitalId },
    });

    if (hospital) {
      const damanPayer = await prisma.insurancePayer.findFirst({
        where: {
          hospitalId: hospital.id,
          OR: [
            { name: { contains: 'Daman', mode: 'insensitive' } },
            { code: { contains: 'DAMAN', mode: 'insensitive' } },
          ],
        },
      });

      if (damanPayer) {
        // Check if there's an ICD-10 code for consultation
        const consultationICD = await prisma.iCD10Code.findFirst({
          where: {
            hospitalId: hospital.id,
            code: { startsWith: 'Z00' },
            isActive: true,
          },
        });

        if (consultationICD) {
          // Upsert payer rule
          const existingRule = await prisma.iCD10PayerRule.findFirst({
            where: {
              payerId: damanPayer.id,
              icd10CodeId: consultationICD.id,
            },
          });

          if (existingRule) {
            await prisma.iCD10PayerRule.update({
              where: { id: existingRule.id },
              data: {
                copayPercentage: 20, // Patient pays 20%
                isActive: true,
                isCovered: true,
              },
            });
            console.log('[TEST DATA] Updated Daman payer rule: copayPercentage = 20%');
          } else {
            await prisma.iCD10PayerRule.create({
              data: {
                payerId: damanPayer.id,
                icd10CodeId: consultationICD.id,
                copayPercentage: 20,
                isActive: true,
                isCovered: true,
              },
            });
            console.log('[TEST DATA] Created Daman payer rule: copayPercentage = 20%');
          }
        }
      }
    }

    console.log('[TEST DATA] ✅ Test insurance data updated successfully!');
  } catch (error) {
    console.error('[TEST DATA] Error updating insurance:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateTestInsurance();
