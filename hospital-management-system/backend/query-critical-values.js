const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function queryCriticalValues() {
  try {
    console.log('🔍 Querying critical lab values...\n');

    const criticalTests = await prisma.labOrderTest.findMany({
      where: {
        isCritical: true,
        verifiedAt: null, // Only unacknowledged
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
                phone: true,
                dateOfBirth: true,
              },
            },
          },
        },
        labTest: {
          select: {
            name: true,
            code: true,
            category: true,
          },
        },
      },
      orderBy: {
        performedAt: 'desc',
      },
    });

    if (criticalTests.length === 0) {
      console.log('✅ No critical values found (all acknowledged or none exist)\n');
      return;
    }

    console.log(`🚨 Found ${criticalTests.length} CRITICAL VALUE(S):\n`);
    console.log('='.repeat(80));

    criticalTests.forEach((test, index) => {
      const patient = test.labOrder.patient;
      const testInfo = test.labTest;

      console.log(`\n${index + 1}. CRITICAL VALUE`);
      console.log('-'.repeat(80));
      console.log(`Patient: ${patient.firstName} ${patient.lastName}`);
      console.log(`MRN: ${patient.mrn}`);
      console.log(`DOB: ${patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}`);
      console.log(`Phone: ${patient.phone || 'N/A'}`);
      console.log('');
      console.log(`Test: ${testInfo?.name || 'Unknown'} (${testInfo?.code || 'N/A'})`);
      console.log(`Category: ${testInfo?.category || 'N/A'}`);
      console.log(`Result: ${test.resultValue || test.result} ${test.unit || ''}`);
      console.log(`Reference Range: ${test.normalRange || 'Not specified'}`);
      console.log(`Status: ${test.status}`);
      console.log(`Comments: ${test.comments || 'None'}`);
      console.log(`Performed: ${test.performedAt ? new Date(test.performedAt).toLocaleString() : 'N/A'}`);
      console.log(`Order Number: ${test.labOrder.orderNumber}`);
      console.log('');

      // Calculate why it's critical
      if (test.normalRange && test.resultValue) {
        const match = test.normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
        if (match) {
          const min = parseFloat(match[1]);
          const max = parseFloat(match[2]);
          const value = parseFloat(test.resultValue.toString());
          const range = max - min;
          const criticalLow = min - range * 0.5;
          const criticalHigh = max + range * 0.5;

          console.log(`📊 Analysis:`);
          console.log(`   Normal Range: ${min} - ${max}`);
          console.log(`   Critical Thresholds: < ${criticalLow.toFixed(2)} or > ${criticalHigh.toFixed(2)}`);
          console.log(`   Actual Value: ${value}`);

          if (value < criticalLow) {
            console.log(`   ⚠️  CRITICALLY LOW (${(((min - value) / range) * 100).toFixed(1)}% below minimum)`);
          } else if (value > criticalHigh) {
            console.log(`   ⚠️  CRITICALLY HIGH (${(((value - max) / range) * 100).toFixed(1)}% above maximum)`);
          }
        }
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\nTotal: ${criticalTests.length} critical value(s) requiring attention`);

    // Group by patient
    const byPatient = criticalTests.reduce((acc, test) => {
      const patientId = test.labOrder.patient.id;
      if (!acc[patientId]) {
        acc[patientId] = {
          patient: test.labOrder.patient,
          tests: [],
        };
      }
      acc[patientId].tests.push(test);
      return acc;
    }, {});

    console.log(`\n📋 Summary by Patient:`);
    Object.values(byPatient).forEach((entry) => {
      console.log(`   - ${entry.patient.firstName} ${entry.patient.lastName} (MRN: ${entry.patient.mrn}): ${entry.tests.length} critical value(s)`);
    });

  } catch (error) {
    console.error('❌ Error querying database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

queryCriticalValues();
