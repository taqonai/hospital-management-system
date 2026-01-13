import { PrismaClient, DayOfWeek } from '@prisma/client';

const prisma = new PrismaClient();

const days: DayOfWeek[] = [
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'
];

async function main() {
  // Get all doctors
  const doctors = await prisma.doctor.findMany({
    select: { id: true, user: { select: { email: true } } }
  });

  console.log(`Found ${doctors.length} doctors`);

  for (const doctor of doctors) {
    // Delete existing schedules
    await prisma.doctorSchedule.deleteMany({
      where: { doctorId: doctor.id }
    });

    // Create 24/7 schedules for all days
    await prisma.doctorSchedule.createMany({
      data: days.map(day => ({
        doctorId: doctor.id,
        dayOfWeek: day,
        startTime: '00:00',
        endTime: '23:59',
        breakStart: null,
        breakEnd: null,
        isActive: true
      }))
    });

    const email = doctor.user ? doctor.user.email : doctor.id;
    console.log(`Updated schedule for ${email} to 24/7`);
  }

  console.log('Done! All doctors now have 24/7 schedules.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
