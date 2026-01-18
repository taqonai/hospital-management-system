import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { ClinicianNoteType } from '@prisma/client';

/**
 * Clinician Service
 * Handles clinician dashboard functionality:
 * - Patient roster management
 * - Health summary generation
 * - Alert monitoring
 * - Clinical note management
 */
export class ClinicianService {
  /**
   * Get patient roster with health data availability indicators
   */
  async getPatientRoster(
    hospitalId: string,
    options: {
      search?: string;
      hasGenomic?: boolean;
      hasWearable?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const where: any = { hospitalId };

    if (options.search) {
      where.OR = [
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
        { mrn: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options.hasGenomic) {
      where.genomicProfile = { isNot: null };
    }

    if (options.hasWearable) {
      where.healthDataPoints = { some: {} };
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        take: options.limit || 50,
        skip: options.offset || 0,
        select: {
          id: true,
          mrn: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          phone: true,
          email: true,
          photo: true,
          _count: {
            select: {
              healthDataPoints: true,
              recommendations: true,
              dailyHealthScores: true,
            },
          },
          genomicProfile: {
            select: {
              id: true,
              status: true,
              processedAt: true,
            },
          },
          healthDeviceConnections: {
            where: { isActive: true },
            select: {
              provider: true,
              lastSyncAt: true,
            },
          },
        },
        orderBy: { lastName: 'asc' },
      }),
      prisma.patient.count({ where }),
    ]);

    return { patients, total };
  }

