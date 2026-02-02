import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding UAE Insurance Payers...');

  // Get the first hospital
  const hospital = await prisma.hospital.findFirst();
  
  if (!hospital) {
    throw new Error('No hospital found. Please run main seed first.');
  }

  console.log(`Using hospital: ${hospital.name} (${hospital.id})`);

  // UAE Insurance Payers
  const payersData = [
    {
      name: 'Daman (National Health Insurance Company)',
      code: 'DAMAN',
      regulator: 'DOH',
      claimPlatform: 'eClaimLink',
      claimSubmissionDeadline: 90,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-2-4080800',
      preAuthEmail: 'preauth@damanhealth.ae',
      preAuthPortal: 'https://provider.damanhealth.ae',
      contactPhone: '+971-2-4080800',
      contactEmail: 'info@damanhealth.ae',
      paymentTerms: 30,
      isActive: true,
      notes: 'Basic plan with standard coverage',
    },
    {
      name: 'Thiqa (Enhanced Plan by Daman)',
      code: 'THIQA',
      regulator: 'DOH',
      claimPlatform: 'eClaimLink',
      claimSubmissionDeadline: 90,
      appealDeadline: 30,
      preAuthRequired: false,
      preAuthPhone: '+971-2-4080800',
      preAuthEmail: 'thiqa@damanhealth.ae',
      preAuthPortal: 'https://provider.damanhealth.ae',
      contactPhone: '+971-2-4080800',
      contactEmail: 'thiqa@damanhealth.ae',
      paymentTerms: 30,
      isActive: true,
      notes: 'Enhanced plan with no copay for most services',
    },
    {
      name: 'NAS (Next Generation Insurance)',
      code: 'NAS',
      regulator: 'DHA',
      claimPlatform: 'SHIFA',
      claimSubmissionDeadline: 60,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-4-2222999',
      preAuthEmail: 'preauth@nas.ae',
      contactPhone: '+971-4-2222999',
      contactEmail: 'info@nas.ae',
      paymentTerms: 45,
      isActive: true,
    },
    {
      name: 'AXA Gulf',
      code: 'AXA',
      regulator: 'DHA',
      claimPlatform: 'eClaimLink',
      claimSubmissionDeadline: 90,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-4-4499944',
      preAuthEmail: 'medicalservices.uae@axa-gulf.com',
      contactPhone: '+971-4-4499944',
      contactEmail: 'contact@axa-gulf.com',
      paymentTerms: 30,
      isActive: true,
    },
    {
      name: 'Oman Insurance (Sukoon)',
      code: 'SUKOON',
      regulator: 'DHA',
      claimPlatform: 'SHIFA',
      claimSubmissionDeadline: 60,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-4-3077800',
      preAuthEmail: 'claims@omaninsurance.ae',
      contactPhone: '+971-4-3077800',
      contactEmail: 'info@omaninsurance.ae',
      paymentTerms: 45,
      isActive: true,
    },
    {
      name: 'ADNIC (Abu Dhabi National Insurance)',
      code: 'ADNIC',
      regulator: 'DOH',
      claimPlatform: 'eClaimLink',
      claimSubmissionDeadline: 90,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-2-6444444',
      preAuthEmail: 'health@adnic.ae',
      contactPhone: '+971-2-6444444',
      contactEmail: 'info@adnic.ae',
      paymentTerms: 30,
      isActive: true,
    },
    {
      name: 'Orient Insurance',
      code: 'ORIENT',
      regulator: 'DHA',
      claimPlatform: 'eClaimLink',
      claimSubmissionDeadline: 90,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-4-2955444',
      preAuthEmail: 'healthclaims@orientinsurance.ae',
      contactPhone: '+971-4-2955444',
      contactEmail: 'info@orientinsurance.ae',
      paymentTerms: 45,
      isActive: true,
    },
    {
      name: 'MetLife',
      code: 'METLIFE',
      regulator: 'DHA',
      claimPlatform: 'eClaimLink',
      claimSubmissionDeadline: 90,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-4-2941600',
      preAuthEmail: 'medicalservices@metlife.ae',
      contactPhone: '+971-4-2941600',
      contactEmail: 'customer.service@metlife.ae',
      paymentTerms: 30,
      isActive: true,
    },
    {
      name: 'Cigna',
      code: 'CIGNA',
      regulator: 'DHA',
      claimPlatform: 'eClaimLink',
      claimSubmissionDeadline: 90,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-4-3644586',
      preAuthEmail: 'priorauth.uae@cigna.com',
      contactPhone: '+971-4-3644586',
      contactEmail: 'uaecontact@cigna.com',
      paymentTerms: 30,
      isActive: true,
    },
    {
      name: 'Neuron (MedNet)',
      code: 'MEDNET',
      regulator: 'DHA',
      claimPlatform: 'SHIFA',
      claimSubmissionDeadline: 60,
      appealDeadline: 30,
      preAuthRequired: true,
      preAuthPhone: '+971-4-4072222',
      preAuthEmail: 'preauth@neuronme.com',
      contactPhone: '+971-4-4072222',
      contactEmail: 'info@neuronme.com',
      paymentTerms: 45,
      isActive: true,
    },
  ];

  const createdPayers = [];
  for (const payerData of payersData) {
    const payer = await prisma.insurancePayer.upsert({
      where: {
        hospitalId_code: {
          hospitalId: hospital.id,
          code: payerData.code,
        },
      },
      update: {},
      create: {
        hospitalId: hospital.id,
        ...payerData,
      },
    });
    createdPayers.push(payer);
    console.log(`✓ Created/Updated payer: ${payer.name} (${payer.code})`);
  }

  // Get common consultation ICD-10 codes for seeding copay rules
  const consultationICD = await prisma.iCD10Code.findFirst({
    where: {
      hospitalId: hospital.id,
      code: { startsWith: 'Z00' }, // General medical examination
      isActive: true,
    },
  });

  if (consultationICD) {
    console.log('\nSeeding ICD-10 Payer Rules for consultation copays...');

    // Daman - Basic plan: 20 AED copay, 20% copay percentage
    const damanPayer = createdPayers.find(p => p.code === 'DAMAN');
    if (damanPayer) {
      await prisma.iCD10PayerRule.upsert({
        where: {
          payerId_icd10CodeId: {
            payerId: damanPayer.id,
            icd10CodeId: consultationICD.id,
          },
        },
        update: {},
        create: {
          payerId: damanPayer.id,
          icd10CodeId: consultationICD.id,
          isCovered: true,
          requiresPreAuth: false,
          copayAmount: 20,
          copayPercentage: 20,
          deductibleApplies: true,
          isActive: true,
        },
      });
      console.log('✓ Daman: AED 20 copay + 20% for consultations');
    }

    // Thiqa - Enhanced plan: No copay
    const thiqaPayer = createdPayers.find(p => p.code === 'THIQA');
    if (thiqaPayer) {
      await prisma.iCD10PayerRule.upsert({
        where: {
          payerId_icd10CodeId: {
            payerId: thiqaPayer.id,
            icd10CodeId: consultationICD.id,
          },
        },
        update: {},
        create: {
          payerId: thiqaPayer.id,
          icd10CodeId: consultationICD.id,
          isCovered: true,
          requiresPreAuth: false,
          copayAmount: 0,
          copayPercentage: 0,
          deductibleApplies: false,
          isActive: true,
        },
      });
      console.log('✓ Thiqa: No copay for consultations');
    }
  }

  console.log(`\n✅ Seeded ${createdPayers.length} UAE insurance payers`);
}

main()
  .catch((e) => {
    console.error('Error seeding UAE insurance payers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
