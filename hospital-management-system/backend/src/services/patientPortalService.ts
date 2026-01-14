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

    // Normalize to start of day for date comparisons (matches getAppointments logic)
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    // Define upcoming appointments filter
    const upcomingFilter = {
      patientId,
      hospitalId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] as const },
      appointmentDate: { gte: startOfToday },
    };

    // Run all queries in parallel for performance
    const [upcomingAppointments, totalUpcomingAppointments, activePrescriptions, pendingLabResults] = await Promise.all([
      // Get upcoming appointments (limited to 5 for display)
      prisma.appointment.findMany({
        where: upcomingFilter,
        take: 5,
        orderBy: { appointmentDate: 'asc' },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      // Get TOTAL count of upcoming appointments (not limited)
      prisma.appointment.count({ where: upcomingFilter }),
      // Get active prescriptions count
      prisma.prescription.count({
        where: { patientId, status: 'ACTIVE' },
      }),
      // Get pending lab orders
      prisma.labOrder.count({
        where: {
          patientId,
          status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] },
        },
      }),
    ]);

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
        appointmentDate: apt.appointmentDate,
        startTime: apt.startTime,
        time: apt.startTime,
        doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'TBD',
        status: apt.status,
        doctor: apt.doctor ? {
          user: {
            firstName: apt.doctor.user.firstName,
            lastName: apt.doctor.user.lastName,
          },
          specialization: apt.doctor.specialization || '',
        } : null,
      })),
      // Include total count for accurate display on dashboard
      totalUpcomingAppointments,
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

    // Normalize to start of day for date comparisons
    // Appointments are stored with date at 00:00:00 UTC
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    if (filters.type === 'upcoming') {
      // Include today and future appointments
      where.appointmentDate = { gte: startOfToday };
    } else if (filters.type === 'past') {
      // Only appointments before today
      where.appointmentDate = { lt: startOfToday };
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
              department: { select: { id: true, name: true } },
            },
          },
        },
        // Sort by createdAt DESC so latest bookings appear first
        // Then by appointmentDate for consistent ordering within same creation time
        orderBy: [
          { createdAt: 'desc' },
          { appointmentDate: filters.type === 'past' ? 'desc' : 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments.map(apt => ({
        id: apt.id,
        appointmentDate: apt.appointmentDate,
        date: apt.appointmentDate,
        startTime: apt.startTime,
        time: apt.startTime,
        endTime: apt.endTime,
        doctorId: apt.doctorId,
        doctorName: apt.doctor ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : 'TBD',
        doctorSpecialty: apt.doctor?.specialization || '',
        departmentId: apt.doctor?.departmentId || '',
        departmentName: apt.doctor?.department?.name || '',
        type: apt.type,
        reason: apt.reason,
        status: apt.status,
        notes: apt.notes,
        tokenNumber: apt.tokenNumber,
        createdAt: apt.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Book a new appointment
   *
   * Validations:
   * - Patient cannot have multiple appointments at the same date/time (prevents double booking)
   * - Doctor slot must be available (no other patient booked)
   * - Appointment must be for future date/time
   *
   * Token number generation:
   * - Unique per hospital per day (ensured by doctor+date combination)
   * - Sequential for each doctor's appointments on that day
   * - Resets daily (new day = new sequence starting from 1)
   * - Uses transaction to prevent race conditions
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
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found or unavailable');
    }

    // Normalize the date to start of day (UTC) for storage
    const normalizedDate = new Date(data.appointmentDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Create date range for comparison (to handle old appointments with time in date field)
    const startOfDay = new Date(data.appointmentDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    // Calculate end time (30 min default)
    const [hours, mins] = data.startTime.split(':').map(Number);
    const endMinutes = hours * 60 + mins + 30;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    // Use a serializable transaction to prevent race conditions
    const appointment = await prisma.$transaction(async (tx) => {
      // VALIDATION 1: Check if patient already has an appointment at this date/time
      // Use date range to handle old appointments with time stored in date field
      const patientConflict = await tx.appointment.findFirst({
        where: {
          patientId,
          hospitalId,
          appointmentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
          startTime: data.startTime,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      if (patientConflict) {
        const doctorName = patientConflict.doctor?.user
          ? `Dr. ${patientConflict.doctor.user.firstName} ${patientConflict.doctor.user.lastName}`
          : 'another doctor';
        throw new AppError(
          `You already have an appointment at this time with ${doctorName}. Please choose a different time slot.`,
          400
        );
      }

      // VALIDATION 2: Check for conflicting doctor appointments (slot already taken by another patient)
      const doctorConflict = await tx.appointment.findFirst({
        where: {
          doctorId: data.doctorId,
          appointmentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
          startTime: data.startTime,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      });

      if (doctorConflict) {
        throw new AppError('This time slot is no longer available. Please select another time.');
      }

      // VALIDATION 3: Check patient doesn't have too many pending appointments
      // This helps prevent appointment hoarding
      const pendingAppointments = await tx.appointment.count({
        where: {
          patientId,
          hospitalId,
          appointmentDate: { gte: new Date() },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
      });

      if (pendingAppointments >= 10) {
        throw new AppError(
          'You have too many pending appointments. Please complete or cancel existing appointments before booking new ones.',
          400
        );
      }

      // Get the maximum token number for this doctor on this date
      // Use date range to handle appointments with time in date field
      const maxTokenResult = await tx.appointment.findFirst({
        where: {
          doctorId: data.doctorId,
          appointmentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        orderBy: { tokenNumber: 'desc' },
        select: { tokenNumber: true },
      });

      const nextTokenNumber = (maxTokenResult?.tokenNumber ?? 0) + 1;

      return tx.appointment.create({
        data: {
          hospitalId,
          patientId,
          doctorId: data.doctorId,
          appointmentDate: normalizedDate,
          startTime: data.startTime,
          endTime,
          type: data.type || 'CONSULTATION',
          reason: data.reason || 'Patient portal booking',
          status: 'SCHEDULED',
          tokenNumber: nextTokenNumber,
        },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              department: { select: { id: true, name: true } },
            },
          },
        },
      });
    }, {
      // Use serializable isolation level to prevent race conditions
      isolationLevel: 'Serializable',
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
   * Reschedule appointment
   *
   * Validations:
   * - Appointment must exist and belong to patient
   * - Cannot reschedule cancelled/completed appointments
   * - New slot must be available (doctor not booked)
   * - Patient cannot have another appointment at the new time
   */
  async rescheduleAppointment(
    hospitalId: string,
    patientId: string,
    appointmentId: string,
    data: { appointmentDate: Date; startTime: string }
  ) {
    // Find the existing appointment
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId, hospitalId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(appointment.status)) {
      throw new AppError(`Cannot reschedule a ${appointment.status.toLowerCase()} appointment`);
    }

    // Normalize the date to start of day (UTC) for consistent comparison
    const normalizedDate = new Date(data.appointmentDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Create date range for comparison (to handle old appointments with time in date field)
    const startOfDay = new Date(data.appointmentDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    // Calculate new end time (30 min default)
    const [hours, mins] = data.startTime.split(':').map(Number);
    const endMinutes = hours * 60 + mins + 30;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    // Use transaction for consistency
    const updatedAppointment = await prisma.$transaction(async (tx) => {
      // VALIDATION 1: Check if patient already has another appointment at the new time
      // This prevents double-booking regardless of doctor
      // Use date range to handle old appointments with time stored in date field
      const patientConflict = await tx.appointment.findFirst({
        where: {
          patientId,
          hospitalId,
          appointmentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
          startTime: data.startTime,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          id: { not: appointmentId }, // Exclude current appointment being rescheduled
        },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      if (patientConflict) {
        const doctorName = patientConflict.doctor?.user
          ? `Dr. ${patientConflict.doctor.user.firstName} ${patientConflict.doctor.user.lastName}`
          : 'another doctor';
        throw new AppError(
          `You already have an appointment at this time with ${doctorName}. Please choose a different time slot.`,
          400
        );
      }

      // VALIDATION 2: Check if doctor's slot is available (not booked by another patient)
      // Use date range to handle old appointments with time stored in date field
      const doctorConflict = await tx.appointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          appointmentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
          startTime: data.startTime,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          id: { not: appointmentId }, // Exclude current appointment being rescheduled
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
      });

      if (doctorConflict) {
        throw new AppError(
          `This time slot is already booked with another patient. Please select a different time.`,
          400
        );
      }

      // Generate new token number for the new date
      // Use date range to handle appointments with time in date field
      const maxTokenResult = await tx.appointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          appointmentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          id: { not: appointmentId },
        },
        orderBy: { tokenNumber: 'desc' },
        select: { tokenNumber: true },
      });

      const nextTokenNumber = (maxTokenResult?.tokenNumber ?? 0) + 1;

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          appointmentDate: normalizedDate,
          startTime: data.startTime,
          endTime,
          tokenNumber: nextTokenNumber,
          notes: appointment.notes
            ? `${appointment.notes}\n[Rescheduled by patient]`
            : '[Rescheduled by patient]',
        },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              department: { select: { id: true, name: true } },
            },
          },
        },
      });
    }, {
      isolationLevel: 'Serializable',
    });

    return updatedAppointment;
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
      specialization: d.specialization || '',
      departmentId: d.departmentId || '',
      consultationFee: (d as any).consultationFee || null,
      user: {
        firstName: d.user.firstName,
        lastName: d.user.lastName,
      },
      department: {
        id: d.departmentId || '',
        name: d.department?.name || '',
      },
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
