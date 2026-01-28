import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { LabOrderStatus, AppointmentType } from '@prisma/client';
import { getTodayDateUAE, getTodayInUAE, getCurrentTimeMinutesUAE } from '../utils/timezone';

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

    // Normalize to start of day for date comparisons (UAE timezone)
    const startOfToday = getTodayDateUAE();

    // Define upcoming appointments filter
    const upcomingFilter = {
      patientId,
      hospitalId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] as ('SCHEDULED' | 'CONFIRMED')[] },
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
      upcomingAppointments: upcomingAppointments.map((apt: any) => ({
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
        date: (nextAppointment as any).appointmentDate,
        time: (nextAppointment as any).startTime,
        doctorName: (nextAppointment as any).doctor ? `Dr. ${(nextAppointment as any).doctor.user.firstName} ${(nextAppointment as any).doctor.user.lastName}` : 'TBD',
      } : null,
      activePrescriptions,
      pendingLabResults,
      recentActivity: [],
      healthReminders: ['Stay healthy! Keep up with regular checkups.'],
      unreadMessages: 0,
    };
  }

  /**
   * Get appointment by ID
   */
  async getAppointmentById(hospitalId: string, patientId: string, appointmentId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId, hospitalId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { id: true, name: true } },
          },
        },
        patient: {
          select: { firstName: true, lastName: true, mrn: true },
        },
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        consultation: {
          select: {
            id: true,
            chiefComplaint: true,
            diagnosis: true,
            notes: true,
            createdAt: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    return {
      id: appointment.id,
      appointmentDate: appointment.appointmentDate,
      date: appointment.appointmentDate,
      startTime: appointment.startTime,
      time: appointment.startTime,
      endTime: appointment.endTime,
      type: appointment.type,
      reason: appointment.reason,
      status: appointment.status,
      notes: appointment.notes,
      tokenNumber: appointment.tokenNumber,
      checkedInAt: appointment.checkedInAt,
      createdAt: appointment.createdAt,
      doctor: appointment.doctor ? {
        id: appointment.doctor.id,
        name: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
        specialization: appointment.doctor.specialization || '',
        department: appointment.doctor.department ? {
          id: appointment.doctor.department.id,
          name: appointment.doctor.department.name,
        } : null,
      } : null,
      vitals: appointment.vitals[0] ? {
        bloodPressure: appointment.vitals[0].bloodPressureSys && appointment.vitals[0].bloodPressureDia
          ? `${appointment.vitals[0].bloodPressureSys}/${appointment.vitals[0].bloodPressureDia}`
          : null,
        heartRate: appointment.vitals[0].heartRate,
        temperature: appointment.vitals[0].temperature,
        weight: appointment.vitals[0].weight,
        height: appointment.vitals[0].height,
        recordedAt: appointment.vitals[0].recordedAt,
      } : null,
      consultation: appointment.consultation ? {
        id: appointment.consultation.id,
        chiefComplaint: appointment.consultation.chiefComplaint,
        diagnosis: appointment.consultation.diagnosis,
        notes: appointment.consultation.notes,
        createdAt: appointment.consultation.createdAt,
      } : null,
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

    // Normalize to start of day for date comparisons (UAE timezone)
    const startOfToday = getTodayDateUAE();

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
    notes?: string; // Patient's additional notes from booking
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
          appointmentDate: { gte: getTodayDateUAE() },
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
          type: (data.type || 'CONSULTATION') as AppointmentType,
          reason: data.reason || 'Patient portal booking',
          notes: data.notes || null, // Patient's additional notes from booking
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
   * Get medical record by ID (consultation)
   */
  async getMedicalRecordById(hospitalId: string, patientId: string, recordId: string) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: recordId, patientId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { id: true, name: true } },
          },
        },
        appointment: {
          select: {
            id: true,
            appointmentDate: true,
            startTime: true,
            type: true,
          },
        },
        labOrders: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            tests: {
              select: {
                id: true,
                result: true,
                status: true,
                labTest: { select: { name: true, category: true } },
              },
            },
          },
        },
        prescriptions: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            medications: {
              select: {
                id: true,
                drugName: true,
                dosage: true,
                frequency: true,
                duration: true,
                instructions: true,
              },
            },
          },
        },
      },
    });

    if (!consultation) {
      throw new NotFoundError('Medical record not found');
    }

    return {
      id: consultation.id,
      type: 'Consultation',
      date: consultation.createdAt,
      provider: consultation.doctor?.user
        ? `Dr. ${consultation.doctor.user.firstName} ${consultation.doctor.user.lastName}`
        : 'Unknown',
      department: consultation.doctor?.department?.name || '',
      chiefComplaint: consultation.chiefComplaint,
      historyOfIllness: consultation.historyOfIllness,
      examination: consultation.examination,
      diagnosis: consultation.diagnosis,
      treatmentPlan: consultation.treatmentPlan,
      advice: consultation.advice,
      notes: consultation.notes,
      followUpDate: consultation.followUpDate,
      appointment: consultation.appointment ? {
        id: consultation.appointment.id,
        date: consultation.appointment.appointmentDate,
        time: consultation.appointment.startTime,
        type: consultation.appointment.type,
      } : null,
      labOrders: consultation.labOrders.map(order => ({
        id: order.id,
        status: order.status,
        date: order.createdAt,
        tests: order.tests.map(t => ({
          id: t.id,
          name: t.labTest?.name || 'Unknown Test',
          category: t.labTest?.category || '',
          result: t.result,
          status: t.status,
        })),
      })),
      prescriptions: consultation.prescriptions.map(p => ({
        id: p.id,
        status: p.status,
        date: p.createdAt,
        medications: p.medications.map(m => ({
          id: m.id,
          name: m.drugName,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions,
        })),
      })),
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
   * Get prescription by ID
   */
  async getPrescriptionById(hospitalId: string, patientId: string, prescriptionId: string) {
    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { id: true, name: true } },
          },
        },
        medications: true,
        consultation: {
          select: {
            id: true,
            diagnosis: true,
            chiefComplaint: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundError('Prescription not found');
    }

    return {
      id: prescription.id,
      prescriptionNumber: (prescription as any).prescriptionNumber || null,
      date: prescription.createdAt,
      prescriptionDate: prescription.prescriptionDate,
      status: prescription.status,
      notes: prescription.notes,
      doctor: prescription.doctor ? {
        id: prescription.doctor.id,
        name: `Dr. ${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}`,
        specialization: prescription.doctor.specialization || '',
        department: prescription.doctor.department?.name || '',
      } : null,
      consultation: prescription.consultation ? {
        id: prescription.consultation.id,
        diagnosis: prescription.consultation.diagnosis,
        chiefComplaint: prescription.consultation.chiefComplaint,
      } : null,
      medications: prescription.medications.map(m => ({
        id: m.id,
        name: m.drugName,
        drugName: m.drugName,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        quantity: m.quantity,
        route: m.route,
        instructions: m.instructions,
        beforeAfterFood: m.beforeAfterFood,
        isDispensed: m.isDispensed,
        dispensedAt: m.dispensedAt,
      })),
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
      where.status = { in: ['COMPLETED', 'RESULTED', 'VERIFIED', 'PARTIALLY_COMPLETED'] };
    } else if (filters?.status === 'pending') {
      where.status = { in: ['ORDERED', 'SAMPLE_COLLECTED', 'RECEIVED', 'IN_PROGRESS'] };
    }

    const labOrders = await prisma.labOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        tests: {
          include: {
            labTest: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
                unit: true,
                normalRange: true,
              },
            },
          },
        },
        orderedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get doctor info for each order
    const ordersWithDoctorInfo = await Promise.all(
      labOrders.map(async (order) => {
        let orderingDoctor = null;
        if (order.orderedBy) {
          const doctor = await prisma.doctor.findUnique({
            where: { id: order.orderedBy },
            select: {
              id: true,
              specialization: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          });
          if (doctor) {
            orderingDoctor = {
              id: doctor.id,
              name: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
              specialization: doctor.specialization,
            };
          }
        }

        // If no doctor found, use orderedByUser as fallback
        if (!orderingDoctor && order.orderedByUser) {
          orderingDoctor = {
            id: order.orderedByUser.id,
            name: `${order.orderedByUser.firstName} ${order.orderedByUser.lastName}`,
            specialization: 'General',
          };
        }

        // Determine test category and name for display
        const testCategories = [...new Set(order.tests.map(t => t.labTest?.category).filter(Boolean))];
        const testCategory = testCategories.length > 0 ? testCategories[0] : 'General';
        const testName = order.tests.length === 1
          ? order.tests[0].labTest?.name || 'Lab Test'
          : `${order.tests.length} Tests`;

        // Map status for frontend
        let frontendStatus: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'REVIEWED' = 'PENDING';
        // READY: Results are available (COMPLETED is set when all tests are done)
        if (order.status === 'COMPLETED' || order.status === 'RESULTED' || order.status === 'VERIFIED' || order.status === 'PARTIALLY_COMPLETED') {
          frontendStatus = 'READY';
        }
        // IN_PROGRESS: Sample collected and being processed
        else if (order.status === 'SAMPLE_COLLECTED' || order.status === 'RECEIVED' || order.status === 'IN_PROGRESS') {
          frontendStatus = 'IN_PROGRESS';
        }
        // CANCELLED: Show as pending
        else if (order.status === 'CANCELLED') {
          frontendStatus = 'PENDING';
        }

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          testDate: order.orderedAt.toISOString(),
          reportDate: order.completedAt?.toISOString(),
          status: frontendStatus,
          orderingDoctor: orderingDoctor || {
            id: 'unknown',
            name: 'Unknown',
            specialization: 'General',
          },
          testCategory,
          testName,
          specimenType: order.tests[0]?.labTest ? 'Blood' : undefined, // Default specimen type
          collectionDate: order.collectedAt?.toISOString(),
          results: order.tests.map(test => {
            const numericValue = test.resultValue !== null ? Number(test.resultValue) : null;
            return {
              id: test.id,
              testName: test.labTest?.name || 'Unknown Test',
              testCode: test.labTest?.code || '',
              value: numericValue !== null ? numericValue : (test.result || ''),
              unit: test.unit || test.labTest?.unit || '',
              normalRange: test.normalRange || test.labTest?.normalRange || '',
              status: test.isCritical
                ? (numericValue && numericValue > 0 ? 'CRITICAL_HIGH' : 'CRITICAL_LOW')
                : test.isAbnormal
                ? (numericValue && numericValue > 0 ? 'HIGH' : 'LOW')
                : 'NORMAL',
              notes: test.comments,
            };
          }),
        };
      })
    );

    return {
      data: ordersWithDoctorInfo,
      pagination: { page, limit, total: labOrders.length, totalPages: 1 },
    };
  }

  /**
   * Get lab result by ID
   */
  async getLabResultById(hospitalId: string, patientId: string, labOrderId: string) {
    const labOrder = await prisma.labOrder.findFirst({
      where: { id: labOrderId, patientId, hospitalId },
      include: {
        tests: {
          include: {
            labTest: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
                unit: true,
                normalRange: true,
                description: true,
              },
            },
          },
        },
        consultation: {
          select: {
            id: true,
            diagnosis: true,
          },
        },
        orderedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!labOrder) {
      throw new NotFoundError('Lab result not found');
    }

    // Get ordering doctor info
    let orderingDoctor = null;
    if (labOrder.orderedBy) {
      const doctor = await prisma.doctor.findUnique({
        where: { id: labOrder.orderedBy },
        select: {
          id: true,
          specialization: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });
      if (doctor) {
        orderingDoctor = {
          id: doctor.id,
          name: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
          specialization: doctor.specialization,
        };
      }
    }

    // Fallback to orderedByUser if doctor not found
    if (!orderingDoctor && labOrder.orderedByUser) {
      orderingDoctor = {
        id: labOrder.orderedByUser.id,
        name: `${labOrder.orderedByUser.firstName} ${labOrder.orderedByUser.lastName}`,
        specialization: 'General',
      };
    }

    // Map status for frontend
    let frontendStatus: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'REVIEWED' = 'PENDING';
    // READY: Results are available (COMPLETED is set when all tests are done)
    if (labOrder.status === 'COMPLETED' || labOrder.status === 'RESULTED' || labOrder.status === 'VERIFIED' || labOrder.status === 'PARTIALLY_COMPLETED') {
      frontendStatus = 'READY';
    }
    // IN_PROGRESS: Sample collected and being processed
    else if (labOrder.status === 'SAMPLE_COLLECTED' || labOrder.status === 'RECEIVED' || labOrder.status === 'IN_PROGRESS') {
      frontendStatus = 'IN_PROGRESS';
    }
    // CANCELLED: Show as pending
    else if (labOrder.status === 'CANCELLED') {
      frontendStatus = 'PENDING';
    }

    return {
      id: labOrder.id,
      orderNumber: labOrder.orderNumber,
      testDate: labOrder.orderedAt.toISOString(),
      reportDate: labOrder.completedAt?.toISOString(),
      status: frontendStatus,
      priority: labOrder.priority,
      clinicalNotes: labOrder.clinicalNotes,
      specialInstructions: labOrder.specialInstructions,
      orderedAt: labOrder.orderedAt,
      collectedAt: labOrder.collectedAt,
      completedAt: labOrder.completedAt,
      orderingDoctor: orderingDoctor || {
        id: 'unknown',
        name: 'Unknown',
        specialization: 'General',
      },
      consultation: labOrder.consultation ? {
        id: labOrder.consultation.id,
        diagnosis: labOrder.consultation.diagnosis,
      } : null,
      results: labOrder.tests.map(test => {
        const numericValue = test.resultValue !== null ? Number(test.resultValue) : null;
        return {
          id: test.id,
          testName: test.labTest?.name || 'Unknown Test',
          testCode: test.labTest?.code || '',
          value: numericValue !== null ? numericValue : (test.result || ''),
          unit: test.unit || test.labTest?.unit || '',
          normalRange: test.normalRange || test.labTest?.normalRange || '',
          status: test.isCritical
            ? (numericValue && numericValue > 0 ? 'CRITICAL_HIGH' : 'CRITICAL_LOW')
            : test.isAbnormal
            ? (numericValue && numericValue > 0 ? 'HIGH' : 'LOW')
            : 'NORMAL',
          notes: test.comments,
          isAbnormal: test.isAbnormal,
          isCritical: test.isCritical,
        };
      }),
    };
  }

  /**
   * Get billing summary
   */
  async getBillingSummary(hospitalId: string, patientId: string) {
    // Get all invoices for the patient
    const invoices = await prisma.invoice.findMany({
      where: { hospitalId, patientId },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 1,
        },
      },
    });

    // Calculate summary
    let totalDue = 0;
    let totalPaid = 0;
    let pendingBills = 0;
    let lastPaymentDate: Date | null = null;
    let lastPaymentAmount = 0;

    for (const invoice of invoices) {
      const balance = Number(invoice.balanceAmount);
      const paid = Number(invoice.paidAmount);

      if (invoice.status === 'PENDING' || invoice.status === 'PARTIALLY_PAID') {
        totalDue += balance;
        pendingBills++;
      }
      totalPaid += paid;

      // Track last payment
      if (invoice.payments.length > 0) {
        const payment = invoice.payments[0];
        if (!lastPaymentDate || payment.paymentDate > lastPaymentDate) {
          lastPaymentDate = payment.paymentDate;
          lastPaymentAmount = Number(payment.amount);
        }
      }
    }

    return {
      totalDue,
      totalPaid,
      pendingBills,
      lastPaymentDate: lastPaymentDate?.toISOString() || null,
      lastPaymentAmount,
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
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause based on filter type
    const where: any = { hospitalId, patientId };

    if (filters?.type === 'pending') {
      where.status = { in: ['PENDING', 'PARTIALLY_PAID'] };
    } else if (filters?.type === 'paid') {
      where.status = 'PAID';
    }

    // Get total count
    const total = await prisma.invoice.count({ where });

    // Get invoices with items
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { invoiceDate: 'desc' },
      skip,
      take: limit,
    });

    // Format response
    const data = invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billNumber: invoice.invoiceNumber,
      type: invoice.items[0]?.category || 'GENERAL',
      description: invoice.items.length > 0
        ? invoice.items.map(i => i.description).join(', ').substring(0, 100)
        : `Invoice #${invoice.invoiceNumber}`,
      amount: Number(invoice.totalAmount),
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount),
      balanceDue: Number(invoice.balanceAmount),
      balanceAmount: Number(invoice.balanceAmount),
      status: invoice.status,
      dueDate: invoice.dueDate?.toISOString() || invoice.invoiceDate.toISOString(),
      billDate: invoice.invoiceDate.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      items: invoice.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.totalPrice),
      })),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      tax: Number(invoice.tax),
      payments: invoice.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.paymentMethod,
        date: p.paymentDate.toISOString(),
        reference: p.referenceNumber,
      })),
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get bill by ID
   */
  async getBillById(hospitalId: string, patientId: string, billId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: billId, hospitalId, patientId },
      include: {
        items: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        patient: {
          select: { firstName: true, lastName: true, mrn: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Bill not found');
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billNumber: invoice.invoiceNumber,
      type: invoice.items[0]?.category || 'GENERAL',
      description: invoice.items.length > 0
        ? invoice.items.map(i => i.description).join(', ')
        : `Invoice #${invoice.invoiceNumber}`,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate.toISOString(),
      billDate: invoice.invoiceDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString() || invoice.invoiceDate.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      patient: invoice.patient ? {
        name: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        mrn: invoice.patient.mrn,
      } : null,
      // Financial details
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      tax: Number(invoice.tax),
      totalAmount: Number(invoice.totalAmount),
      amount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount),
      balanceAmount: Number(invoice.balanceAmount),
      balanceDue: Number(invoice.balanceAmount),
      // Line items
      items: invoice.items.map(item => ({
        id: item.id,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.totalPrice),
        totalPrice: Number(item.totalPrice),
      })),
      // Payment history
      payments: invoice.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.paymentMethod,
        paymentMethod: p.paymentMethod,
        date: p.paymentDate.toISOString(),
        paymentDate: p.paymentDate.toISOString(),
        reference: p.referenceNumber,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
      })),
      notes: invoice.notes,
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
   * Get available slots for a doctor on a specific date
   */
  async getDoctorAvailableSlots(hospitalId: string, doctorId: string, dateStr: string) {
    const slotDate = new Date(dateStr);
    slotDate.setHours(0, 0, 0, 0);

    const todayUAE = getTodayInUAE();
    const requestedDateStr = slotDate.toISOString().split('T')[0];

    // Check if date is in the past
    if (requestedDateStr < todayUAE) {
      return [];
    }

    // Get doctor with schedules
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, user: { hospitalId, isActive: true }, isAvailable: true },
      include: {
        schedules: { where: { isActive: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!doctor) {
      return [];
    }

    // Check for doctor absence on this date
    const absence = await prisma.doctorAbsence.findFirst({
      where: {
        doctorId,
        status: 'ACTIVE',
        startDate: { lte: slotDate },
        endDate: { gte: slotDate },
        isFullDay: true,
      },
    });

    if (absence) {
      return []; // Doctor is on full-day leave
    }

    // Get schedule for the day of week
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = dayNames[slotDate.getDay()];
    const schedule = doctor.schedules.find(s => s.dayOfWeek === dayOfWeek);

    if (!schedule) {
      return []; // No schedule for this day
    }

    // Parse times to minutes
    const parseTime = (time: string): number => {
      const [hours, mins] = time.split(':').map(Number);
      return hours * 60 + mins;
    };

    const formatTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const startMinutes = parseTime(schedule.startTime);
    const endMinutes = parseTime(schedule.endTime);
    const breakStartMinutes = schedule.breakStart ? parseTime(schedule.breakStart) : null;
    const breakEndMinutes = schedule.breakEnd ? parseTime(schedule.breakEnd) : null;
    const slotDuration = doctor.slotDuration || 30;

    // Get existing appointments for this date
    const startOfDay = new Date(slotDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(slotDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      select: { startTime: true },
    });

    const bookedSlots = new Set(existingAppointments.map(a => a.startTime));

    // Check for partial-day absence
    const partialAbsence = await prisma.doctorAbsence.findFirst({
      where: {
        doctorId,
        status: 'ACTIVE',
        startDate: { lte: slotDate },
        endDate: { gte: slotDate },
        isFullDay: false,
      },
    });

    let absenceStartMinutes: number | null = null;
    let absenceEndMinutes: number | null = null;
    if (partialAbsence?.startTime && partialAbsence?.endTime) {
      absenceStartMinutes = parseTime(partialAbsence.startTime);
      absenceEndMinutes = parseTime(partialAbsence.endTime);
    }

    // Generate slots
    const slots: Array<{ time: string; endTime: string; available: boolean }> = [];
    let currentTime = startMinutes;

    // For today, get current time in UAE
    const isToday = requestedDateStr === todayUAE;
    let currentTimeMinutes = 0;
    if (isToday) {
      currentTimeMinutes = getCurrentTimeMinutesUAE() + 15; // 15 minute buffer
    }

    while (currentTime + slotDuration <= endMinutes) {
      // Skip break time
      if (breakStartMinutes !== null && breakEndMinutes !== null) {
        if (currentTime >= breakStartMinutes && currentTime < breakEndMinutes) {
          currentTime = breakEndMinutes;
          continue;
        }
      }

      const slotStart = formatTime(currentTime);
      const slotEnd = formatTime(currentTime + slotDuration);

      // Check if slot is in the past for today
      if (isToday && currentTime < currentTimeMinutes) {
        currentTime += slotDuration;
        continue;
      }

      // Check if slot is already booked
      let isAvailable = !bookedSlots.has(slotStart);

      // Check if slot overlaps with partial-day absence
      if (isAvailable && absenceStartMinutes !== null && absenceEndMinutes !== null) {
        if (currentTime >= absenceStartMinutes && currentTime < absenceEndMinutes) {
          isAvailable = false;
        }
      }

      slots.push({
        time: slotStart,
        endTime: slotEnd,
        available: isAvailable,
      });

      currentTime += slotDuration;
    }

    return slots;
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
        appointmentDate: { gte: getTodayDateUAE() },
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
