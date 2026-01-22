import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { ConsultationStatus, ParticipantRole } from '@prisma/client';
import { notificationService } from './notificationService';

/**
 * Consultation Service
 * Handles consultation lifecycle, status tracking, and multi-doctor support
 */
class ConsultationService {
  /**
   * Create a new consultation for an appointment
   */
  async create(data: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    hospitalId: string;
    chiefComplaint: string;
    historyOfIllness?: string;
    examination?: string;
  }) {
    // Check if consultation already exists
    const existing = await prisma.consultation.findUnique({
      where: { appointmentId: data.appointmentId },
    });

    if (existing) {
      throw new AppError('Consultation already exists for this appointment', 400);
    }

    // Create consultation with STARTED status
    const consultation = await prisma.consultation.create({
      data: {
        appointmentId: data.appointmentId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        chiefComplaint: data.chiefComplaint,
        historyOfIllness: data.historyOfIllness,
        examination: data.examination,
        status: 'STARTED',
        startedAt: new Date(),
        diagnosis: [],
        icdCodes: [],
      },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    return consultation;
  }

  /**
   * Update consultation - moves status to IN_PROGRESS
   */
  async update(
    consultationId: string,
    hospitalId: string,
    data: {
      chiefComplaint?: string;
      historyOfIllness?: string;
      examination?: string;
      diagnosis?: string[];
      icdCodes?: string[];
      treatmentPlan?: string;
      advice?: string;
      followUpDate?: Date;
      notes?: string;
    }
  ) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: consultationId },
      include: { appointment: true },
    });

    if (!consultation) {
      throw new AppError('Consultation not found', 404);
    }

    if (consultation.appointment.hospitalId !== hospitalId) {
      throw new AppError('Unauthorized', 403);
    }

    if (consultation.status === 'COMPLETED') {
      throw new AppError('Cannot update a completed consultation', 400);
    }

    if (consultation.status === 'ABANDONED') {
      throw new AppError('Cannot update an abandoned consultation', 400);
    }

    // Move to IN_PROGRESS if still STARTED
    const newStatus = consultation.status === 'STARTED' ? 'IN_PROGRESS' : consultation.status;

    return prisma.consultation.update({
      where: { id: consultationId },
      data: {
        ...data,
        status: newStatus,
      },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        prescriptions: true,
        labOrders: { include: { tests: true } },
      },
    });
  }

  /**
   * Complete a consultation - validates required fields
   */
  async complete(consultationId: string, hospitalId: string, completedBy: string) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: consultationId },
      include: {
        appointment: true,
        patient: { select: { firstName: true, lastName: true } },
        doctor: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!consultation) {
      throw new AppError('Consultation not found', 404);
    }

    if (consultation.appointment.hospitalId !== hospitalId) {
      throw new AppError('Unauthorized', 403);
    }

    if (consultation.status === 'COMPLETED') {
      throw new AppError('Consultation is already completed', 400);
    }

    if (consultation.status === 'ABANDONED') {
      throw new AppError('Cannot complete an abandoned consultation', 400);
    }

    // Validate required fields for completion
    const errors: string[] = [];
    if (!consultation.chiefComplaint || consultation.chiefComplaint.trim() === '') {
      errors.push('Chief complaint is required');
    }
    if (!consultation.diagnosis || consultation.diagnosis.length === 0) {
      errors.push('At least one diagnosis is required');
    }

    if (errors.length > 0) {
      throw new AppError(`Cannot complete consultation: ${errors.join(', ')}`, 400);
    }

    // Complete consultation and appointment in a transaction
    const [updatedConsultation] = await prisma.$transaction([
      prisma.consultation.update({
        where: { id: consultationId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedBy,
        },
      }),
      prisma.appointment.update({
        where: { id: consultation.appointmentId },
        data: { status: 'COMPLETED' },
      }),
    ]);

    return updatedConsultation;
  }

  /**
   * Abandon a consultation - doctor left without completing
   */
  async abandon(consultationId: string, hospitalId: string, reason?: string) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: consultationId },
      include: { appointment: true },
    });

    if (!consultation) {
      throw new AppError('Consultation not found', 404);
    }

    if (consultation.appointment.hospitalId !== hospitalId) {
      throw new AppError('Unauthorized', 403);
    }

    if (consultation.status === 'COMPLETED') {
      throw new AppError('Cannot abandon a completed consultation', 400);
    }

    return prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: 'ABANDONED',
        abandonedAt: new Date(),
        notes: reason ? `${consultation.notes || ''}\n[ABANDONED]: ${reason}`.trim() : consultation.notes,
      },
    });
  }

  /**
   * Check if a consultation is complete (for appointment completion validation)
   */
  async isConsultationComplete(appointmentId: string): Promise<boolean> {
    const consultation = await prisma.consultation.findUnique({
      where: { appointmentId },
    });

    return consultation?.status === 'COMPLETED';
  }

  /**
   * Get incomplete consultations for a doctor (for dashboard)
   */
  async getIncompleteConsultations(doctorId: string, hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.consultation.findMany({
      where: {
        doctorId,
        status: { in: ['STARTED', 'IN_PROGRESS'] },
        appointment: {
          hospitalId,
          appointmentDate: { gte: today },
        },
      },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
        appointment: { select: { appointmentDate: true, startTime: true } },
      },
      orderBy: { startedAt: 'asc' },
    });
  }

  // ==================== MULTI-DOCTOR SUPPORT ====================

  /**
   * Add a consulting doctor to a consultation
   */
  async addParticipant(
    consultationId: string,
    hospitalId: string,
    data: {
      doctorId: string;
      role: ParticipantRole;
      notes?: string;
    }
  ) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: consultationId },
      include: {
        appointment: true,
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!consultation) {
      throw new AppError('Consultation not found', 404);
    }

    if (consultation.appointment.hospitalId !== hospitalId) {
      throw new AppError('Unauthorized', 403);
    }

    if (consultation.status === 'COMPLETED' || consultation.status === 'ABANDONED') {
      throw new AppError('Cannot add participant to a closed consultation', 400);
    }

    // Check if doctor is already a participant
    const existing = await prisma.consultationParticipant.findUnique({
      where: {
        consultationId_doctorId: {
          consultationId,
          doctorId: data.doctorId,
        },
      },
    });

    if (existing) {
      throw new AppError('Doctor is already a participant', 400);
    }

    // Cannot add the primary doctor as a participant
    if (data.doctorId === consultation.doctorId) {
      throw new AppError('Primary doctor cannot be added as a participant', 400);
    }

    const participant = await prisma.consultationParticipant.create({
      data: {
        consultationId,
        doctorId: data.doctorId,
        role: data.role,
        notes: data.notes,
      },
      include: {
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Notify the consulting doctor
    const consultingDoctor = await prisma.doctor.findUnique({
      where: { id: data.doctorId },
      include: { user: { select: { id: true } } },
    });

    if (consultingDoctor) {
      await notificationService.sendNotification(
        consultingDoctor.user.id,
        'APPOINTMENT',
        {
          title: 'Consultation Request',
          message: `Dr. ${consultation.doctor.user?.firstName} has requested your consultation for a patient.`,
          priority: 'high',
          metadata: {
            consultationId,
            role: data.role,
          },
        },
        ['in_app']
      );
    }

    return participant;
  }

  /**
   * Remove a consulting doctor from a consultation
   */
  async removeParticipant(consultationId: string, doctorId: string, hospitalId: string) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: consultationId },
      include: { appointment: true },
    });

    if (!consultation) {
      throw new AppError('Consultation not found', 404);
    }

    if (consultation.appointment.hospitalId !== hospitalId) {
      throw new AppError('Unauthorized', 403);
    }

    return prisma.consultationParticipant.delete({
      where: {
        consultationId_doctorId: {
          consultationId,
          doctorId,
        },
      },
    });
  }

  /**
   * Record participant's departure from consultation
   */
  async participantLeft(consultationId: string, doctorId: string, hospitalId: string, notes?: string) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: consultationId },
      include: { appointment: true },
    });

    if (!consultation) {
      throw new AppError('Consultation not found', 404);
    }

    if (consultation.appointment.hospitalId !== hospitalId) {
      throw new AppError('Unauthorized', 403);
    }

    return prisma.consultationParticipant.update({
      where: {
        consultationId_doctorId: {
          consultationId,
          doctorId,
        },
      },
      data: {
        leftAt: new Date(),
        notes: notes || undefined,
      },
    });
  }

  /**
   * Get all participants for a consultation
   */
  async getParticipants(consultationId: string) {
    return prisma.consultationParticipant.findMany({
      where: { consultationId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }
}

export const consultationService = new ConsultationService();
