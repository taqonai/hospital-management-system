import prisma from '../config/database';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import logger from '../utils/logger';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface AppointmentFilters extends PaginationParams {
  type?: 'upcoming' | 'past';
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export class PatientPortalService {

  /**
   * Get patient summary for dashboard
   */
  async getPatientSummary(hospitalId: string, patientId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const now = new Date();

    // Get upcoming appointments count
    const upcomingAppointments = await prisma.appointment.count({
      where: {
        patientId,
        hospitalId,
        appointmentDate: { gte: now },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    // Get upcoming appointments list (next 3)
    const upcomingAppointmentsList = await prisma.appointment.findMany({
      where: {
        patientId,
        hospitalId,
        appointmentDate: { gte: now },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      include: {
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        department: { select: { name: true } },
      },
      orderBy: { appointmentDate: 'asc' },
      take: 3,
    });

    // Get next appointment
    const nextAppointment = upcomingAppointmentsList[0];

    // Get active prescriptions count
    const activePrescriptions = await prisma.prescription.count({
      where: {
        patientId,
        status: 'ACTIVE',
      },
    });

    // Get pending lab results (orders without results)
    const pendingLabs = await prisma.labOrder.count({
      where: {
        patientId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'SAMPLE_COLLECTED'] },
      },
    });

    // Get unread messages - use PatientMessage if exists, otherwise return 0
    let unreadMessages = 0;
    try {
      unreadMessages = await prisma.patientMessage.count({
        where: {
          patientId,
          isRead: false,
        },
      });
    } catch {
      // PatientMessage table might not exist
    }

    // Get pending bills count and total balance
    let pendingBills = 0;
    let outstandingBalance = 0;
    try {
      const bills = await prisma.billing.findMany({
        where: {
          patientId,
          hospitalId,
          paymentStatus: { in: ['PENDING', 'PARTIAL'] },
        },
        select: { totalAmount: true, paidAmount: true },
      });
      pendingBills = bills.length;
      outstandingBalance = bills.reduce((sum, b) => sum + (Number(b.totalAmount) - Number(b.paidAmount || 0)), 0);
    } catch {
      // Billing table structure might differ
    }

    // Get recent activity
    const recentActivity = await this.getRecentActivity(hospitalId, patientId);

    // Generate health reminders
    const reminders = await this.generateHealthReminders(hospitalId, patientId);

    return {
      patientName: `${patient.firstName} ${patient.lastName}`,
      upcomingAppointments,
      upcomingAppointmentsList: upcomingAppointmentsList.map(apt => ({
        id: apt.id,
        date: apt.appointmentDate,
        time: apt.appointmentTime,
        doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'TBD',
        department: apt.department?.name || 'General',
        status: apt.status,
      })),
      nextAppointment: nextAppointment ? {
        date: nextAppointment.appointmentDate,
        time: nextAppointment.appointmentTime,
        doctorName: nextAppointment.doctor ? `Dr. ${nextAppointment.doctor.user.firstName} ${nextAppointment.doctor.user.lastName}` : 'TBD',
      } : null,
      activePrescriptions,
      pendingLabs,
      unreadMessages,
      pendingBills,
      outstandingBalance,
      recentActivity,
      reminders,
    };
  }

  /**
   * Get patient appointments
   */
  async getAppointments(hospitalId: string, patientId: string, filters: AppointmentFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: any = { patientId, hospitalId };

    if (filters.type === 'upcoming') {
      where.appointmentDate = { gte: now };
      where.status = { in: ['SCHEDULED', 'CONFIRMED'] };
    } else if (filters.type === 'past') {
      where.OR = [
        { appointmentDate: { lt: now } },
        { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
      ];
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
              specialty: { select: { name: true } },
            },
          },
          department: { select: { name: true } },
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
        time: apt.appointmentTime,
        doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'TBD',
        doctorSpecialty: apt.doctor?.specialty?.name || '',
        department: apt.department?.name || '',
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
    appointmentTime: string;
    reason: string;
    notes?: string;
  }) {
    // Verify patient
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });
    if (!patient) throw new NotFoundError('Patient not found');

    // Verify doctor
    const doctor = await prisma.doctor.findFirst({
      where: { id: data.doctorId, hospitalId },
    });
    if (!doctor) throw new NotFoundError('Doctor not found');

    // Check for scheduling conflicts
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        appointmentDate: data.appointmentDate,
        appointmentTime: data.appointmentTime,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    if (existingAppointment) {
      throw new AppError('This time slot is not available', 400);
    }

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId,
        doctorId: data.doctorId,
        departmentId: data.departmentId || doctor.departmentId,
        appointmentDate: data.appointmentDate,
        appointmentTime: data.appointmentTime,
        reason: data.reason,
        notes: data.notes,
        status: 'SCHEDULED',
        type: 'GENERAL',
      },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        department: { select: { name: true } },
      },
    });

    return appointment;
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(hospitalId: string, patientId: string, appointmentId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId, hospitalId },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (appointment.status === 'COMPLETED') {
      throw new AppError('Cannot cancel a completed appointment', 400);
    }

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Get medical records
   */
  async getMedicalRecords(hospitalId: string, patientId: string, params: {
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    // Get consultations
    const consultations = await prisma.consultation.findMany({
      where: { patientId },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        appointment: { select: { appointmentDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.consultation.count({ where: { patientId } });

    return {
      data: consultations.map(c => ({
        id: c.id,
        type: 'Consultation',
        date: c.appointment?.appointmentDate || c.createdAt,
        provider: c.doctor ? `Dr. ${c.doctor.user.firstName} ${c.doctor.user.lastName}` : 'Unknown',
        summary: c.chiefComplaint || c.diagnosis?.[0] || 'Consultation',
        diagnosis: c.diagnosis,
        notes: c.notes,
        treatmentPlan: c.treatmentPlan,
        icdCodes: c.icdCodes,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get prescriptions
   */
  async getPrescriptions(hospitalId: string, patientId: string, params: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { patientId };
    if (params.status === 'active') {
      where.status = 'ACTIVE';
    } else if (params.status === 'past') {
      where.status = { in: ['COMPLETED', 'CANCELLED', 'DISCONTINUED'] };
    }

    const [prescriptions, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        include: {
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          medications: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.prescription.count({ where }),
    ]);

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
          duration: m.duration,
          instructions: m.instructions,
          quantity: m.quantity,
        })),
        refillsRemaining: p.refillsRemaining || 0,
        notes: p.notes,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Request prescription refill
   */
  async requestRefill(hospitalId: string, patientId: string, prescriptionId: string) {
    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId },
    });

    if (!prescription) {
      throw new NotFoundError('Prescription not found');
    }

    if (prescription.refillsRemaining !== null && prescription.refillsRemaining <= 0) {
      throw new AppError('No refills remaining for this prescription', 400);
    }

    // Update prescription with refill request (in real app, this would create a refill request record)
    return prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        notes: `${prescription.notes || ''}\nRefill requested on ${new Date().toISOString()}`,
      },
    });
  }

  /**
   * Get lab results
   */
  async getLabResults(hospitalId: string, patientId: string, params: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { patientId };
    if (params.status && params.status !== 'all') {
      where.status = params.status.toUpperCase();
    }

    const [labOrders, total] = await Promise.all([
      prisma.labOrder.findMany({
        where,
        include: {
          orderedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
          tests: {
            include: { test: true, results: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.labOrder.count({ where }),
    ]);

    return {
      data: labOrders.map(order => ({
        id: order.id,
        date: order.createdAt,
        status: order.status,
        orderedBy: order.orderedBy ? `Dr. ${order.orderedBy.user.firstName} ${order.orderedBy.user.lastName}` : 'Unknown',
        tests: order.tests.map(t => ({
          id: t.id,
          name: t.test?.name || 'Unknown Test',
          status: t.status,
          results: t.results.map(r => ({
            parameter: r.parameterName,
            value: r.value,
            unit: r.unit,
            normalRange: r.normalRange,
            isAbnormal: r.isAbnormal,
            flag: r.flag,
          })),
        })),
        notes: order.notes,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get messages
   */
  async getMessages(hospitalId: string, patientId: string, params: PaginationParams = {}) {
    const page = params.page || 1;
    const limit = params.limit || 20;

    // Return mock data since PatientMessage table may not exist
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  /**
   * Send message
   */
  async sendMessage(hospitalId: string, patientId: string, data: {
    recipientId: string;
    subject: string;
    body: string;
  }) {
    // Placeholder - would create message in database
    logger.info('Patient message sent', { patientId, recipientId: data.recipientId, subject: data.subject });
    return { success: true, message: 'Message sent' };
  }

  /**
   * Get bills
   */
  async getBills(hospitalId: string, patientId: string, params: {
    type?: 'pending' | 'history';
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { patientId, hospitalId };
    if (params.type === 'pending') {
      where.paymentStatus = { in: ['PENDING', 'PARTIAL'] };
    } else if (params.type === 'history') {
      where.paymentStatus = 'PAID';
    }

    try {
      const [bills, total, summary] = await Promise.all([
        prisma.billing.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.billing.count({ where }),
        prisma.billing.aggregate({
          where: { patientId, hospitalId, paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
          _sum: { totalAmount: true, paidAmount: true },
        }),
      ]);

      const totalBalance = Number(summary._sum.totalAmount || 0) - Number(summary._sum.paidAmount || 0);

      return {
        summary: {
          totalBalance,
          pendingCount: await prisma.billing.count({ where: { patientId, hospitalId, paymentStatus: { in: ['PENDING', 'PARTIAL'] } } }),
        },
        data: bills.map(b => ({
          id: b.id,
          date: b.createdAt,
          description: b.notes || 'Medical Services',
          totalAmount: Number(b.totalAmount),
          paidAmount: Number(b.paidAmount || 0),
          balance: Number(b.totalAmount) - Number(b.paidAmount || 0),
          status: b.paymentStatus,
          dueDate: b.dueDate,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      logger.error('Error fetching bills:', error);
      return {
        summary: { totalBalance: 0, pendingCount: 0 },
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }
  }

  /**
   * Get available doctors for booking
   */
  async getAvailableDoctors(hospitalId: string, params: { departmentId?: string }) {
    const where: any = { hospitalId, status: 'ACTIVE' };
    if (params.departmentId) {
      where.departmentId = params.departmentId;
    }

    const doctors = await prisma.doctor.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        specialty: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    return doctors.map(d => ({
      id: d.id,
      name: `Dr. ${d.user.firstName} ${d.user.lastName}`,
      specialty: d.specialty?.name || '',
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

  // Private helper methods
  private async getRecentActivity(hospitalId: string, patientId: string) {
    const activities: any[] = [];

    // Recent appointments
    const recentAppointments = await prisma.appointment.findMany({
      where: { patientId, hospitalId },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    });

    for (const apt of recentAppointments) {
      activities.push({
        date: apt.updatedAt.toLocaleDateString(),
        description: `Appointment ${apt.status.toLowerCase()}`,
        type: 'appointment',
      });
    }

    // Recent lab orders
    const recentLabs = await prisma.labOrder.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    for (const lab of recentLabs) {
      activities.push({
        date: lab.createdAt.toLocaleDateString(),
        description: `Lab order ${lab.status.toLowerCase().replace('_', ' ')}`,
        type: 'lab',
      });
    }

    return activities.slice(0, 5);
  }

  private async generateHealthReminders(hospitalId: string, patientId: string) {
    const reminders: string[] = [];

    // Check for upcoming appointment
    const upcomingApt = await prisma.appointment.findFirst({
      where: {
        patientId,
        hospitalId,
        appointmentDate: { gte: new Date() },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    if (!upcomingApt) {
      reminders.push('Schedule your next checkup');
    }

    // Check for active prescriptions needing refill
    const lowRefillPrescriptions = await prisma.prescription.count({
      where: {
        patientId,
        status: 'ACTIVE',
        refillsRemaining: { lte: 1 },
      },
    });

    if (lowRefillPrescriptions > 0) {
      reminders.push(`${lowRefillPrescriptions} prescription(s) need refill soon`);
    }

    // Check for pending lab results
    const pendingLabs = await prisma.labOrder.count({
      where: {
        patientId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
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
