const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeCritical() {
  try {
    console.log('🔍 Finding existing lab tests to mark as critical...\n');

    // Get Jane Smith's Thyroid test (already entered, but not flagged critical)
    const thyroidTest = await prisma.labOrderTest.findFirst({
      where: {
        labOrder: {
          patient: {
            firstName: 'Jane',
            lastName: 'Smith',
          },
        },
        labTest: {
          name: {
            contains: 'Thyroid',
          },
        },
      },
      include: {
        labOrder: {
          include: {
            patient: true,
          },
        },
        labTest: true,
      },
    });

    if (thyroidTest) {
      console.log(`Found: ${thyroidTest.labTest.name} for ${thyroidTest.labOrder.patient.firstName} ${thyroidTest.labOrder.patient.lastName}`);
      console.log(`Current value: ${thyroidTest.resultValue || thyroidTest.result} ${thyroidTest.unit}`);
      console.log(`Normal range: ${thyroidTest.normalRange}`);
      console.log(`Is Critical: ${thyroidTest.isCritical}\n`);

      // Update to mark as critical
      await prisma.labOrderTest.update({
        where: { id: thyroidTest.id },
        data: {
          isCritical: true,
          verifiedAt: null, // Make sure it shows as unacknowledged
          comments: 'CRITICAL HIGH - Hyperthyroidism suspected. Immediate endocrinology consult recommended.',
        },
      });

      console.log('✅ Marked as CRITICAL\n');
    }

    // Get John Doe's HbA1c and make it critically high
    const hba1cTest = await prisma.labOrderTest.findFirst({
      where: {
        labOrder: {
          patient: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        labTest: {
          name: {
            contains: 'HbA1c',
          },
        },
      },
      include: {
        labOrder: {
          include: {
            patient: true,
          },
        },
        labTest: true,
      },
    });

    if (hba1cTest) {
      console.log(`Found: ${hba1cTest.labTest.name} for ${hba1cTest.labOrder.patient.firstName} ${hba1cTest.labOrder.patient.lastName}`);
      console.log(`Current value: ${hba1cTest.resultValue || hba1cTest.result} ${hba1cTest.unit}`);
      console.log(`Current is critical: ${hba1cTest.isCritical}\n`);

      // Update to make it CRITICALLY HIGH (9.5% indicates severe uncontrolled diabetes)
      await prisma.labOrderTest.update({
        where: { id: hba1cTest.id },
        data: {
          resultValue: 9.5,
          result: '9.5',
          normalRange: '<5.7',
          isCritical: true,
          isAbnormal: true,
          verifiedAt: null,
          comments: 'CRITICAL HIGH - Severe uncontrolled diabetes. Immediate diabetes management required.',
        },
      });

      console.log('✅ Updated to 9.5% and marked as CRITICAL\n');
    }

    // Create one more critical low value - severe anemia
    const cbcTest = await prisma.labOrderTest.findFirst({
      where: {
        labTest: {
          category: 'Hematology',
        },
        result: { not: null },
      },
      include: {
        labOrder: {
          include: {
            patient: true,
          },
        },
        labTest: true,
      },
    });

    if (cbcTest) {
      console.log(`Found hematology test: ${cbcTest.labTest.name} for ${cbcTest.labOrder.patient.firstName} ${cbcTest.labOrder.patient.lastName}`);

      await prisma.labOrderTest.update({
        where: { id: cbcTest.id },
        data: {
          resultValue: 5.2,
          result: '5.2',
          unit: 'g/dL',
          normalRange: '12.0-16.0',
          isCritical: true,
          isAbnormal: true,
          verifiedAt: null,
          comments: 'CRITICAL LOW - Severe anemia. Blood transfusion may be required.',
        },
      });

      console.log('✅ Updated to 5.2 g/dL and marked as CRITICAL\n');
    }

    console.log('='.repeat(80));
    console.log('\n📊 SUMMARY: Created 3 critical lab values');
    console.log('\n🌐 Now login to https://spetaar.ai/laboratory as:');
    console.log('   Email: labtech@hospital.com');
    console.log('   Password: password123');
    console.log('\n✅ You should see "3 Critical Values Require Attention" banner');
    console.log('✅ Click "View All Critical Values" or go to Critical Values tab\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

makeCritical();
