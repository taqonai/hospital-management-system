const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createCriticalTestCase() {
  try {
    console.log('🏥 Creating realistic critical lab value test case...\n');

    // Get the hospital
    const hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      console.error('❌ No hospital found');
      return;
    }

    // Get or create a test patient
    let patient = await prisma.patient.findFirst({
      where: {
        hospitalId: hospital.id,
        mrn: 'CRIT-TEST-001',
      },
    });

    if (!patient) {
      console.log('Creating test patient...');
      patient = await prisma.patient.create({
        data: {
          hospitalId: hospital.id,
          mrn: 'CRIT-TEST-001',
          firstName: 'Sarah',
          lastName: 'Johnson',
          dateOfBirth: new Date('1985-06-15'),
          gender: 'FEMALE',
          phone: '555-0123',
          email: 'sarah.test@example.com',
          address: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          bloodGroup: 'A_POSITIVE',
          nationality: 'Test Country',
        },
      });
      console.log(`✅ Created patient: ${patient.firstName} ${patient.lastName} (MRN: ${patient.mrn})\n`);
    } else {
      console.log(`✅ Using existing patient: ${patient.firstName} ${patient.lastName} (MRN: ${patient.mrn})\n`);
    }

    // Get a doctor to order the tests
    const doctor = await prisma.user.findFirst({
      where: {
        hospitalId: hospital.id,
        role: 'DOCTOR',
      },
    });

    if (!doctor) {
      console.error('❌ No doctor found');
      return;
    }

    // Find critical tests (or create them)
    let potassiumTest = await prisma.labTest.findFirst({
      where: { code: 'K' },
    });

    let hemoglobinTest = await prisma.labTest.findFirst({
      where: { code: 'HGB' },
    });

    if (!potassiumTest) {
      console.log('Creating Potassium test...');
      potassiumTest = await prisma.labTest.create({
        data: {
          name: 'Serum Potassium',
          code: 'K',
          category: 'Chemistry',
          sampleType: 'Blood',
          unit: 'mEq/L',
          normalRange: '3.5-5.0',
          price: 25.00,
          turnaroundTime: 60,
        },
      });
    }

    if (!hemoglobinTest) {
      console.log('Creating Hemoglobin test...');
      hemoglobinTest = await prisma.labTest.create({
        data: {
          name: 'Hemoglobin',
          code: 'HGB',
          category: 'Hematology',
          sampleType: 'Blood',
          unit: 'g/dL',
          normalRange: '12.0-16.0',
          price: 20.00,
          turnaroundTime: 60,
        },
      });
    }

    // Create lab order
    console.log('Creating lab order...');
    const orderNumber = `LAB-CRIT-${Date.now().toString().slice(-6)}`;
    const labOrder = await prisma.labOrder.create({
      data: {
        hospitalId: hospital.id,
        orderNumber,
        patientId: patient.id,
        orderedById: doctor.id,
        status: 'PROCESSING',
        priority: 'STAT',
        clinicalNotes: 'Patient presenting with severe weakness and cardiac arrhythmia. STAT labs ordered.',
        tests: {
          create: [
            {
              labTestId: potassiumTest.id,
              status: 'IN_PROGRESS',
            },
            {
              labTestId: hemoglobinTest.id,
              status: 'IN_PROGRESS',
            },
          ],
        },
      },
      include: {
        tests: true,
      },
    });

    console.log(`✅ Created order: ${orderNumber}\n`);

    // Now enter CRITICAL results
    console.log('📊 Entering CRITICAL lab results...\n');

    // CRITICAL LOW Potassium (normal: 3.5-5.0, entering 2.1)
    const potassiumTestRecord = labOrder.tests.find(t => t.labTestId === potassiumTest.id);
    if (potassiumTestRecord) {
      // Calculate critical threshold:
      // Range = 5.0 - 3.5 = 1.5
      // Critical Low = 3.5 - (1.5 * 0.5) = 2.75
      // Our value: 2.1 (CRITICAL!)

      await prisma.labOrderTest.update({
        where: { id: potassiumTestRecord.id },
        data: {
          result: '2.1',
          resultValue: 2.1,
          unit: 'mEq/L',
          normalRange: '3.5-5.0',
          isCritical: true,
          isAbnormal: true,
          status: 'COMPLETED',
          comments: 'CRITICAL LOW - Severe hypokalemia detected. Immediate physician notification required.',
          performedAt: new Date(),
        },
      });

      console.log('🚨 CRITICAL: Serum Potassium = 2.1 mEq/L (Normal: 3.5-5.0)');
      console.log('   Status: CRITICAL LOW - Cardiac arrest risk');
      console.log('');
    }

    // CRITICAL LOW Hemoglobin (normal: 12.0-16.0, entering 5.8)
    const hemoglobinTestRecord = labOrder.tests.find(t => t.labTestId === hemoglobinTest.id);
    if (hemoglobinTestRecord) {
      // Calculate critical threshold:
      // Range = 16.0 - 12.0 = 4.0
      // Critical Low = 12.0 - (4.0 * 0.5) = 10.0
      // Our value: 5.8 (CRITICAL!)

      await prisma.labOrderTest.update({
        where: { id: hemoglobinTestRecord.id },
        data: {
          result: '5.8',
          resultValue: 5.8,
          unit: 'g/dL',
          normalRange: '12.0-16.0',
          isCritical: true,
          isAbnormal: true,
          status: 'COMPLETED',
          comments: 'CRITICAL LOW - Severe anemia. Transfusion may be required.',
          performedAt: new Date(),
        },
      });

      console.log('🚨 CRITICAL: Hemoglobin = 5.8 g/dL (Normal: 12.0-16.0)');
      console.log('   Status: CRITICAL LOW - Severe anemia');
      console.log('');
    }

    // Update order status
    await prisma.labOrder.update({
      where: { id: labOrder.id },
      data: { status: 'COMPLETED' },
    });

    console.log('✅ Lab results entered successfully!\n');
    console.log('='.repeat(80));
    console.log('\n📋 TEST CASE SUMMARY:');
    console.log(`   Patient: ${patient.firstName} ${patient.lastName} (MRN: ${patient.mrn})`);
    console.log(`   Order: ${orderNumber}`);
    console.log(`   Status: COMPLETED with 2 CRITICAL values`);
    console.log('\n🔍 You should now see these on the dashboard:');
    console.log('   - Laboratory page should show "2 Critical Values Require Attention"');
    console.log('   - Critical Values tab should list both results');
    console.log('   - Both should be flagged for immediate physician review');
    console.log('\n🌐 Login as lab technician to verify:');
    console.log('   Email: labtech@hospital.com');
    console.log('   Password: password123');
    console.log('   URL: https://spetaar.ai/laboratory\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

createCriticalTestCase();