  /**
   * Get comprehensive health summary for a patient
   */
  async getPatientSummary(patientId: string, hospitalId: string) {
    // Verify patient belongs to hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
      include: {
        medicalHistory: true,
        allergies: true,
        genomicProfile: {
          include: {
            markers: true,
            riskScores: true,
          },
        },
        healthDeviceConnections: {
          where: { isActive: true },
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      recentHealthData,
      recentScores,
      activeRecommendations,
      recentLabResults,
    ] = await Promise.all([
      prisma.healthDataPoint.findMany({
        where: {
          patientId,
          timestamp: { gte: sevenDaysAgo },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
      prisma.dailyHealthScore.findMany({
        where: {
          patientId,
          date: { gte: sevenDaysAgo },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.recommendation.findMany({
        where: {
          patientId,
          status: 'ACTIVE',
          validUntil: { gte: new Date() },
        },
        orderBy: { priority: 'desc' },
      }),
      prisma.labOrder.findMany({
        where: {
          patientId,
          status: 'COMPLETED',
          completedAt: { gte: sevenDaysAgo },
        },
        include: {
          tests: {
            include: { labTest: true },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 10,
      }),
    ]);

    // Aggregate health metrics
    const healthMetrics = this.aggregateHealthMetrics(recentHealthData);

    // Calculate trend
    const overallTrend = this.calculateTrend(recentScores);

    return {
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        name: `${patient.firstName} ${patient.lastName}`,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
      },
      medicalHistory: patient.medicalHistory,
      allergies: patient.allergies,
      genomicProfile: patient.genomicProfile,
      connectedDevices: patient.healthDeviceConnections,
      healthMetrics,
      healthScores: recentScores,
      overallTrend,
      activeRecommendations,
      recentLabResults,
    };
  }

  /**
   * Get health event timeline for a patient
   */
  async getPatientTimeline(patientId: string, hospitalId: string, days: number = 30) {
    // Verify patient belongs to hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      appointments,
      labOrders,
      recommendations,
      healthScores,
      clinicianNotes,
    ] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          patientId,
          appointmentDate: { gte: startDate },
        },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { appointmentDate: 'desc' },
      }),
      prisma.labOrder.findMany({
        where: {
          patientId,
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recommendation.findMany({
        where: {
          patientId,
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dailyHealthScore.findMany({
        where: {
          patientId,
          date: { gte: startDate },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.clinicianHealthNote.findMany({
        where: {
          patientId,
          createdAt: { gte: startDate },
        },
        include: {
          clinician: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Build timeline events
    const events = this.buildTimelineEvents(
      appointments,
      labOrders,
      recommendations,
      healthScores,
      clinicianNotes
    );

    return {
      events,
      totalEvents: events.length,
      period: days,
    };
  }

  /**
   * Add a clinical note to patient's health summary
   */
  async addClinicalNote(
    patientId: string,
    hospitalId: string,
    clinicianId: string,
    noteType: ClinicianNoteType,
    content: string,
    isPrivate: boolean = false
  ) {
    // Verify patient belongs to hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return prisma.clinicianHealthNote.create({
      data: {
        patientId,
        hospitalId,
        clinicianId,
        noteType,
        content,
        isPrivate,
      },
      include: {
        clinician: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Get clinical notes for a patient
   */
  async getClinicalNotes(
    patientId: string,
    hospitalId: string,
    options: {
      noteType?: ClinicianNoteType;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    // Verify patient belongs to hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const where: any = { patientId };
    if (options.noteType) {
      where.noteType = options.noteType;
    }

    const [notes, total] = await Promise.all([
      prisma.clinicianHealthNote.findMany({
        where,
        include: {
          clinician: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 20,
        skip: options.offset || 0,
      }),
      prisma.clinicianHealthNote.count({ where }),
    ]);

    return { notes, total };
  }

  /**
   * Get critical value alerts for a hospital
   */
  async getAlerts(hospitalId: string) {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Define critical thresholds
    const criticalThresholds: Record<string, { min?: number; max?: number }> = {
      'HEART_RATE': { min: 40, max: 150 },
      'BLOOD_OXYGEN': { min: 90 },
      'BLOOD_PRESSURE_SYSTOLIC': { min: 80, max: 180 },
      'BLOOD_PRESSURE_DIASTOLIC': { min: 50, max: 120 },
      'BLOOD_GLUCOSE': { min: 50, max: 300 },
      'BODY_TEMPERATURE': { min: 35, max: 39 },
    };

    const recentData = await prisma.healthDataPoint.findMany({
      where: {
        hospitalId,
        timestamp: { gte: oneDayAgo },
        dataType: { in: Object.keys(criticalThresholds) as any[] },
      },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    const alerts = recentData
      .filter(point => {
        const threshold = criticalThresholds[point.dataType];
        if (!threshold) return false;
        if (threshold.min && point.value < threshold.min) return true;
        if (threshold.max && point.value > threshold.max) return true;
        return false;
      })
      .map(point => {
        const threshold = criticalThresholds[point.dataType];
        let message = '';

        if (threshold?.min && point.value < threshold.min) {
          message = `${point.dataType.replace(/_/g, ' ')} critically low: ${point.value} ${point.unit}`;
        } else if (threshold?.max && point.value > threshold.max) {
          message = `${point.dataType.replace(/_/g, ' ')} critically high: ${point.value} ${point.unit}`;
        }

        return {
          id: point.id,
          patientId: point.patient.id,
          patientName: `${point.patient.firstName} ${point.patient.lastName}`,
          patientMrn: point.patient.mrn,
          alertType: 'CRITICAL',
          dataType: point.dataType,
          value: point.value,
          unit: point.unit,
          timestamp: point.timestamp,
          message,
        };
      });

    return { alerts, totalAlerts: alerts.length };
  }

  /**
   * Helper: Aggregate health metrics by type
   */
  private aggregateHealthMetrics(data: any[]) {
    const aggregations: Record<string, any> = {};

    for (const point of data) {
      if (!aggregations[point.dataType]) {
        aggregations[point.dataType] = {
          values: [],
          unit: point.unit,
        };
      }
      aggregations[point.dataType].values.push({
        value: point.value,
        timestamp: point.timestamp,
      });
    }

    return Object.entries(aggregations).map(([type, data]: [string, any]) => ({
      type,
      unit: data.unit,
      latest: data.values[0],
      avg: data.values.reduce((sum: number, v: any) => sum + v.value, 0) / data.values.length,
      min: Math.min(...data.values.map((v: any) => v.value)),
      max: Math.max(...data.values.map((v: any) => v.value)),
      count: data.values.length,
    }));
  }

  /**
   * Helper: Calculate health score trend
   */
  private calculateTrend(scores: any[]) {
    if (scores.length < 3) return 'INSUFFICIENT_DATA';

    const recentAvg = scores.slice(0, 3).reduce((sum: number, s: any) => sum + s.overall, 0) / 3;
    const olderAvg = scores.slice(-3).reduce((sum: number, s: any) => sum + s.overall, 0) / Math.min(3, scores.length);

    if (recentAvg > olderAvg + 5) return 'IMPROVING';
    if (recentAvg < olderAvg - 5) return 'DECLINING';
    return 'STABLE';
  }

  /**
   * Helper: Build timeline events from various sources
   */
  private buildTimelineEvents(
    appointments: any[],
    labOrders: any[],
    recommendations: any[],
    healthScores: any[],
    clinicianNotes: any[]
  ) {
    const events: any[] = [];

    appointments.forEach(a => {
      events.push({
        type: 'APPOINTMENT',
        date: a.appointmentDate,
        title: `Appointment with Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName}`,
        status: a.status,
        data: a,
      });
    });

    labOrders.forEach(l => {
      events.push({
        type: 'LAB_ORDER',
        date: l.createdAt,
        title: `Lab Order: ${l.testType || 'Tests'}`,
        status: l.status,
        data: l,
      });
    });

    recommendations.forEach(r => {
      events.push({
        type: 'RECOMMENDATION',
        date: r.createdAt,
        title: r.title,
        category: r.category,
        priority: r.priority,
        status: r.status,
        data: r,
      });
    });

    healthScores.forEach(s => {
      events.push({
        type: 'HEALTH_SCORE',
        date: s.date,
        title: `Health Score: ${s.overall}/100`,
        trend: s.trend,
        data: s,
      });
    });

    clinicianNotes.forEach(n => {
      events.push({
        type: 'CLINICIAN_NOTE',
        date: n.createdAt,
        title: `Note by ${n.clinician.firstName} ${n.clinician.lastName}`,
        noteType: n.noteType,
        data: n,
      });
    });

    // Sort by date descending
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return events;
  }
}

export const clinicianService = new ClinicianService();
