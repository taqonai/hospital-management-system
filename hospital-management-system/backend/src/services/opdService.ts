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

  // Get unified booking ticket with all related clinical data
  async getBookingTicket(appointmentId: string, hospitalId: string) {
    const appointmentData = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        patient: {
          include: {
            allergies: true,
            medicalHistory: true,
          },
        },
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { id: true, name: true } },
          },
        },
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        consultation: {
          include: {
            labOrders: {
              include: {
                tests: {
                  include: {
                    labTest: { select: { id: true, name: true, category: true } },
                  },
                },
              },
              orderBy: { orderedAt: 'desc' },
            },
            prescriptions: {
              include: {
                medications: true,
              },
            },
            imagingOrders: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        clinicalNotes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            author: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!appointmentData) {
      throw new NotFoundError('Appointment not found');
    }

    // Type assertion for nested relations
    const appointment = appointmentData as typeof appointmentData & {
      patient: {
        id: string;
        firstName: string;
        lastName: string;
        mrn: string;
        phone: string;
        email: string | null;
        dateOfBirth: Date;
        gender: string;
        bloodGroup: string | null;
        allergies: Array<{ id: string; allergen: string; severity: string; reaction: string | null }>;
        medicalHistory: { conditions: string[]; surgeries: string[] } | null;
      };
      doctor: {
        id: string;
        specialization: string;
        user: { firstName: string; lastName: string };
        department: { id: string; name: string } | null;
      };
      vitals: Array<{ recordedBy: string; bloodPressureSys: number | null; bloodPressureDia: number | null; heartRate: number | null; temperature: number | null; respiratoryRate: number | null; oxygenSaturation: number | null; weight: number | null; height: number | null; bmi: number | null; painLevel: number | null; bloodGlucose: number | null; recordedAt: Date }>;
      consultation: {
        id: string;
        chiefComplaint: string | null;
        historyOfIllness: string | null;
        examination: string | null;
        diagnosis: string[];
        icdCodes: string[];
        treatmentPlan: string | null;
        advice: string | null;
        followUpDate: Date | null;
        prescriptions: Array<{ medications: Array<{ name: string; dosage: string; frequency: string; duration: string; quantity: number; instructions: string | null }> }>;
        labOrders: Array<{ id: string; orderNumber: string; status: string; priority: string; orderedAt: Date; completedAt: Date | null; tests: Array<{ id: string; status: string; result: string | null; resultValue: number | null; unit: string | null; normalRange: string | null; isAbnormal: boolean; isCritical: boolean; comments: string | null; performedAt: Date | null; labTest: { id: string; name: string; category: string } }> }>;
        imagingOrders: Array<{ id: string; orderNumber: string; modalityType: string; bodyPart: string; priority: string; status: string }>;
        createdAt: Date;
      } | null;
      clinicalNotes: Array<{ id: string; noteType: string; subjective: string | null; objective: string | null; assessment: string | null; plan: string | null; createdAt: Date; author: { firstName: string; lastName: string } }>;
    };

    // Fetch latest AI risk prediction for this patient
    const riskPrediction = await prisma.aIPrediction.findFirst({
      where: { patientId: appointment.patientId },
      orderBy: { createdAt: 'desc' },
    });

    // Build timeline of events
    const timeline: Array<{ timestamp: Date; event: string; actor?: string; details?: string }> = [];

    // Add appointment creation
    timeline.push({
      timestamp: appointment.createdAt,
      event: 'APPOINTMENT_CREATED',
      details: `${appointment.type} appointment scheduled`,
    });

    // Add check-in if occurred
    if (appointment.checkedInAt) {
      timeline.push({
        timestamp: appointment.checkedInAt,
        event: 'CHECKED_IN',
        details: `Token #${appointment.tokenNumber} assigned`,
      });
    }

    // Add vitals recording if occurred
    if (appointment.vitalsRecordedAt && appointment.vitals[0]) {
      timeline.push({
        timestamp: appointment.vitalsRecordedAt,
        event: 'VITALS_RECORDED',
        actor: appointment.vitals[0].recordedBy,
        details: 'Pre-consultation vitals recorded',
      });
    }

    // Add consultation if exists
    if (appointment.consultation) {
      timeline.push({
        timestamp: appointment.consultation.createdAt,
        event: 'CONSULTATION_STARTED',
        details: appointment.consultation.chiefComplaint || 'Consultation in progress',
      });

      // Add lab orders
      for (const labOrder of appointment.consultation.labOrders) {
        timeline.push({
          timestamp: labOrder.orderedAt,
          event: 'LAB_ORDERED',
          details: `${labOrder.tests.length} test(s) ordered - ${labOrder.status}`,
        });
      }
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      appointment: {
        id: appointment.id,
        tokenNumber: appointment.tokenNumber,
        status: appointment.status,
        type: appointment.type,
        appointmentDate: appointment.appointmentDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        reason: appointment.reason,
        notes: appointment.notes,
        checkedInAt: appointment.checkedInAt,
        vitalsRecordedAt: appointment.vitalsRecordedAt,
        isFollowUp: appointment.isFollowUp,
        parentAppointmentId: appointment.parentAppointmentId,
        createdAt: appointment.createdAt,
      },
      patient: {
        id: appointment.patient.id,
        firstName: appointment.patient.firstName,
        lastName: appointment.patient.lastName,
        mrn: appointment.patient.mrn,
        phone: appointment.patient.phone,
        email: appointment.patient.email,
        dateOfBirth: appointment.patient.dateOfBirth,
        gender: appointment.patient.gender,
        bloodGroup: appointment.patient.bloodGroup,
        allergies: appointment.patient.allergies,
        medicalHistory: appointment.patient.medicalHistory,
      },
      doctor: {
        id: appointment.doctor.id,
        firstName: appointment.doctor.user.firstName,
        lastName: appointment.doctor.user.lastName,
        specialization: appointment.doctor.specialization,
        department: appointment.doctor.department,
      },
      vitals: appointment.vitals[0] || null,
      riskPrediction: riskPrediction ? {
        riskScore: riskPrediction.riskScore,
        riskLevel: riskPrediction.riskLevel,
        predictionType: riskPrediction.predictionType,
        factors: riskPrediction.factors,
        recommendations: riskPrediction.recommendations,
        createdAt: riskPrediction.createdAt,
      } : null,
      consultation: appointment.consultation ? {
        id: appointment.consultation.id,
        chiefComplaint: appointment.consultation.chiefComplaint,
        historyOfIllness: appointment.consultation.historyOfIllness,
        examination: appointment.consultation.examination,
        diagnosis: appointment.consultation.diagnosis,
        icdCodes: appointment.consultation.icdCodes,
        treatmentPlan: appointment.consultation.treatmentPlan,
        advice: appointment.consultation.advice,
        followUpDate: appointment.consultation.followUpDate,
        prescriptions: appointment.consultation.prescriptions,
        createdAt: appointment.consultation.createdAt,
      } : null,
      labOrders: appointment.consultation?.labOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        priority: order.priority,
        orderedAt: order.orderedAt,
        completedAt: order.completedAt,
        tests: order.tests.map(test => ({
          id: test.id,
          name: test.labTest.name,
          category: test.labTest.category,
          status: test.status,
          result: test.result,
          resultValue: test.resultValue,
          unit: test.unit,
          normalRange: test.normalRange,
          isAbnormal: test.isAbnormal,
          isCritical: test.isCritical,
          comments: test.comments,
          performedAt: test.performedAt,
        })),
      })) || [],
      imagingOrders: appointment.consultation?.imagingOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        modalityType: order.modalityType,
        bodyPart: order.bodyPart,
        status: order.status,
        priority: order.priority,
        orderedAt: order.createdAt,
      })) || [],
      clinicalNotes: appointment.clinicalNotes.map(note => ({
        id: note.id,
        noteType: note.noteType,
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
        status: note.status,
        author: note.author ? `${note.author.firstName} ${note.author.lastName}` : null,
        createdAt: note.createdAt,
      })),
      timeline,
    };
  }

  // Get patient's booking history for follow-up context
  async getPatientBookingHistory(patientId: string, hospitalId: string, limit: number = 10) {
    // Verify patient belongs to hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        hospitalId,
        status: 'COMPLETED',
      },
      orderBy: { appointmentDate: 'desc' },
      take: limit,
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
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
            icdCodes: true,
            treatmentPlan: true,
            followUpDate: true,
            prescriptions: {
              include: { medications: true },
            },
            labOrders: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                tests: {
                  select: {
                    labTest: { select: { name: true } },
                    result: true,
                    isAbnormal: true,
                    isCritical: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
      },
      bookings: appointments.map(apt => ({
        id: apt.id,
        appointmentDate: apt.appointmentDate,
        type: apt.type,
        doctor: {
          name: `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`,
          specialization: apt.doctor.specialization,
          department: apt.doctor.department?.name || null,
        },
        vitals: apt.vitals[0] ? {
          bloodPressureSys: apt.vitals[0].bloodPressureSys,
          bloodPressureDia: apt.vitals[0].bloodPressureDia,
          heartRate: apt.vitals[0].heartRate,
          temperature: apt.vitals[0].temperature,
          oxygenSaturation: apt.vitals[0].oxygenSaturation,
          weight: apt.vitals[0].weight,
          recordedAt: apt.vitals[0].recordedAt,
        } : null,
        consultation: apt.consultation ? {
          chiefComplaint: apt.consultation.chiefComplaint,
          diagnosis: apt.consultation.diagnosis,
          icdCodes: apt.consultation.icdCodes,
          treatmentPlan: apt.consultation.treatmentPlan,
          followUpDate: apt.consultation.followUpDate,
          prescriptionCount: apt.consultation.prescriptions.length,
          labOrderCount: apt.consultation.labOrders.length,
          labResults: apt.consultation.labOrders.flatMap(order =>
            order.tests.map(test => ({
              testName: test.labTest.name,
              result: test.result,
              isAbnormal: test.isAbnormal,
              isCritical: test.isCritical,
            }))
          ),
        } : null,
      })),
    };
  }
}

export const opdService = new OPDService();
