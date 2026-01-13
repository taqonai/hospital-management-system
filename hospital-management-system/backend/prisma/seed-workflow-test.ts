import { PrismaClient, UserRole, Gender, BloodGroup } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Workflow Test Seed
 *
 * This script sets up test users and data for testing the updated appointment workflow:
 * Patient -> Front Desk (Check-in) -> Nurse (Vitals) -> Doctor (Diagnosis)
 *
 * Run with: npx ts-node prisma/seed-workflow-test.ts
 */

async function main() {
  console.log('='.repeat(60));
  console.log('Setting up Workflow Test Data');
  console.log('='.repeat(60));

  // Get existing hospital
  const hospital = await prisma.hospital.findFirst();
  if (!hospital) {
    console.error('No hospital found. Please run the main seed first.');
    process.exit(1);
  }

  console.log(`Using hospital: ${hospital.name} (${hospital.id})`);

  const password = await bcrypt.hash('password123', 12);

  // ============================================================
  // 1. CREATE/UPDATE FRONT DESK (RECEPTIONIST) USERS
  // ============================================================
  console.log('\n--- Creating Front Desk (Receptionist) Users ---');

  const receptionistsData = [
    { email: 'receptionist@hospital.com', firstName: 'Sarah', lastName: 'Johnson', phone: '+1-555-100-0010' },
    { email: 'frontdesk@hospital.com', firstName: 'Maria', lastName: 'Garcia', phone: '+1-555-100-0011' },
    { email: 'frontdesk2@hospital.com', firstName: 'David', lastName: 'Chen', phone: '+1-555-100-0012' },
  ];

  for (const data of receptionistsData) {
    const user = await prisma.user.upsert({
      where: {
        hospitalId_email: { hospitalId: hospital.id, email: data.email },
      },
      update: {
        password,
        role: UserRole.RECEPTIONIST,
        isActive: true,
      },
      create: {
        hospitalId: hospital.id,
        email: data.email,
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: UserRole.RECEPTIONIST,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`  [RECEPTIONIST] ${user.email} - ${user.firstName} ${user.lastName}`);
  }

  // ============================================================
  // 2. CREATE/UPDATE NURSE USERS
  // ============================================================
  console.log('\n--- Creating Nurse Users ---');

  const nursesData = [
    { email: 'nurse.miller@hospital.com', firstName: 'Nancy', lastName: 'Miller', phone: '+1-555-100-0020' },
    { email: 'nurse.moore@hospital.com', firstName: 'Helen', lastName: 'Moore', phone: '+1-555-100-0021' },
    { email: 'nurse.clark@hospital.com', firstName: 'Patricia', lastName: 'Clark', phone: '+1-555-100-0022' },
  ];

  for (const data of nursesData) {
    const user = await prisma.user.upsert({
      where: {
        hospitalId_email: { hospitalId: hospital.id, email: data.email },
      },
      update: {
        password,
        role: UserRole.NURSE,
        isActive: true,
      },
      create: {
        hospitalId: hospital.id,
        email: data.email,
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: UserRole.NURSE,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`  [NURSE] ${user.email} - ${user.firstName} ${user.lastName}`);
  }

  // ============================================================
  // 3. CREATE/UPDATE DOCTOR USERS
  // ============================================================
  console.log('\n--- Creating Doctor Users ---');

  // Get General Medicine department
  const genMedDept = await prisma.department.findFirst({
    where: { hospitalId: hospital.id, code: 'GENM' },
  });

  const cardiologyDept = await prisma.department.findFirst({
    where: { hospitalId: hospital.id, code: 'CARD' },
  });

  if (!genMedDept) {
    console.error('General Medicine department not found. Please run the main seed first.');
    process.exit(1);
  }

  const doctorsData = [
    { email: 'dr.johnson@hospital.com', firstName: 'Robert', lastName: 'Johnson', specialization: 'General Medicine', departmentId: genMedDept.id },
    { email: 'dr.smith@hospital.com', firstName: 'Emily', lastName: 'Smith', specialization: 'General Medicine', departmentId: genMedDept.id },
    { email: 'dr.cardio@hospital.com', firstName: 'Michael', lastName: 'Heart', specialization: 'Cardiology', departmentId: cardiologyDept?.id || genMedDept.id },
  ];

  for (const data of doctorsData) {
    // Create user first
    const user = await prisma.user.upsert({
      where: {
        hospitalId_email: { hospitalId: hospital.id, email: data.email },
      },
      update: {
        password,
        role: UserRole.DOCTOR,
        isActive: true,
      },
      create: {
        hospitalId: hospital.id,
        email: data.email,
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: '+1-555-100-003' + doctorsData.indexOf(data),
        role: UserRole.DOCTOR,
        isActive: true,
        isEmailVerified: true,
      },
    });

    // Create or update doctor profile
    const existingDoctor = await prisma.doctor.findFirst({
      where: { userId: user.id },
    });

    if (!existingDoctor) {
      await prisma.doctor.create({
        data: {
          user: { connect: { id: user.id } },
          department: { connect: { id: data.departmentId } },
          specialization: data.specialization,
          qualification: 'MD',
          licenseNumber: `LIC-${data.firstName.toUpperCase()}-2024`,
          consultationFee: 100,
          slotDuration: 15,
          isAvailable: true,
        },
      });
    }

    console.log(`  [DOCTOR] ${user.email} - Dr. ${user.firstName} ${user.lastName} (${data.specialization})`);
  }

  // ============================================================
  // 4. CREATE TEST PATIENTS
  // ============================================================
  console.log('\n--- Creating Test Patients ---');

  const patientsData = [
    { firstName: 'John', lastName: 'Doe', mrn: 'PAT-TEST-001', phone: '+1-555-200-0001', email: 'john.doe@email.com', dateOfBirth: new Date('1985-03-15'), gender: Gender.MALE, bloodGroup: BloodGroup.A_POSITIVE },
    { firstName: 'Jane', lastName: 'Smith', mrn: 'PAT-TEST-002', phone: '+1-555-200-0002', email: 'jane.smith@email.com', dateOfBirth: new Date('1990-07-22'), gender: Gender.FEMALE, bloodGroup: BloodGroup.O_NEGATIVE },
    { firstName: 'Bob', lastName: 'Wilson', mrn: 'PAT-TEST-003', phone: '+1-555-200-0003', email: 'bob.wilson@email.com', dateOfBirth: new Date('1978-11-08'), gender: Gender.MALE, bloodGroup: BloodGroup.B_POSITIVE },
  ];

  const patients: any[] = [];
  for (const data of patientsData) {
    const patient = await prisma.patient.upsert({
      where: { hospitalId_mrn: { hospitalId: hospital.id, mrn: data.mrn } },
      update: {},
      create: {
        hospital: { connect: { id: hospital.id } },
        firstName: data.firstName,
        lastName: data.lastName,
        mrn: data.mrn,
        phone: data.phone,
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        address: '123 Test Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
      },
    });
    patients.push(patient);
    console.log(`  [PATIENT] ${patient.mrn} - ${patient.firstName} ${patient.lastName}`);
  }

  // ============================================================
  // 5. CREATE PATIENT PORTAL USER
  // ============================================================
  console.log('\n--- Creating Patient Portal User ---');

  // Link a patient to a user account for patient portal testing
  const portalPatient = patients[0];
  const portalUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'patient@test.com' },
    },
    update: {
      password,
      patient: { connect: { id: portalPatient.id } },
    },
    create: {
      hospital: { connect: { id: hospital.id } },
      email: 'patient@test.com',
      password,
      firstName: portalPatient.firstName,
      lastName: portalPatient.lastName,
      phone: portalPatient.phone,
      role: UserRole.PATIENT,
      patient: { connect: { id: portalPatient.id } },
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`  [PATIENT PORTAL] ${portalUser.email} - linked to ${portalPatient.mrn}`);

  // ============================================================
  // 6. CLEAR OLD APPOINTMENTS
  // ============================================================
  console.log('\n--- Clearing Old Appointments ---');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Delete today's appointments for a clean test
  const deletedAppointments = await prisma.appointment.deleteMany({
    where: {
      hospitalId: hospital.id,
      appointmentDate: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });
  console.log(`  Deleted ${deletedAppointments.count} appointments from today`);

  // ============================================================
  // 7. CREATE TEST APPOINTMENTS FOR TODAY
  // ============================================================
  console.log('\n--- Creating Test Appointments ---');

  const doctor = await prisma.doctor.findFirst({
    where: {
      user: { email: 'dr.johnson@hospital.com' },
    },
  });

  if (doctor) {
    const appointmentsData = [
      { patient: patients[0], status: 'SCHEDULED', startTime: '09:00', endTime: '09:15', reason: 'General checkup' },
      { patient: patients[1], status: 'SCHEDULED', startTime: '09:15', endTime: '09:30', reason: 'Follow-up visit' },
      { patient: patients[2], status: 'CONFIRMED', startTime: '09:30', endTime: '09:45', reason: 'Headache and fever' },
    ];

    for (let i = 0; i < appointmentsData.length; i++) {
      const apptData = appointmentsData[i];
      const appointment = await prisma.appointment.create({
        data: {
          hospitalId: hospital.id,
          patientId: apptData.patient.id,
          doctorId: doctor.id,
          appointmentDate: today,
          startTime: apptData.startTime,
          endTime: apptData.endTime,
          type: 'CONSULTATION',
          status: apptData.status as any,
          reason: apptData.reason,
        },
      });
      console.log(`  [APPOINTMENT] ${apptData.patient.firstName} ${apptData.patient.lastName} - ${apptData.startTime} (${apptData.status})`);
    }
  }

  // ============================================================
  // 8. UPDATE ADMIN PASSWORD (for easier testing)
  // ============================================================
  console.log('\n--- Updating Admin User ---');

  const adminUser = await prisma.user.upsert({
    where: {
      hospitalId_email: { hospitalId: hospital.id, email: 'admin@hospital.com' },
    },
    update: {
      password, // Use simple password for testing
      role: UserRole.HOSPITAL_ADMIN,
    },
    create: {
      hospitalId: hospital.id,
      email: 'admin@hospital.com',
      password,
      firstName: 'System',
      lastName: 'Admin',
      phone: '+1-555-100-0001',
      role: UserRole.HOSPITAL_ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`  [ADMIN] ${adminUser.email}`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('WORKFLOW TEST DATA SETUP COMPLETE');
  console.log('='.repeat(60));
  console.log('\nTest Credentials (all use password: password123)');
  console.log('-'.repeat(60));
  console.log('');
  console.log('FRONT DESK / RECEPTIONIST (Can: Check-in patients)');
  console.log('  - receptionist@hospital.com');
  console.log('  - frontdesk@hospital.com');
  console.log('  - frontdesk2@hospital.com');
  console.log('');
  console.log('NURSE (Can: Record vitals)');
  console.log('  - nurse.miller@hospital.com');
  console.log('  - nurse.moore@hospital.com');
  console.log('  - nurse.clark@hospital.com');
  console.log('');
  console.log('DOCTOR (Can: View vitals, diagnose, override vitals in emergency)');
  console.log('  - dr.johnson@hospital.com');
  console.log('  - dr.smith@hospital.com');
  console.log('  - dr.cardio@hospital.com');
  console.log('');
  console.log('ADMIN (Can: Everything)');
  console.log('  - admin@hospital.com');
  console.log('');
  console.log('PATIENT PORTAL');
  console.log('  - patient@test.com');
  console.log('');
  console.log('-'.repeat(60));
  console.log('');
  console.log('WORKFLOW TEST STEPS:');
  console.log('1. Login as receptionist@hospital.com -> Go to OPD -> Check-in a patient');
  console.log('2. Login as nurse.miller@hospital.com -> Go to OPD -> Record vitals');
  console.log('3. Login as dr.johnson@hospital.com -> Go to Consultation -> Start diagnosis');
  console.log('');
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('Error setting up workflow test data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
