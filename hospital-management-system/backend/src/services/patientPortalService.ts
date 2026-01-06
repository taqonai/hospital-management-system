import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { LabOrderStatus } from '@prisma/client';

/**
 * Patient Portal Service
 * Handles patient-facing portal operations including:
 * - Dashboard and summary data
 * - Appointment management
 * - Medical records access
 * - Prescriptions
 * - Lab results
 * - Billing
 *
 * Note: Some features are simplified pending full implementation
 */
export class PatientPortalService {
  /**
   * Get patient dashboard summary
   */
  async getDashboardSummary(hospitalId: string, patientId: string) {
    // Get patient info
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Get upcoming appointments count
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        patientId,
        hospitalId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        appointmentDate: { gte: new Date() },
      },
      take: 5,
      orderBy: { appointmentDate: 'asc' },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Get active prescriptions count
    const activePrescriptions = await prisma.prescription.count({
      where: { patientId, status: 'ACTIVE' },
    });

    // Get pending lab orders
    const pendingLabResults = await prisma.labOrder.count({
      where: {
        patientId,
        status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] },
      },
    });

    // Get next appointment
    const nextAppointment = upcomingAppointments[0];

    return {
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
      },
      upcomingAppointments: upcomingAppointments.map(apt => ({
        id: apt.id,
        date: apt.appointmentDate,
        time: apt.startTime,
        doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'TBD',
        status: apt.status,
      })),
      nextAppointment: nextAppointment ? {
        date: nextAppointment.appointmentDate,
        time: nextAppointment.startTime,
        doctorName: nextAppointment.doctor ? `Dr. ${nextAppointment.doctor.user.firstName} ${nextAppointment.doctor.user.lastName}` : 'TBD',
      } : null,
      activePrescriptions,
      pendingLabResults,
      recentActivity: [],
      healthReminders: ['Stay healthy! Keep up with regular checkups.'],
      unreadMessages: 0,
    };
  }

  /**
   * Get patient appointments
   */
  async getAppointments(hospitalId: string, patientId: string, filters: {
    type?: 'upcoming' | 'past' | 'all';
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { patientId, hospitalId };

    if (filters.type === 'upcoming') {
      where.appointmentDate = { gte: new Date() };
    } else if (filters.type === 'past') {
      where.appointmentDate = { lt: new Date() };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { appointmentDate: filters.type === 'past' ? 'desc' : 'asc' },
        skip,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments.map(apt => ({
        id: apt.id,
        date: apt.appointmentDate,
        time: apt.startTime,
        doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'TBD',
        doctorSpecialty: apt.doctor?.specialization || '',
        reason: apt.reason,
        status: apt.status,
        notes: apt.notes,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Book a new appointment
   */
  async bookAppointment(hospitalId: string, patientId: string, data: {
    doctorId: string;
    departmentId?: string;
    appointmentDate: Date;
    startTime: string;
    type?: string;
    reason?: string;
  }) {
    // Validate doctor exists and is available
    const doctor = await prisma.doctor.findFirst({
      where: { id: data.doctorId, isAvailable: true },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found or unavailable');
    }

    // Check for conflicting appointments
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });

    if (existingAppointment) {
      throw new AppError('This time slot is no longer available');
    }

    // Calculate end time (30 min default)
    const [hours, mins] = data.startTime.split(':').map(Number);
    const endMinutes = hours * 60 + mins + 30;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    // Get token number
    const todayAppointments = await prisma.appointment.count({
      where: {
        doctorId: data.doctorId,
        appointmentDate: data.appointmentDate,
        status: { notIn: ['CANCELLED'] },
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId,
        doctorId: data.doctorId,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        endTime,
        type: 'CONSULTATION',
        reason: data.reason || 'Patient portal booking',
        status: 'SCHEDULED',
        tokenNumber: todayAppointments + 1,
      },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return appointment;
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(hospitalId: string, patientId: string, appointmentId: string, reason?: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId, hospitalId },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (appointment.status === 'CANCELLED') {
      throw new AppError('Appointment is already cancelled');
    }

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        notes: reason ? `Cancelled by patient: ${reason}` : 'Cancelled by patient',
      },
    });
  }

  /**
   * Get medical records
   */
  async getMedicalRecords(hospitalId: string, patientId: string, filters?: {
    type?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;

    // Get consultations
    const consultations = await prisma.consultation.findMany({
      where: { patientId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      data: consultations.map(c => ({
        id: c.id,
        type: 'Consultation',
        date: c.createdAt,
        provider: c.doctor?.user ? `Dr. ${c.doctor.user.firstName} ${c.doctor.user.lastName}` : 'Unknown',
        summary: c.chiefComplaint || c.diagnosis?.[0] || 'Consultation',
        diagnosis: c.diagnosis,
      })),
      pagination: { page, limit, total: consultations.length, totalPages: 1 },
    };
  }

  /**
   * Get prescriptions
   */
  async getPrescriptions(hospitalId: string, patientId: string, filters?: {
    status?: 'active' | 'expired' | 'all';
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;

    const where: any = { patientId };
    if (filters?.status === 'active') {
      where.status = 'ACTIVE';
    } else if (filters?.status === 'expired') {
      where.status = 'COMPLETED';
    }

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        medications: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      data: prescriptions.map(p => ({
        id: p.id,
        date: p.createdAt,
        status: p.status,
        doctor: p.doctor ? `Dr. ${p.doctor.user.firstName} ${p.doctor.user.lastName}` : 'Unknown',
        medications: p.medications.map(m => ({
          id: m.id,
          name: m.drugName,
          dosage: m.dosage,
          frequency: m.frequency,
          instructions: m.instructions,
        })),
      })),
      pagination: { page, limit, total: prescriptions.length, totalPages: 1 },
    };
  }

  /**
   * Get lab results
   */
  async getLabResults(hospitalId: string, patientId: string, filters?: {
    status?: 'ready' | 'pending' | 'all';
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;

    const where: any = { patientId, hospitalId };
    if (filters?.status === 'ready') {
      where.status = 'COMPLETED';
    } else if (filters?.status === 'pending') {
      where.status = { in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] };
    }

    const labOrders = await prisma.labOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      data: labOrders.map(order => ({
        id: order.id,
        date: order.createdAt,
        status: order.status,
        clinicalNotes: order.clinicalNotes,
      })),
      pagination: { page, limit, total: labOrders.length, totalPages: 1 },
    };
  }

  /**
   * Get billing summary
   */
  async getBillingSummary(hospitalId: string, patientId: string) {
    // Simplified billing summary - returns placeholder data
    return {
      outstandingBalance: 0,
      totalPaid: 0,
      pendingBills: 0,
      lastPaymentDate: null,
      lastPaymentAmount: 0,
    };
  }

  /**
   * Get bills
   */
  async getBills(hospitalId: string, patientId: string, filters?: {
    type?: 'pending' | 'paid' | 'all';
    page?: number;
    limit?: number;
  }) {
    // Simplified - returns empty array pending billing model implementation
    return {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
  }

  /**
   * Get doctors
   */
  async getDoctors(hospitalId: string, params?: { departmentId?: string; search?: string }) {
    const where: any = {
      user: { hospitalId, isActive: true },
      isAvailable: true,
    };

    if (params?.departmentId) {
      where.departmentId = params.departmentId;
    }

    const doctors = await prisma.doctor.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    });

    return doctors.map(d => ({
      id: d.id,
      name: `Dr. ${d.user.firstName} ${d.user.lastName}`,
      specialty: d.specialization || '',
      department: d.department?.name || '',
    }));
  }

  /**
   * Get departments
   */
  async getDepartments(hospitalId: string) {
    return prisma.department.findMany({
      where: { hospitalId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get health reminders
   */
  async getHealthReminders(hospitalId: string, patientId: string): Promise<string[]> {
    const reminders: string[] = [];

    // Check for upcoming appointments
    const upcomingApt = await prisma.appointment.findFirst({
      where: {
        patientId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        appointmentDate: { gte: new Date() },
      },
    });

    if (!upcomingApt) {
      reminders.push('Schedule your next checkup');
    }

    // Check for active prescriptions
    const activePrescriptions = await prisma.prescription.count({
      where: {
        patientId,
        status: 'ACTIVE',
      },
    });

    if (activePrescriptions > 0) {
      reminders.push('Remember to take your medications as prescribed');
    }

    // Check for pending lab results
    const pendingLabs = await prisma.labOrder.count({
      where: {
        patientId,
        status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] },
      },
    });

    if (pendingLabs > 0) {
      reminders.push('Check your pending lab results');
    }

    if (reminders.length === 0) {
      reminders.push('Stay healthy! Keep up with regular checkups.');
    }

    return reminders;
  }
}

export const patientPortalService = new PatientPortalService();
