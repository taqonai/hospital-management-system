import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding UAE Insurance Providers...');

  // Get the first hospital
  const hospital = await prisma.hospital.findFirst();
  
  if (!hospital) {
    throw new Error('No hospital found. Please run main seed first.');
  }

  console.log(`Using hospital: ${hospital.name} (${hospital.id})`);

  // UAE Insurance Providers (Master Data)
  const providersData = [
    {
      name: 'Daman - National Health Insurance Company',
      licenseNumber: 'DOH-INS-001',
      tpaName: 'Daman Health Services',
      contactPhone: '+971-2-4080800',
      email: 'info@damanhealth.ae',
      emirate: 'Abu Dhabi',
    },
    {
      name: 'Dubai Insurance Company',
      licenseNumber: 'DHA-INS-002',
      tpaName: 'NextCare',
      contactPhone: '+971-4-2944444',
      email: 'info@dxbinsurance.com',
      emirate: 'Dubai',
    },
    {
      name: 'Oman Insurance',
      licenseNumber: 'DHA-INS-003',
      tpaName: 'Sukoon (NAS)',
      contactPhone: '+971-4-3077800',
      email: 'info@omaninsurance.ae',
      emirate: 'Dubai',
    },
    {
      name: 'AXA Gulf',
      licenseNumber: 'DHA-INS-004',
      contactPhone: '+971-4-4499944',
      email: 'contact@axa-gulf.com',
      emirate: 'Dubai',
    },
    {
      name: 'Cigna',
      licenseNumber: 'DHA-INS-005',
      contactPhone: '+971-4-3644586',
      email: 'uaecontact@cigna.com',
      emirate: 'Dubai',
    },
    {
      name: 'MetLife',
      licenseNumber: 'DHA-INS-006',
      contactPhone: '+971-4-2941600',
      email: 'customer.service@metlife.ae',
      emirate: 'Dubai',
    },
    {
      name: 'Allianz',
      licenseNumber: 'DHA-INS-007',
      contactPhone: '+971-4-4072222',
      email: 'info@allianz.ae',
      emirate: 'Dubai',
    },
    {
      name: 'ADNIC - Abu Dhabi National Insurance',
      licenseNumber: 'DOH-INS-008',
      contactPhone: '+971-2-6444444',
      email: 'info@adnic.ae',
      emirate: 'Abu Dhabi',
    },
    {
      name: 'Sukoon (NAS)',
      licenseNumber: 'DHA-INS-009',
      tpaName: 'Next Generation Insurance',
      contactPhone: '+971-4-2222999',
      email: 'info@nas.ae',
      emirate: 'Dubai',
    },
    {
      name: 'Thiqa (Enhanced Plan by Daman)',
      licenseNumber: 'DOH-INS-010',
      tpaName: 'Daman Health Services',
      contactPhone: '+971-2-4080800',
      email: 'thiqa@damanhealth.ae',
      emirate: 'Abu Dhabi',
    },
    {
      name: 'SAICO - Saudi Arabian Insurance',
      licenseNumber: 'DHA-INS-011',
      contactPhone: '+971-4-3381234',
      email: 'info@saico.ae',
      emirate: 'Dubai',
    },
    {
      name: 'Orient Insurance',
      licenseNumber: 'DHA-INS-012',
      contactPhone: '+971-4-2955444',
      email: 'info@orientinsurance.ae',
      emirate: 'Dubai',
    },
    {
      name: 'National General Insurance',
      licenseNumber: 'DOH-INS-013',
      contactPhone: '+971-2-6260000',
      email: 'info@ngi.ae',
      emirate: 'Abu Dhabi',
    },
    {
      name: 'Mednet (Neuron)',
      licenseNumber: 'DHA-INS-014',
      tpaName: 'Neuron',
      contactPhone: '+971-4-4072222',
      email: 'info@neuronme.com',
      emirate: 'Dubai',
    },
    {
      name: 'NextCare',
      licenseNumber: 'DHA-INS-015',
      tpaName: 'NextCare',
      contactPhone: '+971-4-3635006',
      email: 'info@nextcare.com',
      emirate: 'Dubai',
    },
    {
      name: 'RSA Insurance',
      licenseNumber: 'DHA-INS-016',
      contactPhone: '+971-4-3322200',
      email: 'info@rsagroup.ae',
      emirate: 'Dubai',
    },
    {
      name: 'GIG Gulf - Gulf Insurance Group',
      licenseNumber: 'DHA-INS-017',
      contactPhone: '+971-4-5044444',
      email: 'info@giggulf.com',
      emirate: 'Dubai',
    },
    {
      name: 'Watania International',
      licenseNumber: 'DOH-INS-018',
      contactPhone: '+971-2-6336666',
      email: 'info@watania.ae',
      emirate: 'Abu Dhabi',
    },
    {
      name: 'Fidelity United',
      licenseNumber: 'DHA-INS-019',
      contactPhone: '+971-4-3183000',
      email: 'info@fidelityunited.ae',
      emirate: 'Dubai',
    },
    {
      name: 'Takaful Emarat',
      licenseNumber: 'DHA-INS-020',
      contactPhone: '+971-4-3969999',
      email: 'info@takafulemarat.ae',
      emirate: 'Dubai',
    },
  ];

  const createdProviders = [];
  for (const providerData of providersData) {
    const provider = await prisma.insuranceProvider.upsert({
      where: {
        hospitalId_licenseNumber: {
          hospitalId: hospital.id,
          licenseNumber: providerData.licenseNumber,
        },
      },
      update: {},
      create: {
        hospitalId: hospital.id,
        ...providerData,
        isActive: true,
      },
    });
    createdProviders.push(provider);
    console.log(`✓ Created/Updated provider: ${provider.name}`);
  }

  console.log(`\n✅ Seeded ${createdProviders.length} UAE insurance providers`);
}

main()
  .catch((e) => {
    console.error('Error seeding UAE insurance providers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
