import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Blood Bank and Telemedicine data...');

  // Get existing hospital, patients, doctors
  const hospital = await prisma.hospital.findFirst();
  if (!hospital) {
    console.error('No hospital found. Please run the main seed first.');
    return;
  }

  const patients = await prisma.patient.findMany({ take: 10 });
  const doctors = await prisma.user.findMany({ where: { role: 'DOCTOR' }, take: 5 });
  const nurses = await prisma.user.findMany({ where: { role: 'NURSE' }, take: 2 });

  if (patients.length === 0 || doctors.length === 0) {
    console.error('No patients or doctors found. Please run the main seed first.');
    return;
  }

  // ==================== BLOOD BANK MODULE ====================
  console.log('\nSeeding Blood Bank data...');

  // Create Blood Donors
  const bloodDonorsData = [
    {
      firstName: 'John', lastName: 'Anderson', dateOfBirth: new Date('1985-03-15'), gender: 'MALE',
      bloodGroup: 'O_POSITIVE', rhFactor: 'POSITIVE', phone: '+1-555-111-0001', email: 'john.anderson@email.com',
      address: '123 Oak Street', city: 'New York', weight: 80.5, hemoglobin: 15.2, totalDonations: 12,
      lastDonationDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
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

    let expiryDays = 35;
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
  const availableComponents = bloodComponents.filter(c => c.status === 'ISSUED' || c.status === 'AVAILABLE');

  for (let i = 0; i < Math.min(5, availableComponents.length); i++) {
    const request = bloodRequests[i];
    const component = availableComponents[i];
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
        administeredBy: nurses[0]?.id || doctors[0].id,
        supervisedBy: doctors[0].id,
        hasReaction: i === 2,
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

    await prisma.bloodComponent.update({
      where: { id: component.id },
      data: { status: 'TRANSFUSED' },
    });
  }
  console.log(`Created ${transfusions.length} blood transfusions`);

  // ==================== TELEMEDICINE MODULE ====================
  console.log('\nSeeding Telemedicine data...');

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

    let scheduledStart: Date;
    let status: string;

    if (i < 5) {
      scheduledStart = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
      status = 'COMPLETED';
    } else if (i < 8) {
      scheduledStart = new Date();
      scheduledStart.setHours(9 + i, 0, 0, 0);
      status = scheduledStart < new Date() ? 'COMPLETED' : 'SCHEDULED';
    } else if (i < 12) {
      scheduledStart = new Date();
      scheduledStart.setDate(scheduledStart.getDate() + (i < 10 ? 0 : 1));
      scheduledStart.setHours(14 + (i % 4), 0, 0, 0);
      status = 'SCHEDULED';
    } else if (i < 15) {
      scheduledStart = new Date(Date.now() - (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000);
      status = i % 2 === 0 ? 'NO_SHOW' : 'CANCELLED';
    } else {
      scheduledStart = new Date();
      scheduledStart.setDate(scheduledStart.getDate() + 2 + Math.floor(Math.random() * 5));
      scheduledStart.setHours(9 + Math.floor(Math.random() * 8), Math.random() > 0.5 ? 30 : 0, 0, 0);
      status = 'SCHEDULED';
    }

    const scheduledEnd = new Date(scheduledStart.getTime() + 30 * 60 * 1000);
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
  console.log('Blood Bank & Telemedicine seeding completed!');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
