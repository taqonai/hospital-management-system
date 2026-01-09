import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding production database...');

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
  const departmentsData = [
    { name: 'Cardiology', code: 'CARD', description: 'Heart and cardiovascular care', floor: '3rd Floor', phone: '+1-555-123-4568' },
    { name: 'Neurology', code: 'NEUR', description: 'Brain and nervous system care', floor: '4th Floor', phone: '+1-555-123-4569' },
    { name: 'Orthopedics', code: 'ORTH', description: 'Bone and joint care', floor: '2nd Floor', phone: '+1-555-123-4570' },
    { name: 'Pediatrics', code: 'PEDI', description: 'Child healthcare', floor: '5th Floor', phone: '+1-555-123-4571' },
    { name: 'General Medicine', code: 'GENM', description: 'General healthcare services', floor: '1st Floor', phone: '+1-555-123-4572' },
    { name: 'Emergency', code: 'EMER', description: 'Emergency and trauma care', floor: 'Ground Floor', phone: '+1-555-123-4573' },
    { name: 'Surgery', code: 'SURG', description: 'Surgical services', floor: '6th Floor', phone: '+1-555-123-4574' },
    { name: 'Radiology', code: 'RADI', description: 'Diagnostic imaging', floor: 'Ground Floor', phone: '+1-555-123-4575' },
    { name: 'Pathology', code: 'PATH', description: 'Laboratory services', floor: 'Ground Floor', phone: '+1-555-123-4576' },
    { name: 'Pharmacy', code: 'PHAR', description: 'Medication dispensing', floor: 'Ground Floor', phone: '+1-555-123-4577' },
  ];

  const departments = await Promise.all(
    departmentsData.map((dept) =>
      prisma.department.upsert({
        where: { hospitalId_code: { hospitalId: hospital.id, code: dept.code } },
        update: {},
        create: { hospitalId: hospital.id, ...dept },
      })
    )
  );

  console.log(`Created ${departments.length} departments`);

  // Create Admin User
  const adminPassword = await bcrypt.hash('MedInt2026SecureAdmin', 12);
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

  // Create HR Manager
  const hrPassword = await bcrypt.hash('MedInt2026HRManager', 12);
  const hrUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'hr.manager@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'hr.manager@hospital.com',
      password: hrPassword,
      firstName: 'HR',
      lastName: 'Manager',
      phone: '+1-555-100-0002',
      role: UserRole.HR_MANAGER,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`Created HR user: ${hrUser.email}`);

  // Create Receptionist User
  const receptionistPassword = await bcrypt.hash('password123', 12);
  const receptionistUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'receptionist@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'receptionist@hospital.com',
      password: receptionistPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      phone: '+1-555-100-0003',
      role: UserRole.RECEPTIONIST,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`Created receptionist user: ${receptionistUser.email}`);

  // Create Nurse Users
  const nursePassword = await bcrypt.hash('password123', 12);
  const nursesData = [
    { email: 'nurse.miller@hospital.com', firstName: 'Nancy', lastName: 'Miller', phone: '+1-555-100-0004' },
    { email: 'nurse.moore@hospital.com', firstName: 'Helen', lastName: 'Moore', phone: '+1-555-100-0005' },
    { email: 'nurse.clark@hospital.com', firstName: 'Patricia', lastName: 'Clark', phone: '+1-555-100-0006' },
  ];

  for (const nurseData of nursesData) {
    const nurseUser = await prisma.user.upsert({
      where: {
        hospitalId_email: { hospitalId: hospital.id, email: nurseData.email },
      },
      update: {},
      create: {
        hospitalId: hospital.id,
        email: nurseData.email,
        password: nursePassword,
        firstName: nurseData.firstName,
        lastName: nurseData.lastName,
        phone: nurseData.phone,
        role: UserRole.NURSE,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`Created nurse user: ${nurseUser.email}`);
  }

  // Create Lab Technician User
  const labTechPassword = await bcrypt.hash('password123', 12);
  const labTechUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'labtech@hospital.com' },
    },
    update: {},
    create: {
      hospitalId: hospital.id,
      email: 'labtech@hospital.com',
      password: labTechPassword,
      firstName: 'James',
      lastName: 'Wilson',
      phone: '+1-555-100-0007',
      role: UserRole.LAB_TECHNICIAN,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`Created lab technician user: ${labTechUser.email}`);

  // Create Lab Tests Catalog
  const labTestsData = [
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

  for (const test of labTestsData) {
    await prisma.labTest.upsert({
      where: { code: test.code },
      update: {},
      create: test,
    });
  }

  console.log(`Created ${labTestsData.length} lab tests`);

  // Create Drugs Catalog
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

  for (const drug of drugsData) {
    await prisma.drug.upsert({
      where: { code: drug.code },
      update: {},
      create: drug,
    });
  }

  console.log(`Created ${drugsData.length} drugs`);

  // Create Wards
  const wardsData = [
    { name: 'General Ward A', floor: 1, capacity: 30, type: 'GENERAL' as const },
    { name: 'General Ward B', floor: 2, capacity: 30, type: 'GENERAL' as const },
    { name: 'ICU', floor: 3, capacity: 15, type: 'ICU' as const },
    { name: 'CCU', floor: 3, capacity: 12, type: 'CCU' as const },
    { name: 'Private Ward', floor: 4, capacity: 20, type: 'PRIVATE' as const },
    { name: 'Pediatric Ward', floor: 5, capacity: 25, type: 'GENERAL' as const },
  ];

  const wards: any[] = [];
  for (const ward of wardsData) {
    const existingWard = await prisma.ward.findFirst({
      where: { name: ward.name },
    });

    if (existingWard) {
      wards.push(existingWard);
    } else {
      const createdWard = await prisma.ward.create({
        data: ward,
      });
      wards.push(createdWard);
    }
  }

  console.log(`Created ${wards.length} wards`);

  // Create Beds for each ward
  const generalDept = departments.find(d => d.code === 'GENM');
  let totalBeds = 0;

  for (const ward of wards) {
    const bedCount = Math.min(ward.capacity, 5); // Create just 5 beds per ward for demo
    for (let i = 1; i <= bedCount; i++) {
      const bedNumber = `${ward.name.substring(0, 3).toUpperCase()}-${i.toString().padStart(2, '0')}`;
      const existingBed = await prisma.bed.findFirst({
        where: { hospitalId: hospital.id, bedNumber },
      });

      if (!existingBed && generalDept) {
        await prisma.bed.create({
          data: {
            hospitalId: hospital.id,
            departmentId: generalDept.id,
            wardId: ward.id,
            bedNumber,
            bedType: ward.type === 'ICU' || ward.type === 'CCU' ? 'ICU' : 'STANDARD',
            status: 'AVAILABLE',
            dailyRate: ward.type === 'PRIVATE' ? 500 : ward.type === 'ICU' ? 1500 : 200,
          },
        });
        totalBeds++;
      }
    }
  }

  console.log(`Created ${totalBeds} beds`);

  // Create Leave Types
  const leaveTypesData = [
    { name: 'Annual Leave', code: 'AL', description: 'Paid annual vacation', defaultDays: 21, isPaid: true, requiresApproval: true, carryForward: true, maxCarryForward: 5 },
    { name: 'Sick Leave', code: 'SL', description: 'Medical leave for illness', defaultDays: 15, isPaid: true, requiresApproval: true },
    { name: 'Casual Leave', code: 'CL', description: 'Personal time off', defaultDays: 10, isPaid: true, requiresApproval: true },
    { name: 'Maternity Leave', code: 'ML', description: 'Leave for new mothers', defaultDays: 90, isPaid: true, requiresApproval: true },
    { name: 'Paternity Leave', code: 'PL', description: 'Leave for new fathers', defaultDays: 14, isPaid: true, requiresApproval: true },
  ];

  for (const leaveType of leaveTypesData) {
    await prisma.leaveType.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: leaveType.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        ...leaveType,
      },
    });
  }

  console.log(`Created ${leaveTypesData.length} leave types`);

  // Create Shifts
  const shiftsData = [
    { name: 'Morning Shift', code: 'MS', startTime: '07:00', endTime: '15:00', workingHours: 8.0, isNightShift: false },
    { name: 'Evening Shift', code: 'ES', startTime: '15:00', endTime: '23:00', workingHours: 8.0, isNightShift: false },
    { name: 'Night Shift', code: 'NS', startTime: '23:00', endTime: '07:00', workingHours: 8.0, isNightShift: true },
    { name: 'Day Shift', code: 'DS', startTime: '09:00', endTime: '17:00', workingHours: 8.0, isNightShift: false },
  ];

  for (const shift of shiftsData) {
    await prisma.shift.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: shift.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        ...shift,
      },
    });
  }

  console.log(`Created ${shiftsData.length} shifts`);

  // Create Housekeeping Zones
  const zonesData = [
    { name: 'Emergency Department', code: 'ZONE-ED', floor: 'Ground Floor', roomCount: 20 },
    { name: 'Operating Theaters', code: 'ZONE-OT', floor: '6th Floor', roomCount: 8 },
    { name: 'ICU', code: 'ZONE-ICU', floor: '3rd Floor', roomCount: 15 },
    { name: 'General Wards', code: 'ZONE-GW', floor: '1st-2nd Floor', roomCount: 60 },
    { name: 'Outpatient Area', code: 'ZONE-OPD', floor: 'Ground Floor', roomCount: 30 },
    { name: 'Reception & Lobby', code: 'ZONE-LOBBY', floor: 'Ground Floor', roomCount: 5 },
  ];

  for (const zone of zonesData) {
    await prisma.housekeepingZone.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: zone.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        ...zone,
      },
    });
  }

  console.log(`Created ${zonesData.length} housekeeping zones`);

  // Create sample employees for HR
  const employeesData = [
    { firstName: 'John', lastName: 'Smith', email: 'john.smith@hospital.com', employeeCode: 'EMP001', designation: 'Senior Nurse', department: 'GENM' },
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@hospital.com', employeeCode: 'EMP002', designation: 'Staff Nurse', department: 'CARD' },
    { firstName: 'Michael', lastName: 'Brown', email: 'michael.brown@hospital.com', employeeCode: 'EMP003', designation: 'Lab Technician', department: 'PATH' },
    { firstName: 'Emily', lastName: 'Davis', email: 'emily.davis@hospital.com', employeeCode: 'EMP004', designation: 'Pharmacist', department: 'PHAR' },
    { firstName: 'David', lastName: 'Wilson', email: 'david.wilson@hospital.com', employeeCode: 'EMP005', designation: 'Radiologist', department: 'RADI' },
  ];

  for (const emp of employeesData) {
    const dept = departments.find(d => d.code === emp.department);
    if (dept) {
      const existingEmp = await prisma.employee.findFirst({
        where: { hospitalId: hospital.id, employeeCode: emp.employeeCode },
      });

      if (!existingEmp) {
        await prisma.employee.create({
          data: {
            hospitalId: hospital.id,
            departmentId: dept.id,
            employeeCode: emp.employeeCode,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            phone: '+1-555-200-000' + emp.employeeCode.slice(-1),
            dateOfBirth: new Date('1990-01-15'),
            gender: 'MALE',
            address: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            designation: emp.designation,
            employeeType: 'FULL_TIME',
            employmentStatus: 'ACTIVE',
            joiningDate: new Date('2024-01-15'),
            basicSalary: 50000 + Math.random() * 30000,
          },
        });
      }
    }
  }

  console.log(`Created ${employeesData.length} employees`);

  console.log('\n✅ Production database seeded successfully!');
  console.log('-------------------------------------------');
  console.log(`Hospital: ${hospital.name}`);
  console.log(`Admin Email: admin@hospital.com`);
  console.log(`Admin Password: MedInt2026SecureAdmin`);
  console.log(`HR Email: hr.manager@hospital.com`);
  console.log(`HR Password: MedInt2026HRManager`);
  console.log('-------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
