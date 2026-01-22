import { PrismaClient, AppointmentStatus, AppointmentType, InvoiceStatus, PaymentStatus, Gender, BloodGroup, LabOrderStatus, PrescriptionStatus, LeadStatus, LeadSource, CampaignStatus } from '@prisma/client';

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

  const patients = [];
  const patientCount = 150;

  for (let i = 0; i < patientCount; i++) {
    const gender = randomElement([Gender.MALE, Gender.FEMALE]);
    const firstName = gender === Gender.MALE
      ? randomElement(firstNames.filter((_, idx) => idx % 2 === 0))
      : randomElement(firstNames.filter((_, idx) => idx % 2 === 1));

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
        emergencyContactName: `${randomElement(firstNames)} ${randomElement(lastNames)}`,
        emergencyContactPhone: generatePhone(),
      },
    });
    patients.push(patient);
  }

  console.log(`✅ Created ${patients.length} patients`);

  // ==================== CREATE APPOINTMENTS (6 MONTHS OF DATA) ====================
  console.log('\n📅 Creating appointments for the last 6 months...');

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const today = new Date();

  const appointmentTypes = [AppointmentType.CONSULTATION, AppointmentType.FOLLOW_UP, AppointmentType.PROCEDURE, AppointmentType.CHECK_UP];
  const appointmentStatuses = [AppointmentStatus.COMPLETED, AppointmentStatus.SCHEDULED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW];

  let appointmentCount = 0;
  const appointments = [];

  // Create appointments day by day for realistic distribution
  const currentDate = new Date(sixMonthsAgo);
  while (currentDate <= today) {
    // More appointments on weekdays
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const appointmentsForDay = isWeekend ? randomInt(5, 15) : randomInt(25, 50);

    for (let i = 0; i < appointmentsForDay; i++) {
      const doctor = randomElement(doctors);
      const patient = randomElement(patients);
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
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`✅ Created ${appointmentCount} appointments`);

  // ==================== CREATE INVOICES (REVENUE DATA) ====================
  console.log('\n💰 Creating invoices for revenue charts...');

  const completedAppointments = appointments.filter(a => a.status === 'COMPLETED');
  let invoiceCount = 0;

  for (const appointment of completedAppointments) {
    const baseAmount = randomInt(50, 500);
    const taxAmount = Math.round(baseAmount * 0.05);
    const totalAmount = baseAmount + taxAmount;

    // Determine payment status
    const rand = Math.random();
    let paymentStatus: PaymentStatus;
    let paidAmount: number;

    if (rand < 0.7) {
      paymentStatus = PaymentStatus.PAID;
      paidAmount = totalAmount;
    } else if (rand < 0.85) {
      paymentStatus = PaymentStatus.PARTIAL;
      paidAmount = Math.round(totalAmount * randomInt(30, 70) / 100);
    } else {
      paymentStatus = PaymentStatus.PENDING;
      paidAmount = 0;
    }

    const invoiceStatus = paymentStatus === PaymentStatus.PAID ? InvoiceStatus.PAID :
                          paymentStatus === PaymentStatus.PARTIAL ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.PENDING;

    await prisma.invoice.create({
      data: {
        hospitalId: hospital.id,
        patientId: appointment.patientId,
        invoiceNumber: `INV-${Date.now().toString().slice(-8)}-${invoiceCount}`,
        totalAmount,
        taxAmount,
        discountAmount: 0,
        paidAmount,
        dueDate: new Date(appointment.appointmentDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: invoiceStatus,
        paymentStatus,
        notes: `Invoice for appointment on ${appointment.appointmentDate.toDateString()}`,
        createdAt: appointment.appointmentDate,
      },
    });
    invoiceCount++;
  }

  console.log(`✅ Created ${invoiceCount} invoices`);

  // ==================== CREATE WARDS AND BEDS ====================
  console.log('\n🛏️ Creating wards and beds...');

  const wardsData = [
    { name: 'General Ward A', code: 'GWA', type: 'GENERAL', floor: '1st Floor', capacity: 30 },
    { name: 'General Ward B', code: 'GWB', type: 'GENERAL', floor: '1st Floor', capacity: 30 },
    { name: 'ICU', code: 'ICU', type: 'ICU', floor: '2nd Floor', capacity: 15 },
    { name: 'Pediatric Ward', code: 'PED', type: 'PEDIATRIC', floor: '3rd Floor', capacity: 20 },
    { name: 'Maternity Ward', code: 'MAT', type: 'MATERNITY', floor: '4th Floor', capacity: 25 },
    { name: 'Surgical Ward', code: 'SUR', type: 'SURGICAL', floor: '5th Floor', capacity: 20 },
  ];

  const wards = [];
  for (const wardData of wardsData) {
    const ward = await prisma.ward.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: wardData.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        ...wardData,
      },
    });
    wards.push(ward);

    // Create beds for this ward
    for (let i = 1; i <= wardData.capacity; i++) {
      const occupancyRate = wardData.type === 'ICU' ? 0.85 : 0.65;
      const isOccupied = Math.random() < occupancyRate;

      await prisma.bed.upsert({
        where: { hospitalId_bedNumber: { hospitalId: hospital.id, bedNumber: `${wardData.code}-${i.toString().padStart(3, '0')}` } },
        update: { status: isOccupied ? 'OCCUPIED' : 'AVAILABLE' },
        create: {
          hospitalId: hospital.id,
          wardId: ward.id,
          bedNumber: `${wardData.code}-${i.toString().padStart(3, '0')}`,
          bedType: wardData.type === 'ICU' ? 'ICU' : 'STANDARD',
          status: isOccupied ? 'OCCUPIED' : 'AVAILABLE',
          dailyRate: wardData.type === 'ICU' ? 500 : 150,
        },
      });
    }
  }

  console.log(`✅ Created ${wards.length} wards with beds`);

  // ==================== CREATE LAB ORDERS ====================
  console.log('\n🔬 Creating lab orders...');

  const labTests = [
    { name: 'Complete Blood Count (CBC)', code: 'CBC', price: 25 },
    { name: 'Basic Metabolic Panel', code: 'BMP', price: 35 },
    { name: 'Lipid Panel', code: 'LIPID', price: 40 },
    { name: 'Thyroid Panel', code: 'TSH', price: 50 },
    { name: 'Urinalysis', code: 'UA', price: 15 },
    { name: 'Blood Glucose', code: 'GLU', price: 10 },
    { name: 'Liver Function Test', code: 'LFT', price: 45 },
    { name: 'Kidney Function Test', code: 'KFT', price: 45 },
    { name: 'HbA1c', code: 'HBA1C', price: 30 },
    { name: 'Vitamin D', code: 'VITD', price: 55 },
  ];

  // Get or create lab tests
  for (const test of labTests) {
    await prisma.labTest.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: test.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: test.name,
        code: test.code,
        category: 'BLOOD_TEST',
        price: test.price,
        turnaroundTime: randomInt(1, 24),
      },
    });
  }

  const dbLabTests = await prisma.labTest.findMany({ where: { hospitalId: hospital.id } });

  // Create lab orders for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let labOrderCount = 0;
  for (let day = 0; day < 30; day++) {
    const orderDate = new Date(thirtyDaysAgo);
    orderDate.setDate(orderDate.getDate() + day);

    const ordersPerDay = randomInt(15, 40);
    for (let i = 0; i < ordersPerDay; i++) {
      const patient = randomElement(patients);
      const doctor = randomElement(doctors);
      const test = randomElement(dbLabTests);

      // Status based on age
      let status: LabOrderStatus;
      const daysAgo = 30 - day;
      if (daysAgo > 3) {
        status = randomElement([LabOrderStatus.COMPLETED, LabOrderStatus.COMPLETED, LabOrderStatus.COMPLETED, LabOrderStatus.CANCELLED]);
      } else if (daysAgo > 1) {
        status = randomElement([LabOrderStatus.COMPLETED, LabOrderStatus.PROCESSING, LabOrderStatus.SAMPLE_COLLECTED]);
      } else {
        status = randomElement([LabOrderStatus.PENDING, LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.PROCESSING, LabOrderStatus.COMPLETED]);
      }

      const isCritical = Math.random() < 0.1 && status === LabOrderStatus.COMPLETED;

      await prisma.labOrder.create({
        data: {
          hospitalId: hospital.id,
          patientId: patient.id,
          doctorId: doctor.id,
          labTestId: test.id,
          orderNumber: `LAB-${Date.now().toString().slice(-6)}-${labOrderCount}`,
          status,
          priority: isCritical ? 'URGENT' : randomElement(['ROUTINE', 'ROUTINE', 'ROUTINE', 'URGENT']),
          isCritical,
          notes: isCritical ? 'Critical value - requires immediate attention' : undefined,
          orderedAt: orderDate,
          collectedAt: status !== LabOrderStatus.PENDING ? new Date(orderDate.getTime() + randomInt(1, 4) * 60 * 60 * 1000) : undefined,
          completedAt: status === LabOrderStatus.COMPLETED ? new Date(orderDate.getTime() + randomInt(4, 24) * 60 * 60 * 1000) : undefined,
        },
      });
      labOrderCount++;
    }
  }

  console.log(`✅ Created ${labOrderCount} lab orders`);

  // ==================== CREATE PRESCRIPTIONS ====================
  console.log('\n💊 Creating prescriptions...');

  const medications = [
    { name: 'Amoxicillin 500mg', stock: randomInt(50, 200), minStock: 50 },
    { name: 'Ibuprofen 400mg', stock: randomInt(100, 300), minStock: 75 },
    { name: 'Metformin 500mg', stock: randomInt(30, 150), minStock: 50 },
    { name: 'Lisinopril 10mg', stock: randomInt(40, 180), minStock: 60 },
    { name: 'Omeprazole 20mg', stock: randomInt(60, 200), minStock: 50 },
    { name: 'Atorvastatin 20mg', stock: randomInt(80, 250), minStock: 70 },
    { name: 'Amlodipine 5mg', stock: randomInt(45, 180), minStock: 55 },
    { name: 'Paracetamol 500mg', stock: randomInt(200, 500), minStock: 100 },
    { name: 'Cetirizine 10mg', stock: randomInt(80, 200), minStock: 50 },
    { name: 'Azithromycin 250mg', stock: randomInt(20, 100), minStock: 30 },
  ];

  // Create medications
  for (const med of medications) {
    await prisma.medication.upsert({
      where: { hospitalId_name: { hospitalId: hospital.id, name: med.name } },
      update: { currentStock: med.stock, minimumStock: med.minStock },
      create: {
        hospitalId: hospital.id,
        name: med.name,
        genericName: med.name.split(' ')[0],
        category: 'TABLET',
        manufacturer: randomElement(['Pfizer', 'Novartis', 'Roche', 'GSK', 'AstraZeneca']),
        currentStock: med.stock,
        minimumStock: med.minStock,
        unitPrice: randomInt(5, 50),
        expiryDate: new Date(Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000),
      },
    });
  }

  const dbMedications = await prisma.medication.findMany({ where: { hospitalId: hospital.id } });

  // Create prescriptions
  let prescriptionCount = 0;
  for (let day = 0; day < 30; day++) {
    const prescDate = new Date(thirtyDaysAgo);
    prescDate.setDate(prescDate.getDate() + day);

    const prescPerDay = randomInt(20, 50);
    for (let i = 0; i < prescPerDay; i++) {
      const patient = randomElement(patients);
      const doctor = randomElement(doctors);
      const medication = randomElement(dbMedications);

      const daysAgo = 30 - day;
      let status: PrescriptionStatus;
      if (daysAgo > 2) {
        status = randomElement([PrescriptionStatus.DISPENSED, PrescriptionStatus.DISPENSED, PrescriptionStatus.DISPENSED, PrescriptionStatus.CANCELLED]);
      } else {
        status = randomElement([PrescriptionStatus.PENDING, PrescriptionStatus.VERIFIED, PrescriptionStatus.DISPENSED]);
      }

      await prisma.prescription.create({
        data: {
          hospitalId: hospital.id,
          patientId: patient.id,
          doctorId: doctor.id,
          prescriptionNumber: `RX-${Date.now().toString().slice(-6)}-${prescriptionCount}`,
          status,
          notes: `Take ${randomElement(['with food', 'before meals', 'after meals', 'as directed'])}`,
          prescribedAt: prescDate,
          dispensedAt: status === PrescriptionStatus.DISPENSED ? new Date(prescDate.getTime() + randomInt(1, 8) * 60 * 60 * 1000) : undefined,
          items: {
            create: [{
              medicationId: medication.id,
              quantity: randomInt(10, 30),
              dosage: randomElement(['1 tablet', '2 tablets', '1/2 tablet']),
              frequency: randomElement(['once daily', 'twice daily', 'three times daily']),
              duration: `${randomInt(5, 14)} days`,
              instructions: randomElement(['Take with water', 'Do not crush', 'Store in cool place']),
            }],
          },
        },
      });
      prescriptionCount++;
    }
  }

  console.log(`✅ Created ${prescriptionCount} prescriptions`);

  // ==================== CREATE EMPLOYEES AND ATTENDANCE ====================
  console.log('\n👥 Creating employees and attendance...');

  // Get existing users to create employees
  const users = await prisma.user.findMany({
    where: { hospitalId: hospital.id, role: { in: ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PHARMACIST'] } },
  });

  const employeeTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT'];

  for (const user of users) {
    const employee = await prisma.employee.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        hospitalId: hospital.id,
        employeeId: `EMP-${Date.now().toString().slice(-4)}-${randomInt(100, 999)}`,
        departmentId: departments[0].id,
        designation: user.role,
        employmentType: randomElement(employeeTypes),
        joiningDate: randomDate(new Date('2020-01-01'), new Date('2024-01-01')),
        salary: randomInt(40000, 150000),
        status: 'ACTIVE',
      },
    });

    // Create attendance for last 30 days
    for (let day = 0; day < 30; day++) {
      const attendanceDate = new Date(thirtyDaysAgo);
      attendanceDate.setDate(attendanceDate.getDate() + day);

      // Skip weekends
      if (attendanceDate.getDay() === 0 || attendanceDate.getDay() === 6) continue;

      const rand = Math.random();
      let status: string;
      if (rand < 0.85) status = 'PRESENT';
      else if (rand < 0.92) status = 'ABSENT';
      else status = 'ON_LEAVE';

      const checkIn = status === 'PRESENT' ? new Date(attendanceDate.setHours(randomInt(7, 9), randomInt(0, 59))) : undefined;
      const checkOut = status === 'PRESENT' ? new Date(attendanceDate.setHours(randomInt(16, 19), randomInt(0, 59))) : undefined;

      await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          hospitalId: hospital.id,
          date: new Date(attendanceDate.toDateString()),
          status,
          checkIn,
          checkOut,
        },
      });
    }
  }

  console.log(`✅ Created attendance records for ${users.length} employees`);

  // ==================== CREATE CRM DATA (LEADS & CAMPAIGNS) ====================
  console.log('\n📊 Creating CRM leads and campaigns...');

  const leadSources = [LeadSource.WEBSITE, LeadSource.REFERRAL, LeadSource.WALK_IN, LeadSource.PHONE, LeadSource.SOCIAL_MEDIA];
  const leadStatuses = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.CONVERTED, LeadStatus.LOST];

  // Create leads
  let leadCount = 0;
  for (let i = 0; i < 200; i++) {
    const createdAt = randomDate(sixMonthsAgo, today);
    const source = randomElement(leadSources);

    // Status based on age and random
    const daysSinceCreation = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    let status: LeadStatus;
    if (daysSinceCreation > 30) {
      status = randomElement([LeadStatus.CONVERTED, LeadStatus.CONVERTED, LeadStatus.LOST, LeadStatus.QUALIFIED]);
    } else if (daysSinceCreation > 7) {
      status = randomElement([LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.CONVERTED, LeadStatus.LOST]);
    } else {
      status = randomElement([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.NEW]);
    }

    await prisma.lead.create({
      data: {
        hospitalId: hospital.id,
        firstName: randomElement(firstNames),
        lastName: randomElement(lastNames),
        email: `lead${leadCount}@email.com`,
        phone: generatePhone(),
        source,
        status,
        notes: `Interested in ${randomElement(['general checkup', 'cardiology', 'pediatrics', 'orthopedics', 'dental'])}`,
        createdAt,
        lastContactedAt: status !== LeadStatus.NEW ? new Date(createdAt.getTime() + randomInt(1, 7) * 24 * 60 * 60 * 1000) : undefined,
      },
    });
    leadCount++;
  }

  console.log(`✅ Created ${leadCount} CRM leads`);

  // Create campaigns
  const campaignNames = [
    'Health Checkup Discount',
    'Cardiology Awareness Month',
    'Pediatric Vaccination Drive',
    'Senior Citizen Health Camp',
    'Diabetes Screening Week',
    'New Year Health Resolution',
  ];

  for (let i = 0; i < campaignNames.length; i++) {
    const startDate = randomDate(new Date(sixMonthsAgo), new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
    const endDate = new Date(startDate.getTime() + randomInt(14, 60) * 24 * 60 * 60 * 1000);
    const isActive = endDate > today;

    const sentCount = randomInt(500, 2000);
    const openedCount = Math.floor(sentCount * (randomInt(20, 45) / 100));
    const clickedCount = Math.floor(openedCount * (randomInt(10, 30) / 100));

    await prisma.campaign.create({
      data: {
        hospitalId: hospital.id,
        name: campaignNames[i],
        type: randomElement(['EMAIL', 'SMS', 'BOTH']),
        status: isActive ? CampaignStatus.ACTIVE : CampaignStatus.COMPLETED,
        subject: `${campaignNames[i]} - Special Offer`,
        content: `Dear Patient, we are offering special discounts on ${campaignNames[i].toLowerCase()}.`,
        targetAudience: randomElement(['ALL_PATIENTS', 'NEW_PATIENTS', 'INACTIVE_PATIENTS']),
        startDate,
        endDate,
        sentCount,
        openedCount,
        clickedCount,
        convertedCount: Math.floor(clickedCount * (randomInt(5, 20) / 100)),
      },
    });
  }

  console.log(`✅ Created ${campaignNames.length} marketing campaigns`);

  // ==================== CREATE RADIOLOGY ORDERS ====================
  console.log('\n📷 Creating radiology orders...');

  const imagingTypes = ['X-RAY', 'CT_SCAN', 'MRI', 'ULTRASOUND', 'MAMMOGRAM'];
  const bodyParts = ['Chest', 'Head', 'Abdomen', 'Spine', 'Knee', 'Shoulder', 'Hand', 'Pelvis'];

  let radiologyCount = 0;
  for (let day = 0; day < 30; day++) {
    const orderDate = new Date(thirtyDaysAgo);
    orderDate.setDate(orderDate.getDate() + day);

    const ordersPerDay = randomInt(8, 20);
    for (let i = 0; i < ordersPerDay; i++) {
      const patient = randomElement(patients);
      const doctor = randomElement(doctors);

      const daysAgo = 30 - day;
      let status: string;
      if (daysAgo > 3) {
        status = randomElement(['COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED']);
      } else if (daysAgo > 1) {
        status = randomElement(['COMPLETED', 'REPORTING', 'IMAGING_DONE']);
      } else {
        status = randomElement(['SCHEDULED', 'IN_PROGRESS', 'IMAGING_DONE', 'REPORTING']);
      }

      await prisma.imagingOrder.create({
        data: {
          hospitalId: hospital.id,
          patientId: patient.id,
          doctorId: doctor.id,
          orderNumber: `RAD-${Date.now().toString().slice(-6)}-${radiologyCount}`,
          modality: randomElement(imagingTypes),
          bodyPart: randomElement(bodyParts),
          status,
          priority: randomElement(['ROUTINE', 'ROUTINE', 'ROUTINE', 'URGENT', 'STAT']),
          clinicalHistory: 'Patient presents with symptoms requiring imaging',
          orderedAt: orderDate,
          scheduledAt: new Date(orderDate.getTime() + randomInt(1, 24) * 60 * 60 * 1000),
          completedAt: status === 'COMPLETED' ? new Date(orderDate.getTime() + randomInt(24, 72) * 60 * 60 * 1000) : undefined,
        },
      });
      radiologyCount++;
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
   • Wards: ${wards.length} with beds
   • Lab Orders: ${labOrderCount}
   • Prescriptions: ${prescriptionCount}
   • Attendance Records: Created for ${users.length} employees
   • CRM Leads: ${leadCount}
   • Marketing Campaigns: ${campaignNames.length}
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
