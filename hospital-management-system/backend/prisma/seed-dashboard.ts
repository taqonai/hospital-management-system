import { PrismaClient, AppointmentStatus, AppointmentType, InvoiceStatus, Gender, BloodGroup } from '@prisma/client';

const prisma = new PrismaClient();

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateMRN(): string {
  return `MRN${Date.now().toString().slice(-6)}${randomInt(100, 999)}`;
}

function generatePhone(): string {
  return `+1-555-${randomInt(100, 999)}-${randomInt(1000, 9999)}`;
}

const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Ahmed', 'Fatima', 'Mohammed', 'Aisha', 'Omar', 'Layla', 'Ali', 'Noor', 'Hassan', 'Sara'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Khan', 'Ahmed', 'Ali', 'Hassan', 'Ibrahim'];

async function main() {
  console.log('🚀 Seeding dashboard data for visualization...\n');

  // Get the hospital
  const hospital = await prisma.hospital.findFirst({
    where: { code: 'HMS001' },
  });

  if (!hospital) {
    console.error('❌ Hospital not found. Please run the main seed first: npm run db:seed');
    process.exit(1);
  }

  console.log(`📍 Using hospital: ${hospital.name}`);

  // Get departments
  const departments = await prisma.department.findMany({
    where: { hospitalId: hospital.id },
  });

  if (departments.length === 0) {
    console.error('❌ No departments found. Please run the main seed first.');
    process.exit(1);
  }

  // Get doctors
  const doctors = await prisma.doctor.findMany({
    where: { hospitalId: hospital.id },
    include: { user: true },
  });

  if (doctors.length === 0) {
    console.error('❌ No doctors found. Please run the main seed first.');
    process.exit(1);
  }

  console.log(`👨‍⚕️ Found ${doctors.length} doctors`);

  // ==================== CREATE PATIENTS ====================
  console.log('\n📋 Creating patients...');

  const patients: any[] = [];
  const patientCount = 100;

  for (let i = 0; i < patientCount; i++) {
    const gender = randomElement([Gender.MALE, Gender.FEMALE]);
    const firstName = gender === Gender.MALE
      ? randomElement(firstNames.filter((_, idx) => idx % 2 === 0))
      : randomElement(firstNames.filter((_, idx) => idx % 2 === 1));

    try {
      const patient = await prisma.patient.create({
        data: {
          hospitalId: hospital.id,
          mrn: generateMRN(),
          firstName,
          lastName: randomElement(lastNames),
          dateOfBirth: randomDate(new Date('1940-01-01'), new Date('2020-12-31')),
          gender,
          bloodGroup: randomElement([BloodGroup.A_POSITIVE, BloodGroup.A_NEGATIVE, BloodGroup.B_POSITIVE, BloodGroup.B_NEGATIVE, BloodGroup.AB_POSITIVE, BloodGroup.AB_NEGATIVE, BloodGroup.O_POSITIVE, BloodGroup.O_NEGATIVE]),
          phone: generatePhone(),
          email: `${firstName.toLowerCase()}.${randomInt(1, 999)}@email.com`,
          address: `${randomInt(100, 9999)} Main Street`,
          city: randomElement(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix']),
          state: randomElement(['NY', 'CA', 'IL', 'TX', 'AZ']),
          zipCode: `${randomInt(10000, 99999)}`,
          emergencyContact: `${randomElement(firstNames)} ${randomElement(lastNames)} - ${generatePhone()}`,
        },
      });
      patients.push(patient);
    } catch (e) {
      // Skip duplicates
    }
  }

  console.log(`✅ Created ${patients.length} patients`);

  // ==================== CREATE APPOINTMENTS (6 MONTHS OF DATA) ====================
  console.log('\n📅 Creating appointments for the last 6 months...');

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const today = new Date();

  const appointmentTypes = [AppointmentType.CONSULTATION, AppointmentType.FOLLOW_UP, AppointmentType.PROCEDURE];

  let appointmentCount = 0;
  const appointments: any[] = [];

  // Create appointments day by day for realistic distribution
  const currentDate = new Date(sixMonthsAgo);
  while (currentDate <= today) {
    // More appointments on weekdays
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const appointmentsForDay = isWeekend ? randomInt(3, 10) : randomInt(15, 35);

    for (let i = 0; i < appointmentsForDay; i++) {
      const doctor = randomElement(doctors);
      const patient = randomElement(patients);
      if (!patient) continue;

      const appointmentDate = new Date(currentDate);
      appointmentDate.setHours(randomInt(8, 17), randomInt(0, 59), 0, 0);

      // Determine status based on date
      let status: AppointmentStatus;
      if (appointmentDate < today) {
        // Past appointments
        const rand = Math.random();
        if (rand < 0.75) status = AppointmentStatus.COMPLETED;
        else if (rand < 0.85) status = AppointmentStatus.CANCELLED;
        else if (rand < 0.95) status = AppointmentStatus.NO_SHOW;
        else status = AppointmentStatus.COMPLETED;
      } else {
        // Future/today appointments
        status = randomElement([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN]);
      }

      try {
        const appointment = await prisma.appointment.create({
          data: {
            hospitalId: hospital.id,
            patientId: patient.id,
            doctorId: doctor.id,
            departmentId: doctor.departmentId,
            appointmentDate,
            startTime: `${appointmentDate.getHours().toString().padStart(2, '0')}:${appointmentDate.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${(appointmentDate.getHours() + 1).toString().padStart(2, '0')}:${appointmentDate.getMinutes().toString().padStart(2, '0')}`,
            type: randomElement(appointmentTypes),
            status,
            notes: status === AppointmentStatus.COMPLETED ? 'Patient visit completed successfully' : undefined,
            tokenNumber: `T${appointmentCount + 1}`,
          },
        });
        appointments.push(appointment);
        appointmentCount++;
      } catch (e) {
        // Skip errors
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`✅ Created ${appointmentCount} appointments`);

  // ==================== CREATE INVOICES (REVENUE DATA) ====================
  console.log('\n💰 Creating invoices for revenue charts...');

  const completedAppointments = appointments.filter(a => a.status === 'COMPLETED');
  let invoiceCount = 0;

  for (const appointment of completedAppointments.slice(0, 500)) {
    const subtotal = randomInt(50, 500);
    const tax = Math.round(subtotal * 0.05);
    const totalAmount = subtotal + tax;

    // Determine payment status
    const rand = Math.random();
    let paidAmount: number;
    let invoiceStatus: InvoiceStatus;

    if (rand < 0.7) {
      invoiceStatus = InvoiceStatus.PAID;
      paidAmount = totalAmount;
    } else if (rand < 0.85) {
      invoiceStatus = InvoiceStatus.PARTIALLY_PAID;
      paidAmount = Math.round(totalAmount * randomInt(30, 70) / 100);
    } else {
      invoiceStatus = InvoiceStatus.PENDING;
      paidAmount = 0;
    }

    try {
      await prisma.invoice.create({
        data: {
          hospitalId: hospital.id,
          patientId: appointment.patientId,
          invoiceNumber: `INV-${Date.now().toString().slice(-8)}-${invoiceCount}`,
          subtotal,
          tax,
          totalAmount,
          paidAmount,
          balanceAmount: totalAmount - paidAmount,
          dueDate: new Date(appointment.appointmentDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          status: invoiceStatus,
          notes: `Invoice for appointment on ${appointment.appointmentDate.toDateString()}`,
          createdAt: appointment.appointmentDate,
        },
      });
      invoiceCount++;
    } catch (e) {
      // Skip errors
    }
  }

  console.log(`✅ Created ${invoiceCount} invoices`);

  // ==================== CREATE LAB ORDERS ====================
  console.log('\n🔬 Creating lab orders...');

  // Get lab tests
  const labTests = await prisma.labTest.findMany({
    where: { hospitalId: hospital.id },
    take: 10,
  });

  if (labTests.length > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let labOrderCount = 0;
    for (let day = 0; day < 30; day++) {
      const orderDate = new Date(thirtyDaysAgo);
      orderDate.setDate(orderDate.getDate() + day);

      const ordersPerDay = randomInt(10, 25);
      for (let i = 0; i < ordersPerDay; i++) {
        const patient = randomElement(patients);
        const doctor = randomElement(doctors);
        const test = randomElement(labTests);
        if (!patient || !test) continue;

        // Status based on age
        const daysAgo = 30 - day;
        let status: string;
        if (daysAgo > 3) {
          status = randomElement(['COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED']);
        } else if (daysAgo > 1) {
          status = randomElement(['COMPLETED', 'IN_PROGRESS', 'SAMPLE_COLLECTED']);
        } else {
          status = randomElement(['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED']);
        }

        const isCritical = Math.random() < 0.1 && status === 'COMPLETED';

        try {
          await prisma.labOrder.create({
            data: {
              hospitalId: hospital.id,
              patientId: patient.id,
              labTestId: test.id,
              orderNumber: `LAB-${Date.now().toString().slice(-6)}-${labOrderCount}`,
              status: status as any,
              priority: isCritical ? 'URGENT' : randomElement(['ROUTINE', 'ROUTINE', 'ROUTINE', 'URGENT']),
              isCritical,
              notes: isCritical ? 'Critical value - requires immediate attention' : undefined,
              orderedAt: orderDate,
              collectedAt: status !== 'ORDERED' ? new Date(orderDate.getTime() + randomInt(1, 4) * 60 * 60 * 1000) : undefined,
              completedAt: status === 'COMPLETED' ? new Date(orderDate.getTime() + randomInt(4, 24) * 60 * 60 * 1000) : undefined,
            },
          });
          labOrderCount++;
        } catch (e) {
          // Skip errors
        }
      }
    }

    console.log(`✅ Created ${labOrderCount} lab orders`);
  } else {
    console.log('⚠️ No lab tests found, skipping lab orders');
  }

  // ==================== CREATE IMAGING ORDERS ====================
  console.log('\n📷 Creating radiology orders...');

  const imagingTypes = ['X_RAY', 'CT_SCAN', 'MRI', 'ULTRASOUND'];
  const bodyParts = ['Chest', 'Head', 'Abdomen', 'Spine', 'Knee', 'Shoulder', 'Hand', 'Pelvis'];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let radiologyCount = 0;
  for (let day = 0; day < 30; day++) {
    const orderDate = new Date(thirtyDaysAgo);
    orderDate.setDate(orderDate.getDate() + day);

    const ordersPerDay = randomInt(5, 15);
    for (let i = 0; i < ordersPerDay; i++) {
      const patient = randomElement(patients);
      const doctor = randomElement(doctors);
      if (!patient) continue;

      const daysAgo = 30 - day;
      let status: string;
      if (daysAgo > 3) {
        status = randomElement(['COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED']);
      } else if (daysAgo > 1) {
        status = randomElement(['COMPLETED', 'REPORTING', 'IMAGING_DONE']);
      } else {
        status = randomElement(['SCHEDULED', 'IN_PROGRESS', 'IMAGING_DONE', 'REPORTING']);
      }

      try {
        await prisma.imagingOrder.create({
          data: {
            hospitalId: hospital.id,
            patientId: patient.id,
            doctorId: doctor.id,
            orderNumber: `RAD-${Date.now().toString().slice(-6)}-${radiologyCount}`,
            modality: randomElement(imagingTypes) as any,
            bodyPart: randomElement(bodyParts),
            status: status as any,
            priority: randomElement(['ROUTINE', 'ROUTINE', 'ROUTINE', 'URGENT', 'STAT']),
            clinicalHistory: 'Patient presents with symptoms requiring imaging',
            orderedAt: orderDate,
            scheduledAt: new Date(orderDate.getTime() + randomInt(1, 24) * 60 * 60 * 1000),
            completedAt: status === 'COMPLETED' ? new Date(orderDate.getTime() + randomInt(24, 72) * 60 * 60 * 1000) : undefined,
          },
        });
        radiologyCount++;
      } catch (e) {
        // Skip errors
      }
    }
  }

  console.log(`✅ Created ${radiologyCount} radiology orders`);

  // ==================== SUMMARY ====================
  console.log('\n' + '='.repeat(60));
  console.log('✨ Dashboard data seeding completed successfully!');
  console.log('='.repeat(60));
  console.log(`
📊 Summary:
   • Patients: ${patients.length}
   • Appointments: ${appointmentCount} (6 months of data)
   • Invoices: ${invoiceCount}
   • Lab Orders: Created
   • Radiology Orders: ${radiologyCount}
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
