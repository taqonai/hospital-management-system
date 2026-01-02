"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
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
    ]);
    console.log(`Created ${departments.length} departments`);
    // Create Admin User
    const adminPassword = await bcryptjs_1.default.hash('password123', 12);
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
            role: client_1.UserRole.HOSPITAL_ADMIN,
            isActive: true,
            isEmailVerified: true,
        },
    });
    console.log(`Created admin user: ${adminUser.email}`);
    // Create Doctor Users and Profiles
    const doctorPassword = await bcryptjs_1.default.hash('password123', 12);
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
    ];
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
                role: client_1.UserRole.DOCTOR,
                isActive: true,
                isEmailVerified: true,
            },
        });
        await prisma.doctor.upsert({
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
        console.log(`Created doctor: Dr. ${doctorData.firstName} ${doctorData.lastName}`);
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
    ];
    for (const test of labTests) {
        await prisma.labTest.upsert({
            where: { code: test.code },
            update: {},
            create: test,
        });
    }
    console.log(`Created ${labTests.length} lab tests`);
    // Create Sample Patients
    const patientsData = [
        { firstName: 'James', lastName: 'Wilson', gender: 'MALE', dateOfBirth: new Date('1985-03-15'), phone: '+1-555-300-0001' },
        { firstName: 'Maria', lastName: 'Garcia', gender: 'FEMALE', dateOfBirth: new Date('1990-07-22'), phone: '+1-555-300-0002' },
        { firstName: 'David', lastName: 'Lee', gender: 'MALE', dateOfBirth: new Date('1978-11-08'), phone: '+1-555-300-0003' },
        { firstName: 'Jennifer', lastName: 'Martinez', gender: 'FEMALE', dateOfBirth: new Date('1995-01-30'), phone: '+1-555-300-0004' },
        { firstName: 'Richard', lastName: 'Anderson', gender: 'MALE', dateOfBirth: new Date('1965-09-12'), phone: '+1-555-300-0005' },
    ];
    for (let i = 0; i < patientsData.length; i++) {
        const patientData = patientsData[i];
        const mrn = `HMS001-${Date.now().toString(36).toUpperCase()}${i}`;
        const patient = await prisma.patient.create({
            data: {
                hospitalId: hospital.id,
                mrn,
                firstName: patientData.firstName,
                lastName: patientData.lastName,
                dateOfBirth: patientData.dateOfBirth,
                gender: patientData.gender,
                phone: patientData.phone,
                address: `${100 + i} Main Street`,
                city: 'New York',
                state: 'NY',
                zipCode: `1000${i}`,
                bloodGroup: ['A_POSITIVE', 'B_POSITIVE', 'O_POSITIVE', 'AB_POSITIVE', 'O_NEGATIVE'][i],
            },
        });
        // Create medical history for each patient
        await prisma.medicalHistory.create({
            data: {
                patientId: patient.id,
                chronicConditions: i % 2 === 0 ? ['Hypertension'] : [],
                pastSurgeries: i === 2 ? ['Appendectomy 2010'] : [],
                familyHistory: ['Diabetes', 'Heart Disease'],
                currentMedications: i % 2 === 0 ? ['Lisinopril 10mg'] : [],
                immunizations: ['Flu Shot 2024', 'COVID-19'],
            },
        });
        console.log(`Created patient: ${patientData.firstName} ${patientData.lastName}`);
    }
    // Create Wards
    const wards = await Promise.all([
        prisma.ward.create({
            data: { name: 'General Ward A', floor: 1, capacity: 20, type: 'GENERAL' },
        }),
        prisma.ward.create({
            data: { name: 'General Ward B', floor: 1, capacity: 20, type: 'GENERAL' },
        }),
        prisma.ward.create({
            data: { name: 'Private Ward', floor: 2, capacity: 10, type: 'PRIVATE' },
        }),
        prisma.ward.create({
            data: { name: 'ICU', floor: 3, capacity: 10, type: 'ICU' },
        }),
    ]);
    // Create Beds
    const wardPrefixes = ['GWA', 'GWB', 'PVT', 'ICU'];
    for (let w = 0; w < wards.length; w++) {
        const ward = wards[w];
        const bedCount = ward.capacity;
        for (let i = 1; i <= Math.min(bedCount, 5); i++) {
            await prisma.bed.create({
                data: {
                    hospitalId: hospital.id,
                    departmentId: departments[0].id,
                    wardId: ward.id,
                    bedNumber: `${wardPrefixes[w]}-${i.toString().padStart(3, '0')}`,
                    bedType: ward.type === 'ICU' ? 'ICU' : 'STANDARD',
                    dailyRate: ward.type === 'PRIVATE' ? 500 : ward.type === 'ICU' ? 1000 : 200,
                    status: 'AVAILABLE',
                },
            });
        }
    }
    console.log('Created wards and beds');
    // Create sample drugs
    const drugs = [
        { name: 'Paracetamol', genericName: 'Acetaminophen', code: 'DRUG001', category: 'Analgesic', dosageForm: 'Tablet', strength: '500mg', price: 5 },
        { name: 'Amoxicillin', genericName: 'Amoxicillin', code: 'DRUG002', category: 'Antibiotic', dosageForm: 'Capsule', strength: '500mg', price: 15 },
        { name: 'Omeprazole', genericName: 'Omeprazole', code: 'DRUG003', category: 'Antacid', dosageForm: 'Capsule', strength: '20mg', price: 12 },
        { name: 'Metformin', genericName: 'Metformin', code: 'DRUG004', category: 'Antidiabetic', dosageForm: 'Tablet', strength: '500mg', price: 8 },
        { name: 'Lisinopril', genericName: 'Lisinopril', code: 'DRUG005', category: 'Antihypertensive', dosageForm: 'Tablet', strength: '10mg', price: 10 },
    ];
    for (const drug of drugs) {
        await prisma.drug.upsert({
            where: { code: drug.code },
            update: {},
            create: drug,
        });
    }
    console.log(`Created ${drugs.length} drugs`);
    console.log('Database seeding completed!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map