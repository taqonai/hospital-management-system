const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  try {
    console.log('🔬 LABORATORY CRITICAL VALUES DIAGNOSTIC\n');
    console.log('='.repeat(80) + '\n');

    // 1. Count all hospitals
    const hospitals = await prisma.hospital.findMany({
      select: { id: true, name: true },
    });
    console.log(`1️⃣  Found ${hospitals.length} hospital(s):`);
    hospitals.forEach(h => console.log(`   - ${h.name} (ID: ${h.id})`));
    console.log('');

    // 2. Count all lab orders
    const totalOrders = await prisma.labOrder.count();
    console.log(`2️⃣  Total Lab Orders: ${totalOrders}`);

    // 3. Count all lab order tests
    const totalTests = await prisma.labOrderTest.count();
    console.log(`3️⃣  Total Lab Tests: ${totalTests}`);

    // 4. Count tests by status
    const testsByStatus = await prisma.labOrderTest.groupBy({
      by: ['isCritical', 'isAbnormal'],
      _count: true,
    });
    console.log(`\n4️⃣  Tests by Status:`);
    testsByStatus.forEach(group => {
      const label = group.isCritical ? 'Critical' : group.isAbnormal ? 'Abnormal' : 'Normal';
      console.log(`   - ${label}: ${group._count} tests`);
    });

    // 5. Find ANY test with results
    const testsWithResults = await prisma.labOrderTest.findMany({
      where: {
        OR: [
          { result: { not: null } },
          { resultValue: { not: null } },
        ],
      },
      include: {
        labOrder: {
          include: {
            patient: {
              select: { firstName: true, lastName: true, mrn: true },
            },
          },
        },
        labTest: {
          select: { name: true },
        },
      },
      take: 5,
      orderBy: {
        performedAt: 'desc',
      },
    });

    console.log(`\n5️⃣  Tests with Results: ${testsWithResults.length}`);
    if (testsWithResults.length > 0) {
      console.log('   Recent tests:');
      testsWithResults.forEach(test => {
        const patient = test.labOrder.patient;
        console.log(`   - ${patient.firstName} ${patient.lastName}: ${test.labTest?.name}`);
        console.log(`     Result: ${test.resultValue || test.result} ${test.unit || ''}`);
        console.log(`     Normal Range: ${test.normalRange || 'N/A'}`);
        console.log(`     Critical: ${test.isCritical ? '⚠️  YES' : 'No'}`);
        console.log('');
      });
    }

    // 6. Check lab technician's hospital
    const labTech = await prisma.user.findFirst({
      where: {
        email: 'labtech@hospital.com',
      },
      select: {
        id: true,
        email: true,
        hospitalId: true,
        hospital: {
          select: { name: true },
        },
      },
    });

    if (labTech) {
      console.log(`6️⃣  Lab Technician Account:`);
      console.log(`   Email: ${labTech.email}`);
      console.log(`   Hospital: ${labTech.hospital?.name} (ID: ${labTech.hospitalId})`);
      console.log('');

      // 7. Count orders for this hospital
      const hospitalOrders = await prisma.labOrder.count({
        where: { hospitalId: labTech.hospitalId },
      });
      console.log(`7️⃣  Lab Orders for this hospital: ${hospitalOrders}`);

      // 8. Critical values for this hospital
      const hospitalCritical = await prisma.labOrderTest.count({
        where: {
          isCritical: true,
          labOrder: { hospitalId: labTech.hospitalId },
        },
      });
      console.log(`8️⃣  Critical values for this hospital: ${hospitalCritical}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 CONCLUSION:');

    if (totalTests === 0) {
      console.log('❌ No lab tests exist in the database at all.');
      console.log('   The dashboard is showing mock/cached data.');
    } else if (testsWithResults.length === 0) {
      console.log('⚠️  Lab orders exist but no results have been entered yet.');
      console.log('   The dashboard may be showing placeholder data.');
    } else {
      console.log('✅ Lab data exists but no critical values have been flagged.');
      console.log('   To see critical values on the dashboard:');
      console.log('   1. Enter a lab result that is 50% outside the reference range');
      console.log('   2. Example: For range 12-16, enter < 10 or > 18');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
