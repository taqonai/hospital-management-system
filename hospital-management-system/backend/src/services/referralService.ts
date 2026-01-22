import { prisma } from '../config/database';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { ReferralUrgency, ReferralStatus } from '@prisma/client';
import { notificationService } from './notificationService';

/**
 * Interface for creating a new referral
 */
interface CreateReferralDto {
  sourceConsultationId?: string;
  sourceAppointmentId: string;
  referringDoctorId: string;
  patientId: string;
  targetDepartmentId: string;
  targetDoctorId?: string;
  reason: string;
  urgency: ReferralUrgency;
  clinicalNotes?: string;
}

/**
 * Interface for scheduling an appointment from referral
 */
interface ScheduleAppointmentDto {
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  notes?: string;
}

/**
 * Interface for referral queue filters
 */
interface ReferralQueueFilters {
  urgency?: ReferralUrgency;
  departmentId?: string;
  status?: ReferralStatus;
  page?: number;
  limit?: number;
}

/**
 * Referral Service
 * Handles consultant referral lifecycle including creation, scheduling, and status management
 */
class ReferralService {
  /**
   * Create a new consultant referral
   */
  async create(hospitalId: string, data: CreateReferralDto) {
    // Validate source appointment exists and belongs to hospital
    const sourceAppointment = await prisma.appointment.findFirst({
      where: { id: data.sourceAppointmentId, hospitalId },
      include: {
        patient: {
          include: { user: true },
        },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
      },
    });

    if (!sourceAppointment) {
      throw new NotFoundError('Source appointment not found');
    }

    // Validate target department exists
    const targetDepartment = await prisma.department.findFirst({
      where: { id: data.targetDepartmentId, hospitalId },
    });

    if (!targetDepartment) {
      throw new NotFoundError('Target department not found');
    }

    // Validate target doctor if provided
    if (data.targetDoctorId) {
      const targetDoctor = await prisma.doctor.findFirst({
        where: {
          id: data.targetDoctorId,
          departmentId: data.targetDepartmentId,
          user: { hospitalId },
        },
      });

      if (!targetDoctor) {
        throw new NotFoundError('Target doctor not found or not in specified department');
      }
    }

    // Set priority booking and expiration based on urgency
    let priorityBooking = false;
    let priorityExpiresAt: Date | null = null;
    let expiresAt: Date | null = null;

    if (data.urgency === 'ROUTINE') {
      priorityBooking = true;
      priorityExpiresAt = new Date();
      priorityExpiresAt.setDate(priorityExpiresAt.getDate() + 30);
    } else if (data.urgency === 'URGENT') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    // Create the referral
    const referral = await prisma.consultantReferral.create({
      data: {
        hospitalId,
        sourceConsultationId: data.sourceConsultationId,
        sourceAppointmentId: data.sourceAppointmentId,
        referringDoctorId: data.referringDoctorId,
        patientId: data.patientId,
        targetDepartmentId: data.targetDepartmentId,
        targetDoctorId: data.targetDoctorId,
        reason: data.reason,
        urgency: data.urgency,
        clinicalNotes: data.clinicalNotes,
        status: 'PENDING',
        priorityBooking,
        priorityExpiresAt,
        expiresAt,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            phone: true,
            email: true,
            user: { select: { id: true } },
          },
        },
        referringDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
        targetDepartment: { select: { id: true, name: true } },
        targetDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Send notification based on urgency
    await this.sendReferralCreatedNotification(referral, sourceAppointment);

    return referral;
  }

  /**
   * Get referral by ID
   */
  async findById(id: string, hospitalId: string) {
    const referral = await prisma.consultantReferral.findFirst({
      where: { id, hospitalId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            phone: true,
            email: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        referringDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
        targetDepartment: { select: { id: true, name: true } },
        targetDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        sourceAppointment: {
          select: {
            id: true,
            appointmentDate: true,
            startTime: true,
          },
        },
        sourceConsultation: {
          select: {
            id: true,
            chiefComplaint: true,
            diagnosis: true,
          },
        },
        scheduledAppointment: {
          select: {
            id: true,
            appointmentDate: true,
            startTime: true,
            status: true,
          },
        },
      },
    });

    if (!referral) {
      throw new NotFoundError('Referral not found');
    }

    return referral;
  }

  /**
   * Get referral queue for receptionists (pending referrals sorted by urgency)
   */
  async getQueue(hospitalId: string, filters: ReferralQueueFilters = {}) {
    const { urgency, departmentId, status = 'PENDING', page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      hospitalId,
      status,
    };

    if (urgency) {
      where.urgency = urgency;
    }

    if (departmentId) {
      where.targetDepartmentId = departmentId;
    }

    const [referrals, total] = await Promise.all([
      prisma.consultantReferral.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
              phone: true,
            },
          },
          referringDoctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              department: { select: { name: true } },
            },
          },
          targetDepartment: { select: { id: true, name: true } },
          targetDoctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [
          // EMERGENCY first, then URGENT, then ROUTINE
          {
            urgency: 'asc',
          },
          // Then by creation date (oldest first)
          {
            createdAt: 'asc',
          },
        ],
        skip,
        take: limit,
      }),
      prisma.consultantReferral.count({ where }),
    ]);

    return {
      referrals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get referrals created by a specific doctor
   */
  async getDoctorReferrals(doctorId: string, hospitalId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where = {
      referringDoctorId: doctorId,
      hospitalId,
    };

    const [referrals, total] = await Promise.all([
      prisma.consultantReferral.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
            },
          },
          targetDepartment: { select: { id: true, name: true } },
          targetDoctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          scheduledAppointment: {
            select: {
              id: true,
              appointmentDate: true,
              startTime: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.consultantReferral.count({ where }),
    ]);

    return {
      referrals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get referrals for a patient (for patient portal)
   */
  async getPatientReferrals(patientId: string, hospitalId: string) {
    const referrals = await prisma.consultantReferral.findMany({
      where: {
        patientId,
        hospitalId,
        status: { in: ['PENDING', 'SCHEDULED'] },
      },
      include: {
        referringDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
        targetDepartment: { select: { id: true, name: true } },
        targetDoctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        scheduledAppointment: {
          select: {
            id: true,
            appointmentDate: true,
            startTime: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return referrals;
  }

  /**
   * Get available slots for a referral (for EMERGENCY flow)
   */
  async getAvailableSlots(referralId: string, hospitalId: string, dateStr?: string) {
    const referral = await this.findById(referralId, hospitalId);

    if (!referral.targetDoctorId) {
      throw new AppError('No target doctor specified for this referral', 400);
    }

    // Default to next 48 hours for EMERGENCY
    const startDate = dateStr ? new Date(dateStr) : new Date();
    const endDate = new Date(startDate);

    if (referral.urgency === 'EMERGENCY') {
      endDate.setDate(endDate.getDate() + 2); // 48 hours
    } else {
      endDate.setDate(endDate.getDate() + 30); // 30 days for others
    }

    // Get available slots for the target doctor
    const slots = await prisma.doctorSlot.findMany({
      where: {
        doctorId: referral.targetDoctorId,
        hospitalId,
        slotDate: {
          gte: startDate,
          lte: endDate,
        },
        isAvailable: true,
        isBlocked: false,
      },
      orderBy: [{ slotDate: 'asc' }, { startTime: 'asc' }],
    });

    // Group slots by date
    const slotsByDate: Record<string, typeof slots> = {};
    for (const slot of slots) {
      const dateKey = slot.slotDate.toISOString().split('T')[0];
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push(slot);
    }

    return {
      targetDoctor: referral.targetDoctor,
      slotsByDate,
      totalSlots: slots.length,
    };
  }

  /**
   * Schedule appointment for a referral (URGENT flow - by receptionist)
   */
  async scheduleAppointment(
    referralId: string,
    hospitalId: string,
    data: ScheduleAppointmentDto,
    scheduledBy: string
  ) {
    const referral = await this.findById(referralId, hospitalId);

    if (referral.status !== 'PENDING') {
      throw new AppError('Referral is not in PENDING status', 400);
    }

    if (!referral.targetDoctorId) {
      throw new AppError('No target doctor specified for this referral', 400);
    }

    // Create appointment and update referral in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the appointment
      const appointment = await tx.appointment.create({
        data: {
          hospitalId,
          patientId: referral.patientId,
          doctorId: referral.targetDoctorId!,
          appointmentDate: data.appointmentDate,
          startTime: data.startTime,
          endTime: data.endTime,
          type: referral.urgency === 'EMERGENCY' ? 'EMERGENCY' : 'CONSULTATION',
          status: 'SCHEDULED',
          reason: `Referral: ${referral.reason}`,
          notes: data.notes,
          isFollowUp: false,
        },
      });

      // Update the referral
      const updatedReferral = await tx.consultantReferral.update({
        where: { id: referralId },
        data: {
          status: 'SCHEDULED',
          scheduledAppointmentId: appointment.id,
          scheduledAt: new Date(),
          scheduledBy,
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              user: { select: { id: true } },
            },
          },
          targetDoctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          targetDepartment: { select: { name: true } },
        },
      });

      // Book the slot if it exists
      await tx.doctorSlot.updateMany({
        where: {
          doctorId: referral.targetDoctorId!,
          slotDate: data.appointmentDate,
          startTime: data.startTime,
          isAvailable: true,
        },
        data: {
          isAvailable: false,
          appointmentId: appointment.id,
        },
      });

      return { appointment, referral: updatedReferral };
    });

    // Send notification to patient
    await this.sendReferralScheduledNotification(result.referral, result.appointment);

    return result;
  }

  /**
   * Book appointment from patient portal (ROUTINE flow)
   */
  async bookFromPortal(
    referralId: string,
    hospitalId: string,
    data: ScheduleAppointmentDto,
    patientId: string
  ) {
    const referral = await this.findById(referralId, hospitalId);

    // Verify the referral belongs to this patient
    if (referral.patientId !== patientId) {
      throw new AppError('Unauthorized to book this referral', 403);
    }

    if (referral.status !== 'PENDING') {
      throw new AppError('Referral is not in PENDING status', 400);
    }

    if (!referral.targetDoctorId) {
      throw new AppError('No target doctor specified for this referral', 400);
    }

    // Use the same scheduling logic
    return this.scheduleAppointment(referralId, hospitalId, data, patientId);
  }

  /**
   * Mark referral as completed (when scheduled appointment is completed)
   */
  async markCompleted(referralId: string, hospitalId: string, notes?: string) {
    const referral = await this.findById(referralId, hospitalId);

    if (referral.status !== 'SCHEDULED') {
      throw new AppError('Referral must be in SCHEDULED status to complete', 400);
    }

    return prisma.consultantReferral.update({
      where: { id: referralId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completionNotes: notes,
      },
    });
  }

  /**
   * Cancel a referral
   */
  async cancel(referralId: string, hospitalId: string, reason: string, cancelledBy: string) {
    const referral = await this.findById(referralId, hospitalId);

    if (referral.status === 'COMPLETED') {
      throw new AppError('Cannot cancel a completed referral', 400);
    }

    // If there's a scheduled appointment, cancel it too
    if (referral.scheduledAppointmentId) {
      await prisma.appointment.update({
        where: { id: referral.scheduledAppointmentId },
        data: { status: 'CANCELLED' },
      });

      // Release the slot
      await prisma.doctorSlot.updateMany({
        where: { appointmentId: referral.scheduledAppointmentId },
        data: {
          isAvailable: true,
          appointmentId: null,
        },
      });
    }

    return prisma.consultantReferral.update({
      where: { id: referralId },
      data: {
        status: 'CANCELLED',
        completionNotes: `Cancelled by ${cancelledBy}: ${reason}`,
      },
    });
  }

  /**
   * Expire old referrals (scheduled job)
   */
  async expireOldReferrals(): Promise<number> {
    const now = new Date();

    // Find and expire referrals past their expiration date
    const result = await prisma.consultantReferral.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
        completionNotes: 'Automatically expired - not scheduled within timeframe',
      },
    });

    // Also expire priority booking for ROUTINE referrals
    await prisma.consultantReferral.updateMany({
      where: {
        status: 'PENDING',
        urgency: 'ROUTINE',
        priorityBooking: true,
        priorityExpiresAt: { lte: now },
      },
      data: {
        priorityBooking: false,
      },
    });

    console.log(`[REFERRAL] Expired ${result.count} referrals`);
    return result.count;
  }

  /**
   * Get referral statistics for a hospital
   */
  async getStatistics(hospitalId: string, startDate?: Date, endDate?: Date) {
    const where: any = { hospitalId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, byStatus, byUrgency] = await Promise.all([
      prisma.consultantReferral.count({ where }),
      prisma.consultantReferral.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.consultantReferral.groupBy({
        by: ['urgency'],
        where,
        _count: { id: true },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count.id }),
        {} as Record<string, number>
      ),
      byUrgency: byUrgency.reduce(
        (acc, item) => ({ ...acc, [item.urgency]: item._count.id }),
        {} as Record<string, number>
      ),
    };
  }

  // ==================== NOTIFICATION HELPERS ====================

  /**
   * Send notification when referral is created
   */
  private async sendReferralCreatedNotification(referral: any, sourceAppointment: any) {
    const patientUser = referral.patient.user;
    const referringDoctorName = `Dr. ${referral.referringDoctor.user.firstName} ${referral.referringDoctor.user.lastName}`;
    const targetDeptName = referral.targetDepartment.name;

    if (referral.urgency === 'EMERGENCY') {
      // For EMERGENCY, doctor will schedule immediately - minimal notification
      console.log(`[REFERRAL] EMERGENCY referral ${referral.id} created - awaiting doctor slot selection`);
    } else if (referral.urgency === 'URGENT') {
      // Notify patient that hospital will contact them
      const message = `${referringDoctorName} has created an urgent referral for you to ${targetDeptName}. Our team will contact you within 24 hours to schedule your appointment.`;

      if (patientUser) {
        await notificationService.sendNotification(
          patientUser.id,
          'APPOINTMENT',
          {
            title: 'Urgent Referral Created',
            message,
            priority: 'high',
            metadata: {
              referralId: referral.id,
              urgency: 'URGENT',
              targetDepartment: targetDeptName,
            },
          },
          ['email', 'sms', 'in_app']
        );
      }
    } else {
      // ROUTINE - notify patient with portal booking link
      const message = `${referringDoctorName} has referred you to ${targetDeptName}. Please log in to the patient portal to book your appointment. You have priority booking for the next 30 days.`;

      if (patientUser) {
        await notificationService.sendNotification(
          patientUser.id,
          'APPOINTMENT',
          {
            title: 'Referral for Specialist Consultation',
            message,
            priority: 'normal',
            metadata: {
              referralId: referral.id,
              urgency: 'ROUTINE',
              targetDepartment: targetDeptName,
              priorityBooking: true,
              priorityExpiresAt: referral.priorityExpiresAt,
            },
          },
          ['email', 'sms', 'in_app']
        );
      }
    }
  }

  /**
   * Send notification when referral is scheduled
   */
  private async sendReferralScheduledNotification(referral: any, appointment: any) {
    const patientUser = referral.patient.user;
    const targetDoctorName = referral.targetDoctor
      ? `Dr. ${referral.targetDoctor.user.firstName} ${referral.targetDoctor.user.lastName}`
      : referral.targetDepartment.name;

    const appointmentDate = new Date(appointment.appointmentDate).toLocaleDateString();
    const message = `Your referral appointment has been scheduled with ${targetDoctorName} on ${appointmentDate} at ${appointment.startTime}. Please arrive 15 minutes early.`;

    if (patientUser) {
      await notificationService.sendNotification(
        patientUser.id,
        'APPOINTMENT',
        {
          title: 'Referral Appointment Scheduled',
          message,
          priority: referral.urgency === 'EMERGENCY' ? 'urgent' : 'high',
          metadata: {
            referralId: referral.id,
            appointmentId: appointment.id,
            appointmentDate,
            appointmentTime: appointment.startTime,
          },
        },
        ['email', 'sms', 'in_app']
      );
    }
  }
}

export const referralService = new ReferralService();
