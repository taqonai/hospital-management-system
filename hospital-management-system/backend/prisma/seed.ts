import { PrismaClient, UserRole, DayOfWeek } from '@prisma/client';
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

  // Create Admin User (with strong password)
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

  // Create Lab Tests Catalog (Master Data)
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
    { name: 'Prothrombin Time (PT)', code: 'PT001', category: 'Coagulation', sampleType: 'Blood', price: 45, turnaroundTime: 2 },
    { name: 'Creatinine', code: 'CREA001', category: 'Chemistry', sampleType: 'Blood', price: 35, turnaroundTime: 4 },
    { name: 'Blood Urea Nitrogen', code: 'BUN001', category: 'Chemistry', sampleType: 'Blood', price: 35, turnaroundTime: 4 },
    { name: 'Electrolyte Panel', code: 'ELEC001', category: 'Chemistry', sampleType: 'Blood', price: 65, turnaroundTime: 4 },
    { name: 'C-Reactive Protein', code: 'CRP001', category: 'Immunology', sampleType: 'Blood', price: 55, turnaroundTime: 6 },
  ];

  for (const test of labTestsData) {
    await prisma.labTest.upsert({
      where: { code: test.code },
      update: {},
      create: test,
    });
  }

  console.log(`Created ${labTestsData.length} lab tests`);

  // Create Drugs Catalog (Master Data)
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
    { name: 'Ciprofloxacin', genericName: 'Ciprofloxacin', code: 'DRUG011', category: 'Antibiotic', dosageForm: 'Tablet', strength: '500mg', price: 20 },
    { name: 'Prednisone', genericName: 'Prednisone', code: 'DRUG012', category: 'Corticosteroid', dosageForm: 'Tablet', strength: '10mg', price: 12 },
    { name: 'Losartan', genericName: 'Losartan', code: 'DRUG013', category: 'ARB', dosageForm: 'Tablet', strength: '50mg', price: 15 },
    { name: 'Pantoprazole', genericName: 'Pantoprazole', code: 'DRUG014', category: 'PPI', dosageForm: 'Tablet', strength: '40mg', price: 18 },
    { name: 'Azithromycin', genericName: 'Azithromycin', code: 'DRUG015', category: 'Antibiotic', dosageForm: 'Tablet', strength: '250mg', price: 25 },
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
    { name: 'General Ward A', code: 'GEN-A', type: 'GENERAL', floor: '1st Floor', capacity: 30 },
    { name: 'General Ward B', code: 'GEN-B', type: 'GENERAL', floor: '2nd Floor', capacity: 30 },
    { name: 'ICU', code: 'ICU', type: 'ICU', floor: '3rd Floor', capacity: 15 },
    { name: 'NICU', code: 'NICU', type: 'NICU', floor: '5th Floor', capacity: 10 },
    { name: 'CCU', code: 'CCU', type: 'CCU', floor: '3rd Floor', capacity: 12 },
    { name: 'Private Ward', code: 'PVT', type: 'PRIVATE', floor: '4th Floor', capacity: 20 },
    { name: 'Pediatric Ward', code: 'PED', type: 'PEDIATRIC', floor: '5th Floor', capacity: 25 },
    { name: 'Maternity Ward', code: 'MAT', type: 'MATERNITY', floor: '6th Floor', capacity: 20 },
  ];

  const wards: any[] = [];
  for (const ward of wardsData) {
    const createdWard = await prisma.ward.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: ward.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: ward.name,
        code: ward.code,
        type: ward.type as any,
        floor: ward.floor,
        capacity: ward.capacity,
        currentOccupancy: 0,
      },
    });
    wards.push(createdWard);
  }

  console.log(`Created ${wards.length} wards`);

  // Create Beds for each ward
  let totalBeds = 0;
  for (const ward of wards) {
    const bedCount = ward.capacity;
    for (let i = 1; i <= bedCount; i++) {
      await prisma.bed.upsert({
        where: {
          wardId_bedNumber: { wardId: ward.id, bedNumber: `${ward.code}-${i.toString().padStart(2, '0')}` },
        },
        update: {},
        create: {
          wardId: ward.id,
          bedNumber: `${ward.code}-${i.toString().padStart(2, '0')}`,
          bedType: ward.type === 'ICU' || ward.type === 'CCU' ? 'ICU' : ward.type === 'PRIVATE' ? 'PRIVATE' : 'STANDARD',
          status: 'AVAILABLE',
          dailyRate: ward.type === 'PRIVATE' ? 500 : ward.type === 'ICU' || ward.type === 'CCU' ? 1500 : 200,
        },
      });
      totalBeds++;
    }
  }

  console.log(`Created ${totalBeds} beds`);

  // Create Leave Types
  const leaveTypesData = [
    { name: 'Annual Leave', code: 'AL', description: 'Paid annual vacation', daysAllowed: 21, isPaid: true, requiresApproval: true, carryForward: true, maxCarryForward: 5 },
    { name: 'Sick Leave', code: 'SL', description: 'Medical leave for illness', daysAllowed: 15, isPaid: true, requiresApproval: true, requiresDocument: true },
    { name: 'Casual Leave', code: 'CL', description: 'Personal time off', daysAllowed: 10, isPaid: true, requiresApproval: true },
    { name: 'Maternity Leave', code: 'ML', description: 'Leave for new mothers', daysAllowed: 90, isPaid: true, requiresApproval: true, requiresDocument: true },
    { name: 'Paternity Leave', code: 'PL', description: 'Leave for new fathers', daysAllowed: 14, isPaid: true, requiresApproval: true, requiresDocument: true },
    { name: 'Unpaid Leave', code: 'UL', description: 'Leave without pay', daysAllowed: 30, isPaid: false, requiresApproval: true },
    { name: 'Bereavement Leave', code: 'BL', description: 'Leave for family bereavement', daysAllowed: 5, isPaid: true, requiresApproval: true },
    { name: 'Study Leave', code: 'STL', description: 'Leave for educational purposes', daysAllowed: 10, isPaid: true, requiresApproval: true },
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
    { name: 'Morning Shift', code: 'MS', startTime: '07:00', endTime: '15:00', breakDuration: 60, isActive: true },
    { name: 'Evening Shift', code: 'ES', startTime: '15:00', endTime: '23:00', breakDuration: 60, isActive: true },
    { name: 'Night Shift', code: 'NS', startTime: '23:00', endTime: '07:00', breakDuration: 60, isActive: true },
    { name: 'Day Shift', code: 'DS', startTime: '09:00', endTime: '17:00', breakDuration: 60, isActive: true },
    { name: 'Split Shift', code: 'SS', startTime: '08:00', endTime: '20:00', breakDuration: 120, isActive: true },
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
    { name: 'Emergency Department', code: 'ZONE-ED', type: 'CLINICAL', floor: 'Ground Floor', cleaningFrequency: 'EVERY_HOUR', priority: 1 },
    { name: 'Operating Theaters', code: 'ZONE-OT', type: 'CLINICAL', floor: '6th Floor', cleaningFrequency: 'BETWEEN_PROCEDURES', priority: 1 },
    { name: 'ICU', code: 'ZONE-ICU', type: 'CLINICAL', floor: '3rd Floor', cleaningFrequency: 'EVERY_2_HOURS', priority: 1 },
    { name: 'General Wards', code: 'ZONE-GW', type: 'CLINICAL', floor: '1st-2nd Floor', cleaningFrequency: 'TWICE_DAILY', priority: 2 },
    { name: 'Outpatient Area', code: 'ZONE-OPD', type: 'CLINICAL', floor: 'Ground Floor', cleaningFrequency: 'TWICE_DAILY', priority: 2 },
    { name: 'Reception & Lobby', code: 'ZONE-LOBBY', type: 'PUBLIC', floor: 'Ground Floor', cleaningFrequency: 'EVERY_4_HOURS', priority: 2 },
    { name: 'Cafeteria', code: 'ZONE-CAF', type: 'PUBLIC', floor: 'Ground Floor', cleaningFrequency: 'AFTER_MEALS', priority: 2 },
    { name: 'Restrooms', code: 'ZONE-REST', type: 'PUBLIC', floor: 'All Floors', cleaningFrequency: 'EVERY_2_HOURS', priority: 1 },
  ];

  for (const zone of zonesData) {
    await prisma.housekeepingZone.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: zone.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: zone.name,
        code: zone.code,
        type: zone.type as any,
        floor: zone.floor,
        priority: zone.priority,
      },
    });
  }

  console.log(`Created ${zonesData.length} housekeeping zones`);

  // Create Quality Indicators
  const qualityIndicatorsData = [
    { name: 'Patient Fall Rate', code: 'QI-FALL', category: 'Patient Safety', targetValue: 2.0, unit: 'per 1000 patient days', frequency: 'MONTHLY' },
    { name: 'Hospital-Acquired Infections', code: 'QI-HAI', category: 'Infection Control', targetValue: 1.0, unit: 'percentage', frequency: 'MONTHLY' },
    { name: 'Medication Errors', code: 'QI-MEDERR', category: 'Medication Safety', targetValue: 0.5, unit: 'per 1000 doses', frequency: 'MONTHLY' },
    { name: 'Readmission Rate (30 days)', code: 'QI-READM', category: 'Care Quality', targetValue: 5.0, unit: 'percentage', frequency: 'MONTHLY' },
    { name: 'Average Length of Stay', code: 'QI-ALOS', category: 'Efficiency', targetValue: 4.5, unit: 'days', frequency: 'MONTHLY' },
    { name: 'Bed Occupancy Rate', code: 'QI-BOR', category: 'Efficiency', targetValue: 85.0, unit: 'percentage', frequency: 'DAILY' },
    { name: 'Patient Satisfaction Score', code: 'QI-PSS', category: 'Patient Experience', targetValue: 90.0, unit: 'percentage', frequency: 'MONTHLY' },
    { name: 'ED Wait Time', code: 'QI-EDWT', category: 'Efficiency', targetValue: 30.0, unit: 'minutes', frequency: 'DAILY' },
  ];

  for (const indicator of qualityIndicatorsData) {
    await prisma.qualityIndicator.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: indicator.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: indicator.name,
        code: indicator.code,
        category: indicator.category,
        targetValue: indicator.targetValue,
        unit: indicator.unit,
        frequency: indicator.frequency as any,
        isActive: true,
      },
    });
  }

  console.log(`Created ${qualityIndicatorsData.length} quality indicators`);

  console.log('\n✅ Production database seeded successfully!');
  console.log('-------------------------------------------');
  console.log(`Hospital: ${hospital.name}`);
  console.log(`Admin Email: admin@hospital.com`);
  console.log(`Admin Password: MedInt2026SecureAdmin`);
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
