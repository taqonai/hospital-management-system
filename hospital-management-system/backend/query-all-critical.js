const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function queryAllCriticalValues() {
  try {
    console.log('🔍 Querying ALL critical lab values (including acknowledged)...\n');

    const criticalTests = await prisma.labOrderTest.findMany({
      where: {
        isCritical: true,
      },
      include: {
        labOrder: {
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                mrn: true,
              },
            },
          },
        },
        labTest: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        performedAt: 'desc',
      },
      take: 10,
    });

    console.log(`Found ${criticalTests.length} critical value(s):\n`);

    if (criticalTests.length === 0) {
      console.log('❌ No critical values in database at all.\n');
      console.log('This means the values on the dashboard are either:');
      console.log('1. From a different hospital tenant');
      console.log('2. Cached/stale data');
      console.log('3. Need to be created by entering lab results\n');
      return;
    }

    criticalTests.forEach((test, idx) => {
      const patient = test.labOrder.patient;
      console.log(`${idx + 1}. ${patient.firstName} ${patient.lastName} (MRN: ${patient.mrn})`);
      console.log(`   Test: ${test.labTest?.name || 'Unknown'}`);
      console.log(`   Value: ${test.resultValue || test.result} ${test.unit || ''}`);
      console.log(`   Reference: ${test.normalRange || 'N/A'}`);
      console.log(`   Status: ${test.verifiedAt ? '✅ Acknowledged' : '⚠️  Pending'}`);
      console.log(`   Performed: ${test.performedAt ? new Date(test.performedAt).toLocaleString() : 'N/A'}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

queryAllCriticalValues();
