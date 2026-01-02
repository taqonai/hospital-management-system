import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

export class OPDService {
  // Queue Management
  async getTodayQueue(hospitalId: string, doctorId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      hospitalId,
      appointmentDate: { gte: today, lt: tomorrow },
      status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
    };
    if (doctorId) where.doctorId = doctorId;

    return prisma.appointment.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { tokenNumber: 'asc' },
        { startTime: 'asc' },
      ],
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, phone: true } },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
  }

  async checkInPatient(appointmentId: string, hospitalId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
    });

    if (!appointment) throw new NotFoundError('Appointment not found');

    // Generate token number for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lastToken = await prisma.appointment.findFirst({
      where: {
        hospitalId,
        doctorId: appointment.doctorId,
        appointmentDate: { gte: today, lt: tomorrow },
        tokenNumber: { not: null },
      },
      orderBy: { tokenNumber: 'desc' },
    });

    const tokenNumber = (lastToken?.tokenNumber || 0) + 1;

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CHECKED_IN',
        tokenNumber,
        checkedInAt: new Date(),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async callNextPatient(doctorId: string, hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Mark current in-progress as completed
    await prisma.appointment.updateMany({
      where: {
        hospitalId,
        doctorId,
        appointmentDate: { gte: today, lt: tomorrow },
        status: 'IN_PROGRESS',
      },
      data: { status: 'COMPLETED' },
    });

    // Get next checked-in patient
    const nextPatient = await prisma.appointment.findFirst({
      where: {
        hospitalId,
        doctorId,
        appointmentDate: { gte: today, lt: tomorrow },
        status: 'CHECKED_IN',
      },
      orderBy: { tokenNumber: 'asc' },
    });

    if (!nextPatient) {
      return null;
    }

    return prisma.appointment.update({
      where: { id: nextPatient.id },
      data: { status: 'IN_PROGRESS' },
      include: {
        patient: true,
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async getCurrentToken(doctorId: string, hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const current = await prisma.appointment.findFirst({
      where: {
        hospitalId,
        doctorId,
        appointmentDate: { gte: today, lt: tomorrow },
        status: 'IN_PROGRESS',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });

    const waiting = await prisma.appointment.count({
      where: {
        hospitalId,
        doctorId,
        appointmentDate: { gte: today, lt: tomorrow },
        status: 'CHECKED_IN',
      },
    });

    return { current, waitingCount: waiting };
  }

  async getWaitTime(doctorId: string, hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [waiting, doctor] = await Promise.all([
      prisma.appointment.count({
        where: {
          hospitalId,
          doctorId,
          appointmentDate: { gte: today, lt: tomorrow },
          status: 'CHECKED_IN',
        },
      }),
      prisma.doctor.findUnique({ where: { id: doctorId } }),
    ]);

    const avgConsultTime = doctor?.slotDuration || 15;
    return { waitingCount: waiting, estimatedWaitMinutes: waiting * avgConsultTime };
  }

  async markNoShow(appointmentId: string, hospitalId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
    });

    if (!appointment) throw new NotFoundError('Appointment not found');

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'NO_SHOW' },
    });
  }

  async rescheduleAppointment(appointmentId: string, hospitalId: string, newDate: Date, newStartTime: string, newEndTime: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
    });

    if (!appointment) throw new NotFoundError('Appointment not found');

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        appointmentDate: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        status: 'SCHEDULED',
        tokenNumber: null,
        checkedInAt: null,
      },
    });
  }

  async getOPDStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalAppointments,
      checkedIn,
      completed,
      noShow,
      waiting,
    ] = await Promise.all([
      prisma.appointment.count({
        where: { hospitalId, appointmentDate: { gte: today, lt: tomorrow } },
      }),
      prisma.appointment.count({
        where: { hospitalId, appointmentDate: { gte: today, lt: tomorrow }, status: 'CHECKED_IN' },
      }),
      prisma.appointment.count({
        where: { hospitalId, appointmentDate: { gte: today, lt: tomorrow }, status: 'COMPLETED' },
      }),
      prisma.appointment.count({
        where: { hospitalId, appointmentDate: { gte: today, lt: tomorrow }, status: 'NO_SHOW' },
      }),
      prisma.appointment.count({
        where: { hospitalId, appointmentDate: { gte: today, lt: tomorrow }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      }),
    ]);

    return {
      totalAppointments,
      checkedIn,
      completed,
      noShow,
      waiting,
      inProgress: await prisma.appointment.count({
        where: { hospitalId, appointmentDate: { gte: today, lt: tomorrow }, status: 'IN_PROGRESS' },
      }),
    };
  }

  async getDoctorQueueDisplay(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const doctors = await prisma.doctor.findMany({
      where: {
        department: { hospitalId },
        isAvailable: true,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
        appointments: {
          where: {
            appointmentDate: { gte: today, lt: tomorrow },
            status: { in: ['CHECKED_IN', 'IN_PROGRESS'] },
          },
          orderBy: { tokenNumber: 'asc' },
        },
      },
    });

    return doctors.map(doctor => ({
      doctorId: doctor.id,
      doctorName: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
      department: doctor.department.name,
      specialization: doctor.specialization,
      currentToken: doctor.appointments.find(a => a.status === 'IN_PROGRESS')?.tokenNumber || null,
      waitingCount: doctor.appointments.filter(a => a.status === 'CHECKED_IN').length,
    }));
  }
}

export const opdService = new OPDService();
