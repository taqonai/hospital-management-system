/**
 * Seed ChargeMaster with hardcoded charges for all hospitals
 * 
 * Usage: npx tsx src/scripts/seedCharges.ts
 *    or: npx ts-node src/scripts/seedCharges.ts
 */

import prisma from '../config/database';
import { chargeManagementService } from '../services/chargeManagementService';

async function main() {
  console.log('🏥 Seeding ChargeMaster charges for all hospitals...\n');

  const hospitals = await prisma.hospital.findMany({
    select: { id: true, name: true },
  });

  if (hospitals.length === 0) {
    console.warn('⚠️  No hospitals found in database. Nothing to seed.');
    return;
  }

  for (const hospital of hospitals) {
    console.log(`📋 Processing: ${hospital.name} (${hospital.id})`);
    try {
      const result = await chargeManagementService.seedHardcodedCharges(hospital.id, 'system');
      console.log(`   ✅ Created: ${result.created}, Skipped (existing): ${result.skipped}`);
    } catch (error) {
      console.error(`   ❌ Failed for ${hospital.name}:`, error);
    }
  }

  console.log('\n✅ ChargeMaster seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding charges:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
