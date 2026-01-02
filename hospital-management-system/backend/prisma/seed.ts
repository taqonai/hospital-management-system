import { PrismaClient, UserRole, DayOfWeek } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Hospital
  const hospital = await prisma.hospital.upsert({
    where: { code: 'HMS001' },
    update: {},
    create: {
      name: 'City General Hospital',
      code: 'HMS001',
      address: '123 Medical Center Drive',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      zipCode: '10001',
      phone: '+1-555-123-4567',
      email: 'info@citygeneral.com',
      website: 'https://citygeneral.com',
      licenseNumber: 'LIC-2024-001',
      accreditation: 'Joint Commission Accredited',
      bedCapacity: 500,
      isActive: true,
    },
  });

  console.log(`Created hospital: ${hospital.name}`);

  // Create Departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: 'CARD' } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: 'Cardiology',
        code: 'CARD',
        description: 'Heart and cardiovascular care',
        floor: '3rd Floor',
        phone: '+1-555-123-4568',
      },
    }),
    prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: 'NEUR' } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: 'Neurology',
        code: 'NEUR',
        description: 'Brain and nervous system care',
        floor: '4th Floor',
        phone: '+1-555-123-4569',
      },
    }),
    prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: 'ORTH' } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: 'Orthopedics',
        code: 'ORTH',
        description: 'Bone and joint care',
        floor: '2nd Floor',
        phone: '+1-555-123-4570',
      },
    }),
    prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: 'PEDI' } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: 'Pediatrics',
        code: 'PEDI',
        description: 'Child healthcare',
        floor: '5th Floor',
        phone: '+1-555-123-4571',
      },
    }),
    prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: 'GENM' } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: 'General Medicine',
        code: 'GENM',
        description: 'General healthcare services',
        floor: '1st Floor',
        phone: '+1-555-123-4572',
      },
    }),
    prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: 'EMER' } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: 'Emergency',
        code: 'EMER',
        description: 'Emergency and trauma care',
        floor: 'Ground Floor',
        phone: '+1-555-123-4573',
      },
    }),
    prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: 'SURG' } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: 'Surgery',
        code: 'SURG',
        description: 'Surgical services',
        floor: '6th Floor',
        phone: '+1-555-123-4574',
      },
    }),
    prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: 'RADI' } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: 'Radiology',
        code: 'RADI',
        description: 'Diagnostic imaging',
        floor: 'Ground Floor',
        phone: '+1-555-123-4575',
      },
    }),
  ]);

  console.log(`Created ${departments.length} departments`);

  // Create Admin User
  const adminPassword = await bcrypt.hash('password123', 12);
  const adminUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'admin@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'admin@hospital.com',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      phone: '+1-555-100-0001',
      role: UserRole.HOSPITAL_ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`Created admin user: ${adminUser.email}`);

  // Create Doctor Users and Profiles
  const doctorPassword = await bcrypt.hash('password123', 12);

  const doctorsData = [
    {
      email: 'dr.smith@hospital.com',
      firstName: 'John',
      lastName: 'Smith',
      departmentIndex: 0,
      specialization: 'Cardiology',
      qualification: 'MD, FACC',
      experience: 15,
      consultationFee: 150,
    },
    {
      email: 'dr.johnson@hospital.com',
      firstName: 'Emily',
      lastName: 'Johnson',
      departmentIndex: 1,
      specialization: 'Neurology',
      qualification: 'MD, PhD',
      experience: 12,
      consultationFee: 175,
    },
    {
      email: 'dr.williams@hospital.com',
      firstName: 'Michael',
      lastName: 'Williams',
      departmentIndex: 2,
      specialization: 'Orthopedic Surgery',
      qualification: 'MD, FAAOS',
      experience: 20,
      consultationFee: 200,
    },
    {
      email: 'dr.brown@hospital.com',
      firstName: 'Sarah',
      lastName: 'Brown',
      departmentIndex: 3,
      specialization: 'Pediatrics',
      qualification: 'MD, FAAP',
      experience: 10,
      consultationFee: 125,
    },
    {
      email: 'dr.davis@hospital.com',
      firstName: 'Robert',
      lastName: 'Davis',
      departmentIndex: 4,
      specialization: 'Internal Medicine',
      qualification: 'MD, FACP',
      experience: 18,
      consultationFee: 140,
    },
    {
      email: 'dr.wilson@hospital.com',
      firstName: 'James',
      lastName: 'Wilson',
      departmentIndex: 5,
      specialization: 'Emergency Medicine',
      qualification: 'MD, FACEP',
      experience: 14,
      consultationFee: 180,
    },
    {
      email: 'dr.taylor@hospital.com',
      firstName: 'Lisa',
      lastName: 'Taylor',
      departmentIndex: 6,
      specialization: 'General Surgery',
      qualification: 'MD, FACS',
      experience: 16,
      consultationFee: 220,
    },
    {
      email: 'dr.anderson@hospital.com',
      firstName: 'Mark',
      lastName: 'Anderson',
      departmentIndex: 7,
      specialization: 'Radiology',
      qualification: 'MD, FACR',
      experience: 13,
      consultationFee: 160,
    },
  ];

  const doctors: any[] = [];
  for (const doctorData of doctorsData) {
    const user = await prisma.user.upsert({
      where: {
        hospitalId_email: { hospitalId: hospital.id, email: doctorData.email },
      },
      update: {},
      create: {
        hospitalId: hospital.id,
        email: doctorData.email,
        password: doctorPassword,
        firstName: doctorData.firstName,
        lastName: doctorData.lastName,
        phone: `+1-555-200-000${doctorsData.indexOf(doctorData) + 1}`,
        role: UserRole.DOCTOR,
        isActive: true,
        isEmailVerified: true,
      },
    });

    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        departmentId: departments[doctorData.departmentIndex].id,
        specialization: doctorData.specialization,
        qualification: doctorData.qualification,
        experience: doctorData.experience,
        licenseNumber: `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        consultationFee: doctorData.consultationFee,
        bio: `Experienced ${doctorData.specialization} specialist with ${doctorData.experience} years of practice.`,
        availableDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
        slotDuration: 30,
        maxPatientsPerDay: 30,
        isAvailable: true,
      },
    });

    doctors.push({ ...doctor, user });
    console.log(`Created doctor: Dr. ${doctorData.firstName} ${doctorData.lastName}`);
  }

  // Create Nurse Users
  const nursePassword = await bcrypt.hash('password123', 12);
  const nursesData = [
    { firstName: 'Nancy', lastName: 'Miller', departmentIndex: 0, shift: 'MORNING' },
    { firstName: 'Helen', lastName: 'Moore', departmentIndex: 4, shift: 'AFTERNOON' },
    { firstName: 'Patricia', lastName: 'Clark', departmentIndex: 5, shift: 'NIGHT' },
  ];

  const nurses: any[] = [];
  for (let i = 0; i < nursesData.length; i++) {
    const nurseData = nursesData[i];
    const user = await prisma.user.upsert({
      where: {
        hospitalId_email: { hospitalId: hospital.id, email: `nurse.${nurseData.lastName.toLowerCase()}@hospital.com` },
      },
      update: {},
      create: {
        hospitalId: hospital.id,
        email: `nurse.${nurseData.lastName.toLowerCase()}@hospital.com`,
        password: nursePassword,
        firstName: nurseData.firstName,
        lastName: nurseData.lastName,
        phone: `+1-555-400-000${i + 1}`,
        role: UserRole.NURSE,
        isActive: true,
        isEmailVerified: true,
      },
    });

    const nurse = await prisma.nurse.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        departmentId: departments[nurseData.departmentIndex].id,
        qualification: 'BSN, RN',
        shift: nurseData.shift as any,
        licenseNumber: `NRS-${Date.now()}-${i}`,
      },
    });

    nurses.push(nurse);
    console.log(`Created nurse: ${nurseData.firstName} ${nurseData.lastName}`);
  }

  // Create Lab Tests
  const labTests = [
    { name: 'Complete Blood Count (CBC)', code: 'CBC001', category: 'Hematology', sampleType: 'Blood', price: 50, turnaroundTime: 4 },
    { name: 'Basic Metabolic Panel', code: 'BMP001', category: 'Chemistry', sampleType: 'Blood', price: 75, turnaroundTime: 6 },
    { name: 'Lipid Panel', code: 'LIP001', category: 'Chemistry', sampleType: 'Blood', price: 60, turnaroundTime: 8 },
    { name: 'Liver Function Test', code: 'LFT001', category: 'Chemistry', sampleType: 'Blood', price: 80, turnaroundTime: 6 },
    { name: 'Thyroid Panel', code: 'THY001', category: 'Endocrinology', sampleType: 'Blood', price: 90, turnaroundTime: 12 },
    { name: 'Urinalysis', code: 'UA001', category: 'Urinalysis', sampleType: 'Urine', price: 30, turnaroundTime: 2 },
    { name: 'Blood Glucose', code: 'GLU001', category: 'Chemistry', sampleType: 'Blood', price: 25, turnaroundTime: 2 },
    { name: 'HbA1c', code: 'HBA001', category: 'Chemistry', sampleType: 'Blood', price: 55, turnaroundTime: 24 },
    { name: 'Troponin I', code: 'TRP001', category: 'Cardiac', sampleType: 'Blood', price: 120, turnaroundTime: 1 },
    { name: 'D-Dimer', code: 'DDM001', category: 'Coagulation', sampleType: 'Blood', price: 95, turnaroundTime: 2 },
  ];

  const createdLabTests: any[] = [];
  for (const test of labTests) {
    const labTest = await prisma.labTest.upsert({
      where: { code: test.code },
      update: {},
      create: test,
    });
    createdLabTests.push(labTest);
  }

  console.log(`Created ${labTests.length} lab tests`);

  // Create Sample Patients
  const patientsData = [
    { firstName: 'James', lastName: 'Wilson', gender: 'MALE', dateOfBirth: new Date('1985-03-15'), phone: '+1-555-300-0001', bloodGroup: 'A_POSITIVE' },
    { firstName: 'Maria', lastName: 'Garcia', gender: 'FEMALE', dateOfBirth: new Date('1990-07-22'), phone: '+1-555-300-0002', bloodGroup: 'B_POSITIVE' },
    { firstName: 'David', lastName: 'Lee', gender: 'MALE', dateOfBirth: new Date('1978-11-08'), phone: '+1-555-300-0003', bloodGroup: 'O_POSITIVE' },
    { firstName: 'Jennifer', lastName: 'Martinez', gender: 'FEMALE', dateOfBirth: new Date('1995-01-30'), phone: '+1-555-300-0004', bloodGroup: 'AB_POSITIVE' },
    { firstName: 'Richard', lastName: 'Anderson', gender: 'MALE', dateOfBirth: new Date('1965-09-12'), phone: '+1-555-300-0005', bloodGroup: 'O_NEGATIVE' },
    { firstName: 'Susan', lastName: 'Thomas', gender: 'FEMALE', dateOfBirth: new Date('1982-05-18'), phone: '+1-555-300-0006', bloodGroup: 'A_NEGATIVE' },
    { firstName: 'Michael', lastName: 'Jackson', gender: 'MALE', dateOfBirth: new Date('1970-06-25'), phone: '+1-555-300-0007', bloodGroup: 'B_NEGATIVE' },
    { firstName: 'Linda', lastName: 'White', gender: 'FEMALE', dateOfBirth: new Date('1988-12-03'), phone: '+1-555-300-0008', bloodGroup: 'O_POSITIVE' },
    { firstName: 'Robert', lastName: 'Harris', gender: 'MALE', dateOfBirth: new Date('1955-02-14'), phone: '+1-555-300-0009', bloodGroup: 'A_POSITIVE' },
    { firstName: 'Elizabeth', lastName: 'Clark', gender: 'FEMALE', dateOfBirth: new Date('1992-08-28'), phone: '+1-555-300-0010', bloodGroup: 'AB_NEGATIVE' },
  ];

  const patients: any[] = [];
  for (let i = 0; i < patientsData.length; i++) {
    const patientData = patientsData[i];
    const mrn = `MRN-${(100000 + i).toString()}`;

    const patient = await prisma.patient.upsert({
      where: { hospitalId_mrn: { hospitalId: hospital.id, mrn } },
      update: {},
      create: {
        hospitalId: hospital.id,
        mrn,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        dateOfBirth: patientData.dateOfBirth,
        gender: patientData.gender as any,
        phone: patientData.phone,
        address: `${100 + i} Main Street`,
        city: 'New York',
        state: 'NY',
        zipCode: `1000${i}`,
        bloodGroup: patientData.bloodGroup as any,
      },
    });

    // Create medical history for each patient
    await prisma.medicalHistory.upsert({
      where: { patientId: patient.id },
      update: {},
      create: {
        patientId: patient.id,
        chronicConditions: i % 3 === 0 ? ['Hypertension', 'Diabetes'] : i % 2 === 0 ? ['Hypertension'] : [],
        pastSurgeries: i === 2 ? ['Appendectomy 2010'] : i === 6 ? ['Knee Replacement 2018'] : [],
        familyHistory: ['Diabetes', 'Heart Disease'],
        currentMedications: i % 2 === 0 ? ['Lisinopril 10mg', 'Metformin 500mg'] : [],
        immunizations: ['Flu Shot 2024', 'COVID-19', 'Tetanus 2022'],
      },
    });

    // Create allergies for some patients
    if (i % 3 === 0) {
      await prisma.allergy.create({
        data: {
          patientId: patient.id,
          allergen: 'Penicillin',
          type: 'DRUG',
          severity: 'SEVERE',
          reaction: 'Anaphylaxis',
        },
      });
    }
    if (i % 4 === 0) {
      await prisma.allergy.create({
        data: {
          patientId: patient.id,
          allergen: 'Peanuts',
          type: 'FOOD',
          severity: 'MODERATE',
          reaction: 'Hives, swelling',
        },
      });
    }

    patients.push(patient);
    console.log(`Created patient: ${patientData.firstName} ${patientData.lastName}`);
  }

  // Create Wards
  const wardsData = [
    { name: 'General Ward A', floor: 1, capacity: 20, type: 'GENERAL' },
    { name: 'General Ward B', floor: 1, capacity: 20, type: 'GENERAL' },
    { name: 'Private Ward', floor: 2, capacity: 10, type: 'PRIVATE' },
    { name: 'ICU', floor: 3, capacity: 10, type: 'ICU' },
    { name: 'Emergency Ward', floor: 0, capacity: 15, type: 'GENERAL' },
    { name: 'Surgical Ward', floor: 6, capacity: 12, type: 'SEMI_PRIVATE' },
  ];

  const wards: any[] = [];
  for (const wardData of wardsData) {
    const ward = await prisma.ward.create({
      data: wardData as any,
    });
    wards.push(ward);
  }

  console.log(`Created ${wards.length} wards`);

  // Create Beds
  const wardPrefixes = ['GWA', 'GWB', 'PVT', 'ICU', 'EMR', 'SRG'];
  const beds: any[] = [];
  for (let w = 0; w < wards.length; w++) {
    const ward = wards[w];
    const bedCount = Math.min(ward.capacity, 8);
    for (let i = 1; i <= bedCount; i++) {
      const bedNumber = `${wardPrefixes[w]}-${i.toString().padStart(3, '0')}`;
      const bed = await prisma.bed.upsert({
        where: {
          hospitalId_bedNumber: { hospitalId: hospital.id, bedNumber },
        },
        update: {},
        create: {
          hospitalId: hospital.id,
          departmentId: departments[Math.min(w, departments.length - 1)].id,
          wardId: ward.id,
          bedNumber,
          bedType: ward.type === 'ICU' ? 'ICU' : 'STANDARD',
          dailyRate: ward.type === 'PRIVATE' ? 500 : ward.type === 'ICU' ? 1000 : 200,
          status: i <= 3 ? 'AVAILABLE' : i === 4 ? 'OCCUPIED' : 'AVAILABLE',
        },
      });
      beds.push(bed);
    }
  }

  console.log(`Created ${beds.length} beds`);

  // Create sample drugs
  const drugsData = [
    { name: 'Paracetamol', genericName: 'Acetaminophen', code: 'DRUG001', category: 'Analgesic', dosageForm: 'Tablet', strength: '500mg', price: 5 },
    { name: 'Amoxicillin', genericName: 'Amoxicillin', code: 'DRUG002', category: 'Antibiotic', dosageForm: 'Capsule', strength: '500mg', price: 15 },
    { name: 'Omeprazole', genericName: 'Omeprazole', code: 'DRUG003', category: 'Antacid', dosageForm: 'Capsule', strength: '20mg', price: 12 },
    { name: 'Metformin', genericName: 'Metformin', code: 'DRUG004', category: 'Antidiabetic', dosageForm: 'Tablet', strength: '500mg', price: 8 },
    { name: 'Lisinopril', genericName: 'Lisinopril', code: 'DRUG005', category: 'Antihypertensive', dosageForm: 'Tablet', strength: '10mg', price: 10 },
    { name: 'Aspirin', genericName: 'Acetylsalicylic Acid', code: 'DRUG006', category: 'Antiplatelet', dosageForm: 'Tablet', strength: '81mg', price: 6 },
    { name: 'Atorvastatin', genericName: 'Atorvastatin', code: 'DRUG007', category: 'Statin', dosageForm: 'Tablet', strength: '20mg', price: 18 },
    { name: 'Amlodipine', genericName: 'Amlodipine', code: 'DRUG008', category: 'Calcium Channel Blocker', dosageForm: 'Tablet', strength: '5mg', price: 14 },
    { name: 'Ibuprofen', genericName: 'Ibuprofen', code: 'DRUG009', category: 'NSAID', dosageForm: 'Tablet', strength: '400mg', price: 7 },
    { name: 'Ceftriaxone', genericName: 'Ceftriaxone', code: 'DRUG010', category: 'Antibiotic', dosageForm: 'Injection', strength: '1g', price: 45 },
  ];

  const drugs: any[] = [];
  for (const drug of drugsData) {
    const createdDrug = await prisma.drug.upsert({
      where: { code: drug.code },
      update: {},
      create: drug,
    });
    drugs.push(createdDrug);
  }

  console.log(`Created ${drugs.length} drugs`);

  // Create Drug Inventory
  for (let i = 0; i < drugs.length; i++) {
    await prisma.drugInventory.create({
      data: {
        drugId: drugs[i].id,
        batchNumber: `BATCH-${2024}${(i + 1).toString().padStart(4, '0')}`,
        quantity: 100 + Math.floor(Math.random() * 400),
        expiryDate: new Date(Date.now() + (365 + i * 30) * 24 * 60 * 60 * 1000),
        location: i % 2 === 0 ? 'Main Pharmacy' : 'Emergency Stock',
        costPrice: drugs[i].price * 0.7,
        sellingPrice: drugs[i].price,
        receivedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('Created drug inventory');

  // Create Appointments (OPD)
  const today = new Date();
  const appointments: any[] = [];

  for (let i = 0; i < 15; i++) {
    const appointmentDate = new Date(today);
    appointmentDate.setDate(today.getDate() + Math.floor(i / 3) - 2);
    appointmentDate.setHours(9 + (i % 8), 0, 0, 0);

    const startHour = 9 + (i % 8);
    const appointment = await prisma.appointment.create({
      data: {
        hospitalId: hospital.id,
        patientId: patients[i % patients.length].id,
        doctorId: doctors[i % 5].id,
        appointmentDate,
        startTime: `${startHour.toString().padStart(2, '0')}:00`,
        endTime: `${startHour.toString().padStart(2, '0')}:30`,
        type: i % 5 === 0 ? 'FOLLOW_UP' : 'CONSULTATION',
        status: i < 3 ? 'COMPLETED' : i < 6 ? 'CHECKED_IN' : i < 10 ? 'SCHEDULED' : 'CONFIRMED',
        reason: ['Annual checkup', 'Follow-up visit', 'New symptoms', 'Medication review', 'Test results review'][i % 5],
        tokenNumber: i < 10 ? i + 1 : null,
        checkedInAt: i < 6 ? new Date(appointmentDate.getTime() - 15 * 60 * 1000) : null,
      },
    });
    appointments.push(appointment);
  }

  console.log(`Created ${appointments.length} appointments`);

  // Create Consultations for completed appointments
  for (let i = 0; i < 3; i++) {
    await prisma.consultation.create({
      data: {
        appointmentId: appointments[i].id,
        patientId: patients[i % patients.length].id,
        doctorId: doctors[i % 5].id,
        chiefComplaint: ['Chest pain', 'Headache', 'Joint pain'][i],
        historyOfIllness: 'Patient reports symptoms for the past week.',
        examination: 'Vitals stable. Physical examination unremarkable.',
        diagnosis: ['Hypertension', 'Tension headache', 'Osteoarthritis'][i].split(', '),
        icdCodes: ['I10', 'G44.2', 'M15.0'][i].split(', '),
        treatmentPlan: 'Medication prescribed. Follow up in 2 weeks.',
        advice: 'Rest, hydration, and medication compliance.',
        followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('Created consultations');

  // Create Lab Orders
  const labOrders: any[] = [];
  for (let i = 0; i < 12; i++) {
    const orderDate = new Date(today);
    orderDate.setDate(today.getDate() - Math.floor(i / 3));

    const labOrder = await prisma.labOrder.create({
      data: {
        hospitalId: hospital.id,
        patientId: patients[i % patients.length].id,
        orderNumber: `LAB-${Date.now().toString(36).toUpperCase()}${i}`,
        orderedBy: doctors[i % 5].user.id,
        priority: i === 0 ? 'STAT' : i < 3 ? 'URGENT' : 'ROUTINE',
        status: i < 3 ? 'COMPLETED' : i < 6 ? 'IN_PROGRESS' : i < 9 ? 'SAMPLE_COLLECTED' : 'ORDERED',
        clinicalNotes: 'Routine screening',
        orderedAt: orderDate,
        collectedAt: i < 9 ? new Date(orderDate.getTime() + 30 * 60 * 1000) : null,
        completedAt: i < 3 ? new Date(orderDate.getTime() + 4 * 60 * 60 * 1000) : null,
      },
    });

    // Add tests to the order
    const testsToAdd = [createdLabTests[i % createdLabTests.length], createdLabTests[(i + 1) % createdLabTests.length]];
    for (const test of testsToAdd) {
      await prisma.labOrderTest.create({
        data: {
          labOrderId: labOrder.id,
          labTestId: test.id,
          status: i < 3 ? 'COMPLETED' : i < 6 ? 'IN_PROGRESS' : 'PENDING',
          result: i < 3 ? '14.5' : null,
          resultValue: i < 3 ? 14.5 : null,
          unit: 'g/dL',
          normalRange: '12.0-16.0',
          isAbnormal: i === 0,
          isCritical: i === 0,
          performedBy: i < 3 ? adminUser.id : null,
          performedAt: i < 3 ? new Date() : null,
        },
      });
    }

    labOrders.push(labOrder);
  }

  console.log(`Created ${labOrders.length} lab orders`);

  // Create Imaging Orders (Radiology)
  const imagingOrders: any[] = [];
  const modalityTypes = ['XRAY', 'CT', 'MRI', 'ULTRASOUND'];
  const bodyParts = ['Chest', 'Abdomen', 'Head', 'Spine', 'Knee', 'Shoulder'];

  for (let i = 0; i < 10; i++) {
    const orderDate = new Date(today);
    orderDate.setDate(today.getDate() - Math.floor(i / 2));

    const imagingOrder = await prisma.imagingOrder.create({
      data: {
        hospitalId: hospital.id,
        patientId: patients[i % patients.length].id,
        orderNumber: `RAD-${Date.now().toString(36).toUpperCase()}${i}`,
        modalityType: modalityTypes[i % modalityTypes.length] as any,
        bodyPart: bodyParts[i % bodyParts.length],
        priority: i === 0 ? 'STAT' : i < 3 ? 'URGENT' : 'ROUTINE',
        status: i < 2 ? 'COMPLETED' : i < 4 ? 'IN_PROGRESS' : i < 6 ? 'SCHEDULED' : 'ORDERED',
        clinicalHistory: 'Patient presents with symptoms. Rule out pathology.',
        orderedBy: doctors[i % 5].user.id,
        scheduledDate: i < 6 ? new Date(orderDate.getTime() + 24 * 60 * 60 * 1000) : null,
        performedDate: i < 4 ? orderDate : null,
      },
    });

    // Create study for completed imaging orders
    if (i < 2) {
      await prisma.imagingStudy.create({
        data: {
          orderId: imagingOrder.id,
          studyInstanceUid: `1.2.3.4.${Date.now()}.${i}`,
          accessionNumber: `ACC${Date.now()}${i}`,
          studyDate: orderDate,
          studyDescription: `${modalityTypes[i % modalityTypes.length]} ${bodyParts[i % bodyParts.length]}`,
          numberOfSeries: 2,
          numberOfImages: 50,
          modality: modalityTypes[i % modalityTypes.length],
          bodyPart: bodyParts[i % bodyParts.length],
          storageLocation: `/studies/${imagingOrder.id}`,
          findings: 'No acute abnormality identified.',
          impression: 'Normal study.',
          radiologistId: doctors[7].user.id,
          reportedAt: new Date(),
        },
      });

      // Create AI analysis for some imaging orders
      if (i === 0) {
        await prisma.aIImageAnalysis.create({
          data: {
            imagingOrderId: imagingOrder.id,
            findings: JSON.stringify([
              { region: 'Right lower lobe', finding: 'Possible nodule', confidence: 0.78 },
            ]),
            impression: 'AI detected possible nodule. Recommend radiologist review.',
            abnormalityDetected: true,
            confidence: 0.78,
            modelVersion: 'v2.1.0',
          },
        });
      }
    }

    imagingOrders.push(imagingOrder);
  }

  console.log(`Created ${imagingOrders.length} imaging orders`);

  // Create Admissions (IPD)
  const admissions: any[] = [];
  const occupiedBeds = beds.filter(b => b.status === 'OCCUPIED' || beds.indexOf(b) < 5);

  for (let i = 0; i < 5; i++) {
    const admissionDate = new Date(today);
    admissionDate.setDate(today.getDate() - (5 - i));

    const admission = await prisma.admission.create({
      data: {
        hospitalId: hospital.id,
        patientId: patients[i].id,
        bedId: occupiedBeds[i % occupiedBeds.length].id,
        admissionDate,
        admissionType: i === 0 ? 'EMERGENCY' : 'ELECTIVE',
        admittingDoctorId: doctors[i % 5].id,
        status: i < 2 ? 'ADMITTED' : i < 4 ? 'ADMITTED' : 'DISCHARGED',
        chiefComplaint: ['Chest pain', 'Scheduled surgery', 'Severe headache', 'Fracture', 'Pneumonia'][i],
        diagnosis: ['Acute Coronary Syndrome', 'Total Hip Replacement', 'Migraine', 'Tibia Fracture', 'Community Acquired Pneumonia'][i].split(', '),
        icdCodes: ['I21.9', 'Z96.64', 'G43.909', 'S82.201A', 'J18.9'][i].split(', '),
        treatmentPlan: 'Medical management and monitoring.',
        estimatedDays: [5, 7, 3, 10, 5][i],
        dischargeDate: i === 4 ? new Date() : null,
      },
    });

    // Update bed status
    await prisma.bed.update({
      where: { id: occupiedBeds[i % occupiedBeds.length].id },
      data: { status: i < 4 ? 'OCCUPIED' : 'CLEANING' },
    });

    // Create nursing notes
    if (nurses.length > 0) {
      await prisma.nursingNote.create({
        data: {
          admissionId: admission.id,
          nurseId: nurses[i % nurses.length].id,
          noteType: 'Assessment',
          content: 'Patient stable. Vitals within normal limits. Pain level 3/10.',
          vitals: JSON.stringify({
            temperature: 98.6,
            bloodPressure: '120/80',
            heartRate: 72,
            respiratoryRate: 16,
            oxygenSaturation: 98,
          }),
        },
      });
    }

    // Create discharge summary for discharged patients
    if (i === 4) {
      await prisma.dischargeSummary.create({
        data: {
          admissionId: admission.id,
          dischargeDate: new Date(),
          dischargeType: 'Regular',
          finalDiagnosis: ['Community Acquired Pneumonia - Resolved'],
          proceduresPerformed: ['IV Antibiotics', 'Respiratory Therapy'],
          conditionAtDischarge: 'Stable, improved',
          medicationsOnDischarge: ['Amoxicillin 500mg TID x 7 days', 'Paracetamol 500mg PRN'],
          followUpInstructions: 'Follow up with primary care in 1 week. Return if fever or breathing difficulty.',
          followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          dietaryInstructions: 'Regular diet. Increase fluid intake.',
          activityRestrictions: 'Light activity for 1 week.',
          warningSignsToWatch: ['Fever > 101F', 'Shortness of breath', 'Chest pain'],
          preparedBy: adminUser.id,
        },
      });
    }

    admissions.push(admission);
  }

  console.log(`Created ${admissions.length} admissions`);

  // Create Surgeries
  for (let i = 0; i < 3; i++) {
    const scheduledDate = new Date(today);
    scheduledDate.setDate(today.getDate() + i);
    scheduledDate.setHours(8 + i * 3, 0, 0, 0);

    await prisma.surgery.create({
      data: {
        admissionId: admissions[i % admissions.length].id,
        patientId: patients[i].id,
        surgeonId: doctors[6].id, // Surgery specialist
        surgeryType: 'Elective',
        procedureName: ['Coronary Artery Bypass', 'Total Hip Replacement', 'Craniotomy'][i],
        cptCode: ['33533', '27130', '61304'][i],
        scheduledDate,
        status: i === 0 ? 'COMPLETED' : i === 1 ? 'IN_PROGRESS' : 'SCHEDULED',
        operationTheatre: `OT-${i + 1}`,
        anesthesiaType: 'General',
        preOpDiagnosis: ['Coronary Artery Disease', 'Hip Osteoarthritis', 'Brain Tumor'][i],
        postOpDiagnosis: i === 0 ? 'Coronary Artery Disease - Post CABG' : null,
        findings: i === 0 ? 'Triple vessel disease. 3 grafts placed successfully.' : null,
        actualStartTime: i < 2 ? new Date(scheduledDate.getTime()) : null,
        actualEndTime: i === 0 ? new Date(scheduledDate.getTime() + 4 * 60 * 60 * 1000) : null,
      },
    });
  }

  console.log('Created surgeries');

  // Create Invoices (Billing)
  const invoices: any[] = [];
  for (let i = 0; i < 8; i++) {
    const invoiceDate = new Date(today);
    invoiceDate.setDate(today.getDate() - i * 2);

    const subtotal = 500 + Math.floor(Math.random() * 2000);
    const discount = Math.floor(subtotal * 0.1);
    const tax = Math.floor((subtotal - discount) * 0.05);
    const totalAmount = subtotal - discount + tax;
    const paidAmount = i < 3 ? totalAmount : i < 5 ? Math.floor(totalAmount * 0.5) : 0;

    const invoice = await prisma.invoice.create({
      data: {
        hospitalId: hospital.id,
        patientId: patients[i % patients.length].id,
        invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}${i}`,
        invoiceDate,
        dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: i < 3 ? 'PAID' : i < 5 ? 'PARTIALLY_PAID' : 'PENDING',
        subtotal,
        discount,
        tax,
        totalAmount,
        paidAmount,
        balanceAmount: totalAmount - paidAmount,
      },
    });

    // Create invoice items
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        description: 'Consultation Fee',
        category: 'Consultation',
        quantity: 1,
        unitPrice: 150,
        discount: 0,
        totalPrice: 150,
      },
    });

    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        description: 'Laboratory Tests',
        category: 'Laboratory',
        quantity: 2,
        unitPrice: 75,
        discount: 0,
        totalPrice: 150,
      },
    });

    if (i % 2 === 0) {
      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: 'Room Charges',
          category: 'Room',
          quantity: 3,
          unitPrice: 200,
          discount: discount,
          totalPrice: 600 - discount,
        },
      });
    }

    // Create payments for paid/partially paid invoices
    if (paidAmount > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: paidAmount,
          paymentMethod: i % 3 === 0 ? 'CASH' : i % 3 === 1 ? 'CREDIT_CARD' : 'INSURANCE',
          referenceNumber: `PAY-${Date.now().toString(36).toUpperCase()}${i}`,
          receivedBy: adminUser.id,
        },
      });
    }

    // Create insurance claims for some invoices
    if (i < 4) {
      await prisma.insuranceClaim.create({
        data: {
          invoiceId: invoice.id,
          claimNumber: `CLM-${Date.now().toString(36).toUpperCase()}${i}`,
          insuranceProvider: ['BlueCross BlueShield', 'Aetna', 'UnitedHealthcare', 'Cigna'][i],
          policyNumber: `POL${100000 + i}`,
          claimAmount: totalAmount,
          approvedAmount: i < 2 ? totalAmount * 0.8 : null,
          status: i === 0 ? 'PAID' : i === 1 ? 'APPROVED' : i === 2 ? 'UNDER_REVIEW' : 'SUBMITTED',
          processedAt: i < 2 ? new Date() : null,
        },
      });
    }

    invoices.push(invoice);
  }

  console.log(`Created ${invoices.length} invoices`);

  // Create Prescriptions
  for (let i = 0; i < 5; i++) {
    const prescription = await prisma.prescription.create({
      data: {
        patientId: patients[i].id,
        doctorId: doctors[i % 5].id,
        admissionId: i < 3 ? admissions[i].id : null,
        prescriptionDate: new Date(),
        status: 'ACTIVE',
        notes: 'Take medications as prescribed. Follow up if symptoms persist.',
      },
    });

    // Add medications to prescription
    const medicationsToAdd = [drugs[i % drugs.length], drugs[(i + 1) % drugs.length]];
    for (let j = 0; j < medicationsToAdd.length; j++) {
      await prisma.prescriptionMedication.create({
        data: {
          prescriptionId: prescription.id,
          drugId: medicationsToAdd[j].id,
          drugName: medicationsToAdd[j].name,
          dosage: medicationsToAdd[j].strength,
          frequency: ['Once daily', 'Twice daily', 'Three times daily'][j % 3],
          duration: '7 days',
          quantity: 14,
          route: 'Oral',
          instructions: 'Take with food',
          beforeAfterFood: 'After food',
          isDispensed: i < 2,
          dispensedAt: i < 2 ? new Date() : null,
          dispensedBy: i < 2 ? adminUser.id : null,
        },
      });
    }
  }

  console.log('Created prescriptions');

  // Create Vitals for patients
  for (let i = 0; i < patients.length; i++) {
    for (let j = 0; j < 3; j++) {
      const recordedAt = new Date();
      recordedAt.setDate(recordedAt.getDate() - j);

      await prisma.vital.create({
        data: {
          patientId: patients[i].id,
          temperature: 97.5 + Math.random() * 2,
          bloodPressureSys: 110 + Math.floor(Math.random() * 30),
          bloodPressureDia: 70 + Math.floor(Math.random() * 20),
          heartRate: 65 + Math.floor(Math.random() * 25),
          respiratoryRate: 14 + Math.floor(Math.random() * 6),
          oxygenSaturation: 95 + Math.floor(Math.random() * 5),
          weight: 60 + Math.floor(Math.random() * 40),
          height: 160 + Math.floor(Math.random() * 30),
          recordedBy: adminUser.id,
          recordedAt,
        },
      });
    }
  }

  console.log('Created vitals');

  // Create Emergency Appointments (for Emergency module display)
  const emergencyAppointments: any[] = [];
  const esiLevels = [1, 2, 3, 4, 5];
  const chiefComplaints = [
    'Cardiac arrest',
    'Severe chest pain',
    'High fever with rash',
    'Minor laceration',
    'Mild headache',
  ];

  for (let i = 0; i < 8; i++) {
    const arrivalTime = new Date(today);
    arrivalTime.setHours(today.getHours() - i);

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId: hospital.id,
        patientId: patients[i % patients.length].id,
        doctorId: doctors[5].id, // Emergency doctor
        appointmentDate: arrivalTime,
        startTime: arrivalTime.toTimeString().slice(0, 5),
        endTime: new Date(arrivalTime.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5),
        type: 'EMERGENCY',
        status: i < 2 ? 'IN_PROGRESS' : i < 4 ? 'CHECKED_IN' : 'SCHEDULED',
        reason: chiefComplaints[i % chiefComplaints.length],
        notes: `ESI Level: ${esiLevels[i % esiLevels.length]}`,
        checkedInAt: arrivalTime,
      },
    });

    emergencyAppointments.push(appointment);
  }

  console.log(`Created ${emergencyAppointments.length} emergency appointments`);

  // ==================== HR MODULE SEED DATA ====================
  console.log('\n--- Seeding HR Module ---');

  // Create HR Manager User
  const hrManagerUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'hr.manager@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'hr.manager@hospital.com',
      password: adminPassword,
      firstName: 'Rachel',
      lastName: 'Green',
      phone: '+1-555-500-0001',
      role: 'HR_MANAGER' as UserRole,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`Created HR Manager: ${hrManagerUser.email}`);

  // Create HR Staff User
  const hrStaffUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'hr.staff@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'hr.staff@hospital.com',
      password: adminPassword,
      firstName: 'Monica',
      lastName: 'Geller',
      phone: '+1-555-500-0002',
      role: 'HR_STAFF' as UserRole,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`Created HR Staff: ${hrStaffUser.email}`);

  // Create Lab Technician User
  const labTechUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'lab.tech@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'lab.tech@hospital.com',
      password: adminPassword,
      firstName: 'Walter',
      lastName: 'White',
      phone: '+1-555-600-0001',
      role: 'LAB_TECHNICIAN' as UserRole,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Created Lab Technician: ${labTechUser.email}`);

  // Create Pharmacist User
  const pharmacistUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'pharmacist@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'pharmacist@hospital.com',
      password: adminPassword,
      firstName: 'Jesse',
      lastName: 'Pinkman',
      phone: '+1-555-600-0002',
      role: 'PHARMACIST' as UserRole,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Created Pharmacist: ${pharmacistUser.email}`);

  // Create Radiologist User
  const radiologistUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'radiologist@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'radiologist@hospital.com',
      password: adminPassword,
      firstName: 'Gregory',
      lastName: 'House',
      phone: '+1-555-600-0003',
      role: 'RADIOLOGIST' as UserRole,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Created Radiologist: ${radiologistUser.email}`);

  // Create Accountant User
  const accountantUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'accountant@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'accountant@hospital.com',
      password: adminPassword,
      firstName: 'Oscar',
      lastName: 'Martinez',
      phone: '+1-555-600-0004',
      role: 'ACCOUNTANT' as UserRole,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Created Accountant: ${accountantUser.email}`);

  // Create Receptionist User
  const receptionistUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'receptionist@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'receptionist@hospital.com',
      password: adminPassword,
      firstName: 'Pam',
      lastName: 'Beesly',
      phone: '+1-555-600-0005',
      role: 'RECEPTIONIST' as UserRole,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Created Receptionist: ${receptionistUser.email}`);

  // Create Shifts
  const shiftsData = [
    { name: 'Morning Shift', code: 'MORN', startTime: '06:00', endTime: '14:00', workingHours: 8.0, isNightShift: false },
    { name: 'Day Shift', code: 'DAY', startTime: '08:00', endTime: '17:00', workingHours: 9.0, isNightShift: false },
    { name: 'Afternoon Shift', code: 'AFT', startTime: '14:00', endTime: '22:00', workingHours: 8.0, isNightShift: false },
    { name: 'Night Shift', code: 'NGHT', startTime: '22:00', endTime: '06:00', workingHours: 8.0, isNightShift: true },
    { name: 'Flexible Shift', code: 'FLEX', startTime: '09:00', endTime: '18:00', workingHours: 9.0, isNightShift: false },
  ];

  const shifts: any[] = [];
  for (const shiftData of shiftsData) {
    const shift = await prisma.shift.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: shiftData.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: shiftData.name,
        code: shiftData.code,
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        workingHours: shiftData.workingHours,
        isNightShift: shiftData.isNightShift,
        isActive: true,
      },
    });
    shifts.push(shift);
  }

  console.log(`Created ${shifts.length} shifts`);

  // Create Leave Types
  const leaveTypesData = [
    { name: 'Annual Leave', code: 'AL', defaultDays: 21, isPaid: true, requiresApproval: true, carryForward: true, maxCarryForward: 5 },
    { name: 'Sick Leave', code: 'SL', defaultDays: 12, isPaid: true, requiresApproval: true, carryForward: false },
    { name: 'Casual Leave', code: 'CL', defaultDays: 6, isPaid: true, requiresApproval: true, carryForward: false },
    { name: 'Maternity Leave', code: 'ML', defaultDays: 90, isPaid: true, requiresApproval: true, carryForward: false, minNoticeDays: 30 },
    { name: 'Paternity Leave', code: 'PL', defaultDays: 15, isPaid: true, requiresApproval: true, carryForward: false },
    { name: 'Unpaid Leave', code: 'UL', defaultDays: 30, isPaid: false, requiresApproval: true, carryForward: false },
    { name: 'Compensatory Off', code: 'CO', defaultDays: 0, isPaid: true, requiresApproval: true, carryForward: false },
  ];

  const leaveTypes: any[] = [];
  for (const ltData of leaveTypesData) {
    const leaveType = await prisma.leaveType.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: ltData.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        ...ltData,
        isActive: true,
      },
    });
    leaveTypes.push(leaveType);
  }

  console.log(`Created ${leaveTypes.length} leave types`);

  // Create Employees (Non-medical staff)
  const employeesData = [
    // HR Department
    { firstName: 'Rachel', lastName: 'Green', designation: 'HR Manager', employeeType: 'FULL_TIME', shiftIndex: 1, basicSalary: 75000 },
    { firstName: 'Monica', lastName: 'Geller', designation: 'HR Executive', employeeType: 'FULL_TIME', shiftIndex: 1, basicSalary: 45000 },
    // Housekeeping Department
    { firstName: 'Ross', lastName: 'Geller', designation: 'Housekeeping Supervisor', employeeType: 'FULL_TIME', shiftIndex: 0, basicSalary: 40000 },
    { firstName: 'Joey', lastName: 'Tribbiani', designation: 'Housekeeping Staff', employeeType: 'FULL_TIME', shiftIndex: 0, basicSalary: 25000 },
    { firstName: 'Chandler', lastName: 'Bing', designation: 'Housekeeping Staff', employeeType: 'FULL_TIME', shiftIndex: 2, basicSalary: 25000 },
    { firstName: 'Phoebe', lastName: 'Buffay', designation: 'Housekeeping Staff', employeeType: 'FULL_TIME', shiftIndex: 3, basicSalary: 25000 },
    { firstName: 'Gunther', lastName: 'Central', designation: 'Housekeeping Staff', employeeType: 'PART_TIME', shiftIndex: 0, basicSalary: 15000 },
    // Security Department
    { firstName: 'Mike', lastName: 'Hannigan', designation: 'Security Supervisor', employeeType: 'FULL_TIME', shiftIndex: 1, basicSalary: 35000 },
    { firstName: 'David', lastName: 'Scientist', designation: 'Security Guard', employeeType: 'FULL_TIME', shiftIndex: 0, basicSalary: 22000 },
    { firstName: 'Gary', lastName: 'Officer', designation: 'Security Guard', employeeType: 'FULL_TIME', shiftIndex: 2, basicSalary: 22000 },
    { firstName: 'Eddie', lastName: 'Night', designation: 'Security Guard', employeeType: 'FULL_TIME', shiftIndex: 3, basicSalary: 24000 },
    // Maintenance Department
    { firstName: 'Richard', lastName: 'Burke', designation: 'Maintenance Supervisor', employeeType: 'FULL_TIME', shiftIndex: 1, basicSalary: 42000 },
    { firstName: 'Jack', lastName: 'Geller', designation: 'Electrician', employeeType: 'FULL_TIME', shiftIndex: 1, basicSalary: 32000 },
    { firstName: 'Frank', lastName: 'Junior', designation: 'Plumber', employeeType: 'FULL_TIME', shiftIndex: 1, basicSalary: 30000 },
    // Kitchen/Dietary Department
    { firstName: 'Judy', lastName: 'Geller', designation: 'Kitchen Supervisor', employeeType: 'FULL_TIME', shiftIndex: 0, basicSalary: 38000 },
    { firstName: 'Estelle', lastName: 'Leonard', designation: 'Cook', employeeType: 'FULL_TIME', shiftIndex: 0, basicSalary: 28000 },
    { firstName: 'Janice', lastName: 'Litman', designation: 'Kitchen Assistant', employeeType: 'FULL_TIME', shiftIndex: 0, basicSalary: 20000 },
    // Administration
    { firstName: 'Carol', lastName: 'Willick', designation: 'Receptionist', employeeType: 'FULL_TIME', shiftIndex: 1, basicSalary: 30000 },
    { firstName: 'Susan', lastName: 'Bunch', designation: 'Receptionist', employeeType: 'FULL_TIME', shiftIndex: 2, basicSalary: 30000 },
    { firstName: 'Barry', lastName: 'Farber', designation: 'Office Assistant', employeeType: 'PART_TIME', shiftIndex: 1, basicSalary: 18000 },
  ];

  const employees: any[] = [];
  for (let i = 0; i < employeesData.length; i++) {
    const empData = employeesData[i];
    const joiningDate = new Date();
    joiningDate.setFullYear(joiningDate.getFullYear() - Math.floor(Math.random() * 5) - 1);

    const employee = await prisma.employee.create({
      data: {
        hospitalId: hospital.id,
        shiftId: shifts[empData.shiftIndex].id,
        employeeCode: `EMP${(1000 + i).toString()}`,
        firstName: empData.firstName,
        lastName: empData.lastName,
        email: `${empData.firstName.toLowerCase()}.${empData.lastName.toLowerCase()}@hospital.com`,
        phone: `+1-555-600-${(1000 + i).toString().slice(-4)}`,
        designation: empData.designation,
        employeeType: empData.employeeType as any,
        employmentStatus: 'ACTIVE',
        joiningDate,
        basicSalary: empData.basicSalary,
        // Personal info
        dateOfBirth: new Date(1980 + Math.floor(Math.random() * 20), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: i % 3 === 0 ? 'FEMALE' : 'MALE',
        address: `${100 + i} Employee Street`,
        city: 'New York',
        state: 'NY',
        zipCode: `1001${i % 10}`,
      },
    });

    employees.push(employee);

    // Create leave balances for each employee
    for (const leaveType of leaveTypes) {
      const entitled = leaveType.defaultDays;
      const taken = Math.floor(Math.random() * Math.min(entitled, 5));
      await prisma.leaveBalance.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          year: new Date().getFullYear(),
          entitled,
          taken,
          pending: 0,
          balance: entitled - taken,
          carryForwarded: 0,
        },
      });
    }
  }

  console.log(`Created ${employees.length} employees`);

  // Create Attendance records for the past 7 days
  const attendanceRecords: any[] = [];
  for (const employee of employees) {
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      date.setHours(0, 0, 0, 0);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const shift = shifts.find((s: any) => s.id === employee.shiftId);
      const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);

      // Simulate some late arrivals and absences
      const isAbsent = Math.random() < 0.05; // 5% absence rate
      const isLate = !isAbsent && Math.random() < 0.15; // 15% late rate
      const lateMinutes = isLate ? Math.floor(Math.random() * 30) + 5 : 0;

      if (!isAbsent) {
        const checkIn = new Date(date);
        checkIn.setHours(shiftHour, shiftMin + lateMinutes, 0, 0);

        const [endHour] = shift.endTime.split(':').map(Number);
        const checkOut = new Date(date);
        checkOut.setHours(endHour, 0, 0, 0);
        if (endHour < shiftHour) checkOut.setDate(checkOut.getDate() + 1);

        const workHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

        const attendance = await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date,
            checkIn,
            checkOut: d > 0 ? checkOut : null, // Today might not have checkout yet
            status: d === 0 ? 'PRESENT' : (workHours < 4 ? 'HALF_DAY' : 'PRESENT'),
            workingHours: d > 0 ? workHours : null,
            lateMinutes: lateMinutes > 0 ? lateMinutes : null,
          },
        });
        attendanceRecords.push(attendance);
      } else {
        const attendance = await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date,
            status: 'ABSENT',
          },
        });
        attendanceRecords.push(attendance);
      }
    }
  }

  console.log(`Created ${attendanceRecords.length} attendance records`);

  // Create Leave Requests
  const leaveRequestsData = [
    { employeeIndex: 3, leaveTypeIndex: 0, startOffset: 10, days: 5, status: 'APPROVED', reason: 'Family vacation' },
    { employeeIndex: 5, leaveTypeIndex: 1, startOffset: -3, days: 2, status: 'APPROVED', reason: 'Fever and cold' },
    { employeeIndex: 7, leaveTypeIndex: 2, startOffset: 5, days: 1, status: 'PENDING', reason: 'Personal work' },
    { employeeIndex: 8, leaveTypeIndex: 0, startOffset: 15, days: 7, status: 'PENDING', reason: 'Wedding in family' },
    { employeeIndex: 10, leaveTypeIndex: 1, startOffset: -1, days: 1, status: 'APPROVED', reason: 'Doctor appointment' },
    { employeeIndex: 12, leaveTypeIndex: 2, startOffset: 3, days: 1, status: 'REJECTED', reason: 'Personal errands' },
  ];

  for (const lrData of leaveRequestsData) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + lrData.startOffset);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + lrData.days - 1);

    await prisma.leaveRequest.create({
      data: {
        employeeId: employees[lrData.employeeIndex].id,
        leaveTypeId: leaveTypes[lrData.leaveTypeIndex].id,
        startDate,
        endDate,
        days: lrData.days,
        reason: lrData.reason,
        status: lrData.status as any,
        approvedBy: lrData.status !== 'PENDING' ? hrManagerUser.id : null,
        approvedAt: lrData.status !== 'PENDING' ? new Date() : null,
        rejectionReason: lrData.status === 'REJECTED' ? 'Staffing shortage during requested period' : null,
      },
    });
  }

  console.log(`Created ${leaveRequestsData.length} leave requests`);

  // Create Payroll records for last month
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const payrollMonth = lastMonth.getMonth() + 1;
  const payrollYear = lastMonth.getFullYear();

  for (const employee of employees) {
    const basicSalary = Number(employee.basicSalary);
    const hra = Math.round(basicSalary * 0.4);
    const conveyance = 1600;
    const medical = 1250;
    const special = Math.round(basicSalary * 0.1);
    const grossEarnings = basicSalary + hra + conveyance + medical + special;

    const pf = Math.round(basicSalary * 0.12);
    const esi = grossEarnings > 21000 ? 0 : Math.round(grossEarnings * 0.0075);
    const professionalTax = 200;
    const tds = Math.round(grossEarnings * 0.1);
    const totalDeductions = pf + esi + professionalTax + tds;

    const netSalary = grossEarnings - totalDeductions;

    const payroll = await prisma.payroll.create({
      data: {
        employeeId: employee.id,
        month: payrollMonth,
        year: payrollYear,
        basicSalary,
        hra,
        conveyance,
        medicalAllowance: medical,
        specialAllowance: special,
        grossEarnings,
        pfEmployee: pf,
        pfEmployer: pf,
        esi,
        professionalTax,
        tds,
        totalDeductions,
        netSalary,
        totalWorkingDays: 22,
        daysWorked: 20 + Math.floor(Math.random() * 3),
        leavesTaken: Math.floor(Math.random() * 2),
        lopDays: 0,
        status: Math.random() > 0.3 ? 'PAID' : 'APPROVED',
        processedBy: hrManagerUser.id,
        processedAt: new Date(),
        paidAt: Math.random() > 0.3 ? new Date() : null,
        paymentMode: 'BANK_TRANSFER',
      },
    });

    // Create payroll components
    await prisma.payrollComponent.createMany({
      data: [
        { payrollId: payroll.id, name: 'Basic Salary', type: 'EARNING', amount: basicSalary },
        { payrollId: payroll.id, name: 'HRA', type: 'EARNING', amount: hra },
        { payrollId: payroll.id, name: 'Conveyance', type: 'EARNING', amount: conveyance },
        { payrollId: payroll.id, name: 'Medical Allowance', type: 'EARNING', amount: medical },
        { payrollId: payroll.id, name: 'Special Allowance', type: 'EARNING', amount: special },
        { payrollId: payroll.id, name: 'Provident Fund', type: 'DEDUCTION', amount: pf },
        { payrollId: payroll.id, name: 'ESI', type: 'DEDUCTION', amount: esi },
        { payrollId: payroll.id, name: 'Professional Tax', type: 'DEDUCTION', amount: professionalTax },
        { payrollId: payroll.id, name: 'TDS', type: 'DEDUCTION', amount: tds },
      ],
    });
  }

  console.log(`Created payroll records for ${employees.length} employees`);

  // ==================== HOUSEKEEPING MODULE SEED DATA ====================
  console.log('\n--- Seeding Housekeeping Module ---');

  // Create Housekeeping Manager User
  const housekeepingManagerUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'housekeeping.manager@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'housekeeping.manager@hospital.com',
      password: adminPassword,
      firstName: 'Ross',
      lastName: 'Geller',
      phone: '+1-555-550-0001',
      role: 'HOUSEKEEPING_MANAGER' as UserRole,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`Created Housekeeping Manager: ${housekeepingManagerUser.email}`);

  // Create Housekeeping Staff Users
  const housekeepingStaffUsers: any[] = [];
  const hkStaffData = [
    { firstName: 'Joey', lastName: 'Tribbiani', email: 'joey.hk@hospital.com' },
    { firstName: 'Chandler', lastName: 'Bing', email: 'chandler.hk@hospital.com' },
    { firstName: 'Phoebe', lastName: 'Buffay', email: 'phoebe.hk@hospital.com' },
  ];

  for (let i = 0; i < hkStaffData.length; i++) {
    const user = await prisma.user.upsert({
      where: {
        hospitalId_email: { hospitalId: hospital.id, email: hkStaffData[i].email },
      },
      update: {},
      create: {
        hospitalId: hospital.id,
        email: hkStaffData[i].email,
        password: adminPassword,
        firstName: hkStaffData[i].firstName,
        lastName: hkStaffData[i].lastName,
        phone: `+1-555-550-000${i + 2}`,
        role: 'HOUSEKEEPING_STAFF' as UserRole,
        isActive: true,
        isEmailVerified: true,
      },
    });
    housekeepingStaffUsers.push(user);
  }

  console.log(`Created ${housekeepingStaffUsers.length} housekeeping staff users`);

  // Create Housekeeping Zones
  const zonesData = [
    { name: 'Emergency Department', code: 'EMER', floor: 'Ground', building: 'Main Building' },
    { name: 'ICU Ward', code: 'ICU', floor: '3rd', building: 'Main Building' },
    { name: 'Operating Theater 1', code: 'OT1', floor: '6th', building: 'Main Building' },
    { name: 'Operating Theater 2', code: 'OT2', floor: '6th', building: 'Main Building' },
    { name: 'General Ward A', code: 'GWA', floor: '1st', building: 'Main Building' },
    { name: 'General Ward B', code: 'GWB', floor: '1st', building: 'Main Building' },
    { name: 'Private Ward', code: 'PVT', floor: '2nd', building: 'Main Building' },
    { name: 'Pediatric Ward', code: 'PED', floor: '5th', building: 'Main Building' },
    { name: 'Laboratory', code: 'LAB', floor: 'Ground', building: 'Main Building' },
    { name: 'Pharmacy', code: 'PHR', floor: 'Ground', building: 'Main Building' },
    { name: 'Main Lobby', code: 'LOB', floor: 'Ground', building: 'Main Building' },
    { name: 'Cafeteria', code: 'CAF', floor: 'Ground', building: 'Main Building' },
    { name: 'Ground Floor Corridor', code: 'GFC', floor: 'Ground', building: 'Main Building' },
    { name: '1st Floor Corridor', code: 'C1F', floor: '1st', building: 'Main Building' },
    { name: 'Public Restroom - Ground', code: 'RRG', floor: 'Ground', building: 'Main Building' },
    { name: 'Public Restroom - 1st Floor', code: 'RR1', floor: '1st', building: 'Main Building' },
    { name: 'Admin Office', code: 'ADM', floor: '2nd', building: 'Admin Wing' },
    { name: 'Storage Room', code: 'STR', floor: 'Basement', building: 'Main Building' },
    { name: 'Hospital Garden', code: 'GRD', floor: 'Ground', building: 'External' },
    { name: 'Parking Area', code: 'PRK', floor: 'Ground', building: 'External' },
  ];

  const zones: any[] = [];
  for (const zoneData of zonesData) {
    const zone = await prisma.housekeepingZone.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: zoneData.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: zoneData.name,
        code: zoneData.code,
        floor: zoneData.floor,
        building: zoneData.building,
        isActive: true,
      },
    });
    zones.push(zone);
  }

  console.log(`Created ${zones.length} housekeeping zones`);

  // Create Cleaning Checklists
  const checklistsData = [
    {
      name: 'Standard Room Cleaning',
      taskType: 'ROUTINE_CLEANING',
      items: [
        { name: 'Dust all surfaces', sequence: 1 },
        { name: 'Mop floor', sequence: 2 },
        { name: 'Empty trash bins', sequence: 3 },
        { name: 'Clean windows', sequence: 4 },
        { name: 'Sanitize door handles', sequence: 5 },
        { name: 'Replace linens if needed', sequence: 6 },
      ],
    },
    {
      name: 'Deep Cleaning',
      taskType: 'DEEP_CLEANING',
      items: [
        { name: 'Move furniture and clean behind', sequence: 1 },
        { name: 'Deep clean carpets/floors', sequence: 2 },
        { name: 'Clean all vents and fixtures', sequence: 3 },
        { name: 'Sanitize all surfaces', sequence: 4 },
        { name: 'Clean light fixtures', sequence: 5 },
        { name: 'Wash walls if needed', sequence: 6 },
        { name: 'Clean ceiling', sequence: 7 },
      ],
    },
    {
      name: 'Discharge Cleaning',
      taskType: 'DISCHARGE_CLEANING',
      items: [
        { name: 'Strip and remake bed', sequence: 1 },
        { name: 'Sanitize all surfaces', sequence: 2 },
        { name: 'Clean bathroom thoroughly', sequence: 3 },
        { name: 'Mop and disinfect floor', sequence: 4 },
        { name: 'Replace all consumables', sequence: 5 },
        { name: 'Check equipment cleanliness', sequence: 6 },
        { name: 'Final inspection', sequence: 7 },
      ],
    },
    {
      name: 'Terminal Cleaning (Isolation)',
      taskType: 'TERMINAL_CLEANING',
      items: [
        { name: 'Don appropriate PPE', sequence: 1 },
        { name: 'Remove all disposable items', sequence: 2 },
        { name: 'Clean ceiling to floor', sequence: 3 },
        { name: 'UV disinfection', sequence: 4 },
        { name: 'Sanitize all equipment', sequence: 5 },
        { name: 'Replace curtains', sequence: 6 },
        { name: 'Air quality check', sequence: 7 },
        { name: 'Documentation', sequence: 8 },
      ],
    },
    {
      name: 'Operating Theater Cleaning',
      taskType: 'INFECTION_CONTROL',
      items: [
        { name: 'Floor wet mopping with disinfectant', sequence: 1 },
        { name: 'Clean all equipment surfaces', sequence: 2 },
        { name: 'Sanitize operating table', sequence: 3 },
        { name: 'Clean overhead lights', sequence: 4 },
        { name: 'Check and clean vents', sequence: 5 },
        { name: 'Replace sterile supplies', sequence: 6 },
        { name: 'UV treatment', sequence: 7 },
        { name: 'Air sampling', sequence: 8 },
      ],
    },
  ];

  const checklists: any[] = [];
  for (const clData of checklistsData) {
    const checklist = await prisma.cleaningChecklist.create({
      data: {
        hospitalId: hospital.id,
        name: clData.name,
        taskType: clData.taskType as any,
        items: clData.items,
        isActive: true,
      },
    });
    checklists.push(checklist);
  }

  console.log(`Created ${checklists.length} cleaning checklists`);

  // Create Housekeeping Tasks
  const taskTypes = ['ROUTINE_CLEANING', 'DEEP_CLEANING', 'DISCHARGE_CLEANING', 'TERMINAL_CLEANING', 'SANITIZATION', 'INFECTION_CONTROL'];
  const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY'];
  const hkStatuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'];

  const tasks: any[] = [];
  for (let i = 0; i < 30; i++) {
    const scheduledStart = new Date();
    scheduledStart.setDate(scheduledStart.getDate() + Math.floor(Math.random() * 7) - 3);
    scheduledStart.setHours(6 + Math.floor(Math.random() * 12), 0, 0, 0);
    const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);

    const taskType = taskTypes[i % taskTypes.length];
    const status = i < 5 ? 'VERIFIED' : i < 10 ? 'COMPLETED' : i < 15 ? 'IN_PROGRESS' : i < 20 ? 'ASSIGNED' : 'PENDING';
    const isInfectionControl = i % 7 === 0;

    const task = await prisma.housekeepingTask.create({
      data: {
        hospitalId: hospital.id,
        zoneId: zones[i % zones.length].id,
        taskType: taskType as any,
        description: `${taskType} cleaning for ${zones[i % zones.length].name}`,
        priority: isInfectionControl ? 'URGENT' : priorities[i % priorities.length] as any,
        status: status as any,
        assignedTo: status !== 'PENDING' ? employees.find((e: any) => e.designation.includes('Housekeeping'))?.id : null,
        assignedAt: status !== 'PENDING' ? new Date() : null,
        supervisorId: employees.find((e: any) => e.designation === 'Housekeeping Supervisor')?.id,
        scheduledStart,
        scheduledEnd,
        estimatedMinutes: taskType === 'DEEP' ? 120 : taskType === 'TERMINAL' ? 180 : 45,
        infectionControl: isInfectionControl,
        actualStart: ['IN_PROGRESS', 'COMPLETED', 'VERIFIED'].includes(status) ? new Date(scheduledStart.getTime() + 15 * 60000) : null,
        actualEnd: ['COMPLETED', 'VERIFIED'].includes(status) ? new Date(scheduledStart.getTime() + 60 * 60000) : null,
        verifiedBy: status === 'VERIFIED' ? housekeepingManagerUser.id : null,
        verifiedAt: status === 'VERIFIED' ? new Date(scheduledStart.getTime() + 90 * 60000) : null,
        qualityScore: status === 'VERIFIED' ? 8 + Math.floor(Math.random() * 3) : null,
      },
    });

    // Create checklist items for the task
    const checklist = checklists.find((c: any) => c.taskType === taskType) || checklists[0];
    const checklistItems = checklist.items as { name: string; sequence: number }[];
    for (let j = 0; j < checklistItems.length; j++) {
      await prisma.taskChecklistItem.create({
        data: {
          taskId: task.id,
          itemName: checklistItems[j].name,
          sequence: j + 1,
          isCompleted: ['COMPLETED', 'VERIFIED'].includes(status),
          completedAt: ['COMPLETED', 'VERIFIED'].includes(status) ? new Date() : null,
        },
      });
    }

    tasks.push(task);
  }

  console.log(`Created ${tasks.length} housekeeping tasks`);

  // Create Housekeeping Inventory
  const inventoryData = [
    { name: 'Floor Cleaner (5L)', code: 'FC5L', category: 'FLOOR_CLEANER', unit: 'bottles', currentStock: 45, minStock: 10, maxStock: 100, reorderLevel: 20, costPerUnit: 15 },
    { name: 'Disinfectant (5L)', code: 'DS5L', category: 'DISINFECTANT', unit: 'bottles', currentStock: 38, minStock: 15, maxStock: 100, reorderLevel: 25, costPerUnit: 25 },
    { name: 'Glass Cleaner (1L)', code: 'GC1L', category: 'GLASS_CLEANER', unit: 'bottles', currentStock: 22, minStock: 10, maxStock: 50, reorderLevel: 15, costPerUnit: 8 },
    { name: 'Hand Sanitizer (500ml)', code: 'HS5M', category: 'SANITIZER', unit: 'bottles', currentStock: 150, minStock: 50, maxStock: 300, reorderLevel: 80, costPerUnit: 5 },
    { name: 'Surface Sanitizer (1L)', code: 'SS1L', category: 'SANITIZER', unit: 'bottles', currentStock: 65, minStock: 20, maxStock: 150, reorderLevel: 40, costPerUnit: 12 },
    { name: 'Mop Heads', code: 'MPH', category: 'MOP', unit: 'pieces', currentStock: 25, minStock: 10, maxStock: 50, reorderLevel: 15, costPerUnit: 8 },
    { name: 'Brooms', code: 'BRM', category: 'BROOM', unit: 'pieces', currentStock: 18, minStock: 5, maxStock: 30, reorderLevel: 10, costPerUnit: 12 },
    { name: 'Dustpans', code: 'DSP', category: 'BUCKET', unit: 'pieces', currentStock: 15, minStock: 5, maxStock: 25, reorderLevel: 8, costPerUnit: 5 },
    { name: 'Microfiber Cloths', code: 'MFC', category: 'OTHER', unit: 'packs', currentStock: 8, minStock: 10, maxStock: 50, reorderLevel: 15, costPerUnit: 20 }, // Low stock
    { name: 'Disposable Gloves (Box)', code: 'DGL', category: 'GLOVES', unit: 'boxes', currentStock: 45, minStock: 20, maxStock: 100, reorderLevel: 30, costPerUnit: 15 },
    { name: 'Face Masks (Box)', code: 'FMK', category: 'MASK', unit: 'boxes', currentStock: 12, minStock: 15, maxStock: 80, reorderLevel: 25, costPerUnit: 25 }, // Low stock
    { name: 'Protective Gowns', code: 'PGN', category: 'PPE', unit: 'pieces', currentStock: 50, minStock: 20, maxStock: 100, reorderLevel: 35, costPerUnit: 10 },
    { name: 'Trash Bags (Large)', code: 'TBL', category: 'TRASH_BAG', unit: 'rolls', currentStock: 35, minStock: 15, maxStock: 80, reorderLevel: 25, costPerUnit: 18 },
    { name: 'Trash Bags (Small)', code: 'TBS', category: 'TRASH_BAG', unit: 'rolls', currentStock: 42, minStock: 15, maxStock: 80, reorderLevel: 25, costPerUnit: 12 },
    { name: 'Paper Towels (Pack)', code: 'PTW', category: 'TOWEL', unit: 'packs', currentStock: 60, minStock: 25, maxStock: 150, reorderLevel: 40, costPerUnit: 8 },
    { name: 'Toilet Cleaner (1L)', code: 'TC1L', category: 'TOILET_CLEANER', unit: 'bottles', currentStock: 5, minStock: 10, maxStock: 40, reorderLevel: 15, costPerUnit: 10 }, // Low stock
    { name: 'Tissue Paper (Pack)', code: 'TSP', category: 'TISSUE', unit: 'packs', currentStock: 80, minStock: 30, maxStock: 200, reorderLevel: 50, costPerUnit: 15 },
  ];

  const inventoryItems: any[] = [];
  for (const invData of inventoryData) {
    const item = await prisma.housekeepingInventory.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: invData.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: invData.name,
        code: invData.code,
        category: invData.category as any,
        unit: invData.unit,
        currentStock: invData.currentStock,
        minStock: invData.minStock,
        maxStock: invData.maxStock,
        reorderLevel: invData.reorderLevel,
        costPerUnit: invData.costPerUnit,
        isActive: true,
      },
    });
    inventoryItems.push(item);
  }

  console.log(`Created ${inventoryItems.length} inventory items`);

  // Create some inventory usage records
  for (let i = 0; i < 15; i++) {
    const item = inventoryItems[i % inventoryItems.length];
    const task = tasks[Math.floor(Math.random() * tasks.length)];

    await prisma.inventoryUsage.create({
      data: {
        inventoryId: item.id,
        taskId: task.id,
        quantity: Math.floor(Math.random() * 3) + 1,
        usedBy: employees.find((e: any) => e.designation.includes('Housekeeping'))?.id || employees[0].id,
        notes: `Used for housekeeping task`,
      },
    });
  }

  console.log('Created inventory usage records');

  // Create Quality Audits
  const auditData = [
    { zoneIndex: 0, score: 9.5, status: 'COMPLETED', findings: ['Excellent cleanliness maintained'] },
    { zoneIndex: 1, score: 8.8, status: 'COMPLETED', findings: ['Good overall', 'Minor dust on equipment'] },
    { zoneIndex: 2, score: 9.8, status: 'COMPLETED', findings: ['OT maintained to highest standards'] },
    { zoneIndex: 4, score: 7.2, status: 'REQUIRES_ACTION', findings: ['Floor not properly mopped', 'Trash bins overflow'] },
    { zoneIndex: 5, score: 8.5, status: 'COMPLETED', findings: ['Satisfactory', 'Improve ventilation cleaning'] },
    { zoneIndex: 10, score: 6.5, status: 'REQUIRES_ACTION', findings: ['Lobby needs deep cleaning', 'Stains on floor'] },
    { zoneIndex: 14, score: 9.0, status: 'COMPLETED', findings: ['Restroom well maintained'] },
    { zoneIndex: 11, score: 7.8, status: 'COMPLETED', findings: ['Cafeteria clean', 'Tables need more frequent wiping'] },
  ];

  for (const audit of auditData) {
    const auditDate = new Date();
    auditDate.setDate(auditDate.getDate() - Math.floor(Math.random() * 14));

    await prisma.qualityAudit.create({
      data: {
        hospitalId: hospital.id,
        zoneId: zones[audit.zoneIndex].id,
        auditorId: employees.find((e: any) => e.designation === 'Housekeeping Supervisor')?.id || employees[0].id,
        auditType: 'ROUTINE',
        auditDate,
        overallScore: audit.score,
        cleanlinessScore: Math.round(audit.score),
        sanitizationScore: Math.round(audit.score),
        organizationScore: Math.round(audit.score),
        safetyScore: Math.round(audit.score),
        status: audit.status as any,
        findings: audit.findings,
        recommendations: audit.status === 'REQUIRES_ACTION' ? ['Schedule immediate re-cleaning', 'Follow-up inspection required'] : ['Continue current standards'],
        resolvedAt: audit.status !== 'REQUIRES_ACTION' ? new Date() : null,
        resolvedBy: audit.status !== 'REQUIRES_ACTION' ? housekeepingManagerUser.id : null,
      },
    });
  }

  console.log(`Created ${auditData.length} quality audits`);

  // Create Cleaning Schedules
  const schedulesData = [
    { zoneIndex: 0, taskType: 'ROUTINE_CLEANING', frequency: 'DAILY', scheduledTime: '06:00' },
    { zoneIndex: 1, taskType: 'ROUTINE_CLEANING', frequency: 'TWICE_DAILY', scheduledTime: '06:00' },
    { zoneIndex: 2, taskType: 'INFECTION_CONTROL', frequency: 'DAILY', scheduledTime: '00:00' },
    { zoneIndex: 4, taskType: 'ROUTINE_CLEANING', frequency: 'DAILY', scheduledTime: '07:00' },
    { zoneIndex: 5, taskType: 'ROUTINE_CLEANING', frequency: 'DAILY', scheduledTime: '07:00' },
    { zoneIndex: 10, taskType: 'ROUTINE_CLEANING', frequency: 'TWICE_DAILY', scheduledTime: '06:00' },
    { zoneIndex: 11, taskType: 'ROUTINE_CLEANING', frequency: 'DAILY', scheduledTime: '06:00' },
    { zoneIndex: 12, taskType: 'ROUTINE_CLEANING', frequency: 'TWICE_DAILY', scheduledTime: '08:00' },
    { zoneIndex: 14, taskType: 'SANITIZATION', frequency: 'HOURLY', scheduledTime: '06:00' },
    { zoneIndex: 15, taskType: 'SANITIZATION', frequency: 'HOURLY', scheduledTime: '06:00' },
    { zoneIndex: 4, taskType: 'DEEP_CLEANING', frequency: 'WEEKLY', scheduledTime: '05:00', dayOfWeek: 'SUNDAY' },
    { zoneIndex: 5, taskType: 'DEEP_CLEANING', frequency: 'WEEKLY', scheduledTime: '05:00', dayOfWeek: 'SUNDAY' },
    { zoneIndex: 18, taskType: 'ROUTINE_CLEANING', frequency: 'DAILY', scheduledTime: '06:00' },
  ];

  for (const schedule of schedulesData) {
    await prisma.cleaningSchedule.create({
      data: {
        hospitalId: hospital.id,
        zoneId: zones[schedule.zoneIndex].id,
        taskType: schedule.taskType as any,
        frequency: schedule.frequency as any,
        dayOfWeek: schedule.dayOfWeek ? schedule.dayOfWeek as DayOfWeek : null,
        scheduledTime: schedule.scheduledTime,
        isActive: true,
      },
    });
  }

  console.log(`Created ${schedulesData.length} cleaning schedules`);

  // ==================== BLOOD BANK MODULE ====================
  console.log('\nSeeding Blood Bank data...');

  // Create Blood Donors
  const bloodDonorsData = [
    {
      firstName: 'John', lastName: 'Anderson', dateOfBirth: new Date('1985-03-15'), gender: 'MALE',
      bloodGroup: 'O_POSITIVE', rhFactor: 'POSITIVE', phone: '+1-555-111-0001', email: 'john.anderson@email.com',
      address: '123 Oak Street', city: 'New York', weight: 80.5, hemoglobin: 15.2, totalDonations: 12,
      lastDonationDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
    },
    {
      firstName: 'Sarah', lastName: 'Williams', dateOfBirth: new Date('1990-07-22'), gender: 'FEMALE',
      bloodGroup: 'A_POSITIVE', rhFactor: 'POSITIVE', phone: '+1-555-111-0002', email: 'sarah.williams@email.com',
      address: '456 Maple Avenue', city: 'New York', weight: 65.0, hemoglobin: 13.5, totalDonations: 8,
      lastDonationDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
    {
      firstName: 'Michael', lastName: 'Brown', dateOfBirth: new Date('1978-11-08'), gender: 'MALE',
      bloodGroup: 'B_NEGATIVE', rhFactor: 'NEGATIVE', phone: '+1-555-111-0003', email: 'michael.brown@email.com',
      address: '789 Pine Road', city: 'Brooklyn', weight: 90.2, hemoglobin: 16.0, totalDonations: 25,
      lastDonationDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    },
    {
      firstName: 'Emily', lastName: 'Davis', dateOfBirth: new Date('1995-02-28'), gender: 'FEMALE',
      bloodGroup: 'AB_POSITIVE', rhFactor: 'POSITIVE', phone: '+1-555-111-0004', email: 'emily.davis@email.com',
      address: '321 Elm Street', city: 'Queens', weight: 58.0, hemoglobin: 12.8, totalDonations: 5,
      lastDonationDate: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
    },
    {
      firstName: 'David', lastName: 'Martinez', dateOfBirth: new Date('1982-09-14'), gender: 'MALE',
      bloodGroup: 'O_NEGATIVE', rhFactor: 'NEGATIVE', phone: '+1-555-111-0005', email: 'david.martinez@email.com',
      address: '654 Cedar Lane', city: 'Manhattan', weight: 75.5, hemoglobin: 14.8, totalDonations: 30,
      lastDonationDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
    {
      firstName: 'Jennifer', lastName: 'Garcia', dateOfBirth: new Date('1988-05-03'), gender: 'FEMALE',
      bloodGroup: 'A_NEGATIVE', rhFactor: 'NEGATIVE', phone: '+1-555-111-0006', email: 'jennifer.garcia@email.com',
      address: '987 Birch Drive', city: 'Bronx', weight: 62.0, hemoglobin: 13.2, totalDonations: 15,
      lastDonationDate: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000),
    },
    {
      firstName: 'Robert', lastName: 'Taylor', dateOfBirth: new Date('1975-12-20'), gender: 'MALE',
      bloodGroup: 'B_POSITIVE', rhFactor: 'POSITIVE', phone: '+1-555-111-0007', email: 'robert.taylor@email.com',
      address: '147 Walnut Street', city: 'Staten Island', weight: 85.0, hemoglobin: 15.5, totalDonations: 40,
      lastDonationDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
    },
    {
      firstName: 'Lisa', lastName: 'Wilson', dateOfBirth: new Date('1992-08-17'), gender: 'FEMALE',
      bloodGroup: 'AB_NEGATIVE', rhFactor: 'NEGATIVE', phone: '+1-555-111-0008', email: 'lisa.wilson@email.com',
      address: '258 Spruce Court', city: 'New York', weight: 55.0, hemoglobin: 12.5, totalDonations: 3,
      lastDonationDate: new Date(Date.now() - 130 * 24 * 60 * 60 * 1000),
    },
  ];

  const bloodDonors = [];
  for (let i = 0; i < bloodDonorsData.length; i++) {
    const donor = bloodDonorsData[i];
    const createdDonor = await prisma.bloodDonor.create({
      data: {
        hospitalId: hospital.id,
        donorId: `BD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        firstName: donor.firstName,
        lastName: donor.lastName,
        dateOfBirth: donor.dateOfBirth,
        gender: donor.gender as any,
        bloodGroup: donor.bloodGroup as any,
        rhFactor: donor.rhFactor as any,
        phone: donor.phone,
        email: donor.email,
        address: donor.address,
        city: donor.city,
        weight: donor.weight,
        hemoglobin: donor.hemoglobin,
        lastDonationDate: donor.lastDonationDate,
        totalDonations: donor.totalDonations,
        isEligible: true,
      },
    });
    bloodDonors.push(createdDonor);
  }
  console.log(`Created ${bloodDonors.length} blood donors`);

  // Create Blood Donations
  const bloodDonations = [];
  for (let i = 0; i < 15; i++) {
    const donor = bloodDonors[i % bloodDonors.length];
    const donationDate = new Date(Date.now() - (i * 15 + Math.random() * 10) * 24 * 60 * 60 * 1000);

    const donation = await prisma.bloodDonation.create({
      data: {
        hospitalId: hospital.id,
        donationNumber: `DON-${donationDate.getFullYear()}${String(donationDate.getMonth() + 1).padStart(2, '0')}${String(donationDate.getDate()).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        donorId: donor.id,
        donationDate,
        donationType: ['WHOLE_BLOOD', 'PLASMA', 'PLATELETS'][Math.floor(Math.random() * 3)] as any,
        bagNumber: `BAG-${Date.now()}-${String(i + 1).padStart(4, '0')}`,
        volumeCollected: 450 + Math.floor(Math.random() * 50),
        collectedBy: 'Blood Bank Technician',
        hemoglobinLevel: 12.5 + Math.random() * 3,
        bloodPressureSys: 110 + Math.floor(Math.random() * 20),
        bloodPressureDia: 70 + Math.floor(Math.random() * 15),
        pulseRate: 60 + Math.floor(Math.random() * 20),
        temperature: 98.2 + Math.random() * 0.6,
        testingStatus: i < 12 ? 'COMPLETED' : 'PENDING',
        hivTest: i < 12 ? 'NEGATIVE' : null,
        hbvTest: i < 12 ? 'NEGATIVE' : null,
        hcvTest: i < 12 ? 'NEGATIVE' : null,
        syphilisTest: i < 12 ? 'NEGATIVE' : null,
        malariaTest: i < 12 ? 'NEGATIVE' : null,
        testedAt: i < 12 ? new Date(donationDate.getTime() + 24 * 60 * 60 * 1000) : null,
        testedBy: i < 12 ? 'Lab Technician' : null,
        isProcessed: i < 10,
        processedAt: i < 10 ? new Date(donationDate.getTime() + 48 * 60 * 60 * 1000) : null,
        processedBy: i < 10 ? 'Processing Technician' : null,
      },
    });
    bloodDonations.push(donation);
  }
  console.log(`Created ${bloodDonations.length} blood donations`);

  // Create Blood Components (Inventory)
  const componentTypes = ['PACKED_RED_CELLS', 'FRESH_FROZEN_PLASMA', 'PLATELET_CONCENTRATE', 'WHOLE_BLOOD', 'CRYOPRECIPITATE'];
  const storageLocations = ['Refrigerator A1', 'Refrigerator A2', 'Freezer B1', 'Platelet Agitator C1'];
  const bloodComponents = [];

  for (let i = 0; i < 40; i++) {
    const donation = bloodDonations[i % bloodDonations.length];
    const donor = bloodDonors.find(d => d.id === donation.donorId)!;
    const componentType = componentTypes[i % componentTypes.length];
    const collectionDate = new Date(Date.now() - (Math.random() * 30) * 24 * 60 * 60 * 1000);

    // Calculate expiry based on component type
    let expiryDays = 35; // Default for RBCs
    if (componentType === 'FRESH_FROZEN_PLASMA') expiryDays = 365;
    else if (componentType === 'PLATELET_CONCENTRATE') expiryDays = 5;
    else if (componentType === 'CRYOPRECIPITATE') expiryDays = 365;
    else if (componentType === 'WHOLE_BLOOD') expiryDays = 21;

    const expiryDate = new Date(collectionDate.getTime() + expiryDays * 24 * 60 * 60 * 1000);
    const isExpired = expiryDate < new Date();
    const status = isExpired ? 'EXPIRED' : (i < 5 ? 'RESERVED' : (i < 8 ? 'ISSUED' : 'AVAILABLE'));

    const component = await prisma.bloodComponent.create({
      data: {
        hospitalId: hospital.id,
        componentId: `COMP-${collectionDate.getFullYear()}${String(collectionDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        donationId: donation.id,
        componentType: componentType as any,
        bloodGroup: donor.bloodGroup as any,
        rhFactor: donor.rhFactor as any,
        volume: componentType === 'PLATELET_CONCENTRATE' ? 50 : (componentType === 'CRYOPRECIPITATE' ? 20 : 250 + Math.floor(Math.random() * 100)),
        bagNumber: `COMP-BAG-${Date.now()}-${String(i + 1).padStart(4, '0')}`,
        storageLocation: storageLocations[Math.floor(Math.random() * storageLocations.length)],
        storageTemp: componentType === 'PLATELET_CONCENTRATE' ? 22.0 : (componentType.includes('PLASMA') || componentType.includes('CRYO') ? -25.0 : 4.0),
        collectionDate,
        expiryDate,
        status: status as any,
        qualityChecked: true,
        qualityScore: 85 + Math.floor(Math.random() * 15),
      },
    });
    bloodComponents.push(component);
  }
  console.log(`Created ${bloodComponents.length} blood components in inventory`);

  // Create Blood Requests
  const bloodRequests = [];
  const indications = ['Surgical procedure', 'Anemia management', 'Trauma', 'Post-partum hemorrhage', 'GI bleeding', 'Cancer treatment'];

  for (let i = 0; i < 10; i++) {
    const patient = patients[i % patients.length];
    const requestDate = new Date(Date.now() - (Math.random() * 14) * 24 * 60 * 60 * 1000);
    const componentType = componentTypes[Math.floor(Math.random() * componentTypes.length)];

    const request = await prisma.bloodRequest.create({
      data: {
        hospitalId: hospital.id,
        requestNumber: `REQ-${requestDate.getFullYear()}${String(requestDate.getMonth() + 1).padStart(2, '0')}${String(requestDate.getDate()).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientBloodGroup: patient.bloodGroup || 'O_POSITIVE',
        patientRhFactor: 'POSITIVE',
        componentType: componentType as any,
        unitsRequired: 1 + Math.floor(Math.random() * 3),
        priority: ['ROUTINE', 'URGENT', 'EMERGENCY'][Math.floor(Math.random() * 3)] as any,
        indication: indications[Math.floor(Math.random() * indications.length)],
        requestedBy: doctors[0].id,
        requestedAt: requestDate,
        department: 'General Medicine',
        crossMatchStatus: i < 7 ? 'COMPATIBLE' : 'PENDING',
        crossMatchedBy: i < 7 ? 'Lab Technician' : null,
        crossMatchedAt: i < 7 ? new Date(requestDate.getTime() + 2 * 60 * 60 * 1000) : null,
        status: i < 5 ? 'FULFILLED' : (i < 7 ? 'APPROVED' : 'PENDING'),
        approvedBy: i < 7 ? doctors[1].id : null,
        approvedAt: i < 7 ? new Date(requestDate.getTime() + 3 * 60 * 60 * 1000) : null,
        unitsFulfilled: i < 5 ? 1 + Math.floor(Math.random() * 2) : 0,
      },
    });
    bloodRequests.push(request);
  }
  console.log(`Created ${bloodRequests.length} blood requests`);

  // Create Blood Transfusions
  const transfusions = [];
  for (let i = 0; i < 5; i++) {
    const request = bloodRequests[i];
    const component = bloodComponents.find(c => c.status === 'ISSUED' || c.status === 'AVAILABLE');
    if (!component) continue;

    const patient = patients.find(p => p.id === request.patientId)!;
    const startTime = new Date(Date.now() - (Math.random() * 7) * 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + (2 + Math.random() * 2) * 60 * 60 * 1000);

    const transfusion = await prisma.bloodTransfusion.create({
      data: {
        hospitalId: hospital.id,
        transfusionNumber: `TRF-${startTime.getFullYear()}${String(startTime.getMonth() + 1).padStart(2, '0')}${String(startTime.getDate()).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        requestId: request.id,
        componentId: component.id,
        patientId: patient.id,
        startTime,
        endTime,
        volumeTransfused: component.volume,
        preBPSys: 110 + Math.floor(Math.random() * 20),
        preBPDia: 70 + Math.floor(Math.random() * 15),
        prePulse: 70 + Math.floor(Math.random() * 15),
        preTemp: 98.2 + Math.random() * 0.6,
        postBPSys: 115 + Math.floor(Math.random() * 15),
        postBPDia: 72 + Math.floor(Math.random() * 12),
        postPulse: 72 + Math.floor(Math.random() * 12),
        postTemp: 98.4 + Math.random() * 0.4,
        administeredBy: nurses[0].id,
        supervisedBy: doctors[0].id,
        hasReaction: i === 2, // One with mild reaction
        reactionType: i === 2 ? 'FEBRILE' : null,
        reactionSeverity: i === 2 ? 'MILD' : null,
        reactionDetails: i === 2 ? 'Patient developed low-grade fever, resolved with antipyretics' : null,
        reactionTime: i === 2 ? new Date(startTime.getTime() + 30 * 60 * 1000) : null,
        actionTaken: i === 2 ? 'Transfusion slowed, acetaminophen administered, symptoms resolved' : null,
        status: 'COMPLETED',
        notes: 'Transfusion completed without significant issues',
      },
    });
    transfusions.push(transfusion);

    // Update component status to TRANSFUSED
    await prisma.bloodComponent.update({
      where: { id: component.id },
      data: { status: 'TRANSFUSED' },
    });
  }
  console.log(`Created ${transfusions.length} blood transfusions`);

  // ==================== TELEMEDICINE MODULE ====================
  console.log('\nSeeding Telemedicine data...');

  // Create Teleconsultation Sessions
  const teleSessionTypes = ['VIDEO_CALL', 'AUDIO_CALL', 'FOLLOW_UP', 'CHAT'];
  const teleComplaints = [
    'Follow-up for diabetes management',
    'Persistent headache for 3 days',
    'Skin rash and itching',
    'Cold symptoms - runny nose and cough',
    'Anxiety and sleep problems',
    'Blood pressure monitoring',
    'Post-surgery follow-up',
    'Medication review',
    'Joint pain and stiffness',
    'Digestive issues',
  ];
  const teleSymptoms = [
    ['fatigue', 'increased thirst', 'frequent urination'],
    ['headache', 'nausea', 'light sensitivity'],
    ['rash', 'itching', 'redness'],
    ['cough', 'runny nose', 'sore throat', 'mild fever'],
    ['anxiety', 'insomnia', 'restlessness'],
    ['dizziness', 'headache'],
    ['pain at surgical site', 'mild swelling'],
    ['no new symptoms'],
    ['joint pain', 'stiffness', 'swelling'],
    ['nausea', 'bloating', 'abdominal discomfort'],
  ];
  const teleDiagnoses = [
    'Type 2 Diabetes Mellitus - well controlled',
    'Tension headache',
    'Contact dermatitis',
    'Upper respiratory tract infection',
    'Generalized anxiety disorder',
    'Essential hypertension - controlled',
    'Post-operative recovery - satisfactory',
    'Medications adjusted as needed',
    'Osteoarthritis of knee',
    'Functional dyspepsia',
  ];

  const telemedicineSessions = [];
  for (let i = 0; i < 20; i++) {
    const patient = patients[i % patients.length];
    const doctor = doctors[i % doctors.length];
    const sessionType = teleSessionTypes[Math.floor(Math.random() * teleSessionTypes.length)];

    // Create sessions across different time periods
    let scheduledStart: Date;
    let status: string;

    if (i < 5) {
      // Completed sessions (past)
      scheduledStart = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
      status = 'COMPLETED';
    } else if (i < 8) {
      // Today's sessions (in progress or completed)
      scheduledStart = new Date();
      scheduledStart.setHours(9 + i, 0, 0, 0);
      status = scheduledStart < new Date() ? 'COMPLETED' : 'SCHEDULED';
    } else if (i < 12) {
      // Upcoming sessions (today or tomorrow)
      scheduledStart = new Date();
      scheduledStart.setDate(scheduledStart.getDate() + (i < 10 ? 0 : 1));
      scheduledStart.setHours(14 + (i % 4), 0, 0, 0);
      status = 'SCHEDULED';
    } else if (i < 15) {
      // No-shows and cancelled
      scheduledStart = new Date(Date.now() - (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000);
      status = i % 2 === 0 ? 'NO_SHOW' : 'CANCELLED';
    } else {
      // Future scheduled sessions
      scheduledStart = new Date();
      scheduledStart.setDate(scheduledStart.getDate() + 2 + Math.floor(Math.random() * 5));
      scheduledStart.setHours(9 + Math.floor(Math.random() * 8), Math.random() > 0.5 ? 30 : 0, 0, 0);
      status = 'SCHEDULED';
    }

    const scheduledEnd = new Date(scheduledStart.getTime() + 30 * 60 * 1000); // 30 min slots
    const complaintIndex = i % teleComplaints.length;

    const session = await prisma.teleconsultationSession.create({
      data: {
        hospitalId: hospital.id,
        sessionId: `TELE-${scheduledStart.getFullYear()}${String(scheduledStart.getMonth() + 1).padStart(2, '0')}${String(scheduledStart.getDate()).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledStart,
        scheduledEnd,
        actualStart: status === 'COMPLETED' ? scheduledStart : undefined,
        actualEnd: status === 'COMPLETED' ? new Date(scheduledStart.getTime() + (20 + Math.random() * 15) * 60 * 1000) : undefined,
        sessionType: sessionType as any,
        platform: 'internal',
        meetingUrl: `https://meet.hospital.com/room/TELE-${i + 1}`,
        meetingId: `MEET-${Date.now()}-${i + 1}`,
        chiefComplaint: teleComplaints[complaintIndex],
        symptoms: teleSymptoms[complaintIndex],
        diagnosis: status === 'COMPLETED' ? teleDiagnoses[complaintIndex] : undefined,
        prescription: status === 'COMPLETED' ? 'See prescription details in medical records' : undefined,
        followUpDate: status === 'COMPLETED' && Math.random() > 0.5 ? new Date(Date.now() + (7 + Math.random() * 14) * 24 * 60 * 60 * 1000) : undefined,
        doctorNotes: status === 'COMPLETED' ? `Patient consulted via ${sessionType.toLowerCase().replace('_', ' ')}. ${teleDiagnoses[complaintIndex]}. Patient advised on treatment plan and lifestyle modifications.` : undefined,
        patientFeedback: status === 'COMPLETED' && Math.random() > 0.3 ? 'Good consultation, doctor was helpful' : undefined,
        rating: status === 'COMPLETED' && Math.random() > 0.3 ? 4 + Math.floor(Math.random() * 2) : undefined,
        connectionQuality: status === 'COMPLETED' ? (['EXCELLENT', 'GOOD', 'FAIR'][Math.floor(Math.random() * 3)] as any) : undefined,
        aiSymptomAnalysis: status === 'COMPLETED' ? {
          urgencyLevel: 'LOW',
          suggestedConditions: [teleDiagnoses[complaintIndex]],
          recommendedTests: [],
        } : undefined,
        aiTriageSuggestion: ['COMPLETED', 'SCHEDULED'].includes(status) ? 'Suitable for telemedicine consultation' : undefined,
        status: status as any,
        cancellationReason: status === 'CANCELLED' ? 'Patient requested reschedule' : undefined,
      },
    });
    telemedicineSessions.push(session);
  }
  console.log(`Created ${telemedicineSessions.length} telemedicine sessions`);

  console.log('\n========================================');
  console.log('Database seeding completed successfully!');
  console.log('========================================');
  console.log('\nLogin credentials (password: password123):');
  console.log('Admin:          admin@hospital.com');
  console.log('Doctor:         dr.smith@hospital.com');
  console.log('Nurse:          nurse.miller@hospital.com');
  console.log('Lab Technician: lab.tech@hospital.com');
  console.log('Pharmacist:     pharmacist@hospital.com');
  console.log('Radiologist:    radiologist@hospital.com');
  console.log('Accountant:     accountant@hospital.com');
  console.log('Receptionist:   receptionist@hospital.com');
  console.log('HR Manager:     hr.manager@hospital.com');
  console.log('HR Staff:       hr.staff@hospital.com');
  console.log('Housekeeping:   housekeeping.manager@hospital.com');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
