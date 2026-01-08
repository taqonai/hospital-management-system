import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';
import { RiskLevel } from '@prisma/client';
import { earlyWarningService } from './earlyWarningService';

interface VitalsData {
  temperature?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bloodSugar?: number;
  painLevel?: number;
  notes?: string;
}

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
      select: {
        id: true,
        tokenNumber: true,
        status: true,
        vitalsRecordedAt: true,
        appointmentDate: true,
        startTime: true,
        endTime: true,
        type: true,
        reason: true,
        notes: true,
        checkedInAt: true,
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

  // Pre-Consultation Vitals Recording
  async recordVitals(
    appointmentId: string,
    hospitalId: string,
    vitalsData: VitalsData,
    recordedBy: string
  ) {
    // Verify appointment exists and belongs to hospital
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // Calculate BMI if weight and height are provided
    let bmi: number | undefined;
    if (vitalsData.weight && vitalsData.height) {
      const heightInMeters = vitalsData.height / 100; // assuming height is in cm
      bmi = Number((vitalsData.weight / (heightInMeters * heightInMeters)).toFixed(1));
    }

    // Create vital record linked to the appointment
    const vital = await prisma.vital.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: appointmentId,
        temperature: vitalsData.temperature ? new Decimal(vitalsData.temperature) : null,
        bloodPressureSys: vitalsData.bloodPressureSys || null,
        bloodPressureDia: vitalsData.bloodPressureDia || null,
        heartRate: vitalsData.heartRate || null,
        respiratoryRate: vitalsData.respiratoryRate || null,
        oxygenSaturation: vitalsData.oxygenSaturation ? new Decimal(vitalsData.oxygenSaturation) : null,
        weight: vitalsData.weight ? new Decimal(vitalsData.weight) : null,
        height: vitalsData.height ? new Decimal(vitalsData.height) : null,
        bmi: bmi ? new Decimal(bmi) : null,
        bloodSugar: vitalsData.bloodSugar ? new Decimal(vitalsData.bloodSugar) : null,
        painLevel: vitalsData.painLevel || null,
        notes: vitalsData.notes || null,
        recordedBy,
      },
    });

    // Calculate risk assessment using Early Warning Service
    let riskAssessment = null;
    try {
      // Only calculate if we have enough vitals data for meaningful assessment
      if (vitalsData.heartRate || vitalsData.bloodPressureSys || vitalsData.respiratoryRate) {
        // Build vitals input for EWS calculation
        const vitalsInput = {
          respiratoryRate: vitalsData.respiratoryRate,
          oxygenSaturation: vitalsData.oxygenSaturation,
          temperature: vitalsData.temperature,
          systolicBP: vitalsData.bloodPressureSys,
          diastolicBP: vitalsData.bloodPressureDia,
          heartRate: vitalsData.heartRate,
        };

        // Get recent vitals history for trend analysis
        const vitalsHistory = await prisma.vital.findMany({
          where: { patientId: appointment.patientId },
          orderBy: { recordedAt: 'desc' },
          take: 10,
        });

        // Perform comprehensive assessment (NEWS2 + qSOFA + Fall Risk)
        riskAssessment = await earlyWarningService.comprehensiveAssessment(
          vitalsInput,
          vitalsHistory.map(v => ({
            respiratoryRate: v.respiratoryRate,
            oxygenSaturation: v.oxygenSaturation ? Number(v.oxygenSaturation) : undefined,
            temperature: v.temperature ? Number(v.temperature) : undefined,
            systolicBP: v.bloodPressureSys,
            heartRate: v.heartRate,
            timestamp: v.recordedAt,
          }))
        );

        // Create AIPrediction record with risk assessment
        if (riskAssessment) {
          const riskLevelMap: Record<string, RiskLevel> = {
            low: RiskLevel.LOW,
            moderate: RiskLevel.MODERATE,
            high: RiskLevel.HIGH,
            critical: RiskLevel.CRITICAL,
          };

          const riskLevel = riskLevelMap[riskAssessment.riskLevel?.toLowerCase()] || RiskLevel.LOW;

          await prisma.aIPrediction.create({
            data: {
              patientId: appointment.patientId,
              predictionType: 'DETERIORATION',
              riskScore: new Decimal(riskAssessment.deteriorationProbability || 0),
              riskLevel,
              factors: riskAssessment.recommendedActions || [],
              recommendations: riskAssessment.recommendedActions || [],
              modelVersion: riskAssessment.modelVersion || 'NEWS2-v1.0',
            },
          });
        }
      }
    } catch (error) {
      // Log but don't fail vitals recording if risk calculation fails
      console.error('Risk assessment calculation failed:', error);
    }

    // Update appointment to mark vitals as recorded
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { vitalsRecordedAt: new Date() },
    });

    return {
      vital,
      appointment: {
        id: appointment.id,
        patient: appointment.patient,
        doctor: appointment.doctor,
        vitalsRecordedAt: new Date(),
      },
      riskAssessment: riskAssessment ? {
        news2Score: riskAssessment.news2Score,
        riskLevel: riskAssessment.riskLevel,
        deteriorationProbability: riskAssessment.deteriorationProbability,
        sepsisRisk: riskAssessment.sepsisRisk,
        fallRisk: riskAssessment.fallRisk,
        recommendedActions: riskAssessment.recommendedActions,
        escalationRequired: riskAssessment.escalationRequired,
      } : null,
    };
  }

  // Get vitals for an appointment
  async getAppointmentVitals(appointmentId: string, hospitalId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    return {
      appointment: {
        id: appointment.id,
        patientId: appointment.patientId,
        vitalsRecordedAt: appointment.vitalsRecordedAt,
      },
      patient: appointment.patient,
      vitals: appointment.vitals[0] || null,
    };
  }
}

export const opdService = new OPDService();
