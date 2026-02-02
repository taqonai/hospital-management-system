import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding test insurance for patient Md Kamil...');

  const patientId = '8d86603e-04ea-4c9e-a841-bfaf645ecfd4';

  // Check if patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });

  if (!patient) {
    console.error('Patient Md Kamil not found with id:', patientId);
    process.exit(1);
  }

  console.log(`Found patient: ${patient.firstName} ${patient.lastName} (${patient.mrn})`);

  // Find Daman payer
  const damanPayer = await prisma.insurancePayer.findFirst({
    where: {
      code: 'DAMAN',
      hospitalId: patient.hospitalId,
    },
  });

  if (!damanPayer) {
    console.error('Daman payer not found. Please run seed-uae-insurance first.');
    process.exit(1);
  }

  console.log(`Found Daman payer: ${damanPayer.name}`);

  // Check if insurance already exists
  const existingInsurance = await prisma.patientInsurance.findFirst({
    where: {
      patientId,
      policyNumber: 'TEST-POL-001',
    },
  });

  if (existingInsurance) {
    console.log('Test insurance already exists. Updating...');
    await prisma.patientInsurance.update({
      where: { id: existingInsurance.id },
      data: {
        providerName: damanPayer.name,
        coverageType: 'Enhanced',
        copay: 20,
        effectiveDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-31'),
        isPrimary: true,
        isActive: true,
      },
    });
    console.log('✓ Updated existing test insurance');
  } else {
    // Create new test insurance
    const insurance = await prisma.patientInsurance.create({
      data: {
        patientId,
        providerName: damanPayer.name,
        policyNumber: 'TEST-POL-001',
        groupNumber: 'GRP-TEST-001',
        subscriberName: 'Md Kamil',
        subscriberId: 'SUB-KAMIL-001',
        relationship: 'Self',
        effectiveDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-31'),
        coverageType: 'Enhanced',
        copay: 20,
        deductible: 500,
        isPrimary: true,
        isActive: true,
      },
    });

    console.log('✓ Created test insurance:');
    console.log(`  Provider: ${insurance.providerName}`);
    console.log(`  Policy: ${insurance.policyNumber}`);
    console.log(`  Coverage: ${insurance.coverageType}`);
    console.log(`  Copay: AED ${insurance.copay}`);
  }

  console.log('\n✅ Test insurance data added successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding test insurance:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
