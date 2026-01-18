import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

const router = Router();

// All clinician routes require authentication and appropriate role
router.use(authenticate);
router.use(authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'));

// =============================================================================
// PATIENT ROSTER
// =============================================================================

// Get patient roster (patients with health data)
// GET /api/v1/clinician/patients
router.get(
  '/patients',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, hasGenomic, hasWearable, limit = '50', offset = '0' } = req.query;
    const hospitalId = req.user!.hospitalId;

    const where: any = { hospitalId };

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { mrn: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Filter by data availability
    if (hasGenomic === 'true') {
      where.genomicProfile = { isNot: null };
    }
    if (hasWearable === 'true') {
      where.healthDataPoints = { some: {} };
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
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

    sendSuccess(res, {
      patients,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    }, 'Patient roster retrieved');
  })
);

// =============================================================================
// PATIENT HEALTH SUMMARY
// =============================================================================

// Get comprehensive health summary for a patient
// GET /api/v1/clinician/patients/:patientId/summary
router.get(
  '/patients/:patientId/summary',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const hospitalId = req.user!.hospitalId;

    // Verify patient belongs to same hospital
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId,
      },
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
      return sendError(res, 'Patient not found', 404);
    }

    // Get recent health data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      recentHealthData,
      recentScores,
      activeRecommendations,
      recentLabResults,
    ] = await Promise.all([
      // Recent health data points (aggregated)
      prisma.healthDataPoint.findMany({
        where: {
          patientId,
          timestamp: { gte: sevenDaysAgo },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
      // Recent health scores
      prisma.dailyHealthScore.findMany({
        where: {
          patientId,
          date: { gte: sevenDaysAgo },
        },
        orderBy: { date: 'desc' },
      }),
      // Active recommendations
      prisma.recommendation.findMany({
        where: {
          patientId,
          status: 'ACTIVE',
          validUntil: { gte: new Date() },
        },
        orderBy: { priority: 'desc' },
      }),
      // Recent lab results
      prisma.labOrder.findMany({
        where: {
          patientId,
          status: 'COMPLETED',
          completedAt: { gte: sevenDaysAgo },
        },
        include: {
          tests: {
            include: {
              labTest: true,
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 10,
      }),
    ]);

    // Aggregate health metrics by type
    const healthMetricsSummary: Record<string, any> = {};
    for (const point of recentHealthData) {
      if (!healthMetricsSummary[point.dataType]) {
        healthMetricsSummary[point.dataType] = {
          values: [],
          unit: point.unit,
        };
      }
      healthMetricsSummary[point.dataType].values.push({
        value: point.value,
        timestamp: point.timestamp,
      });
    }

    // Calculate aggregations
    const healthMetrics = Object.entries(healthMetricsSummary).map(([type, data]: [string, any]) => ({
      type,
      unit: data.unit,
      latest: data.values[0],
      avg: data.values.reduce((sum: number, v: any) => sum + v.value, 0) / data.values.length,
      min: Math.min(...data.values.map((v: any) => v.value)),
      max: Math.max(...data.values.map((v: any) => v.value)),
      count: data.values.length,
    }));

    // Calculate overall trend
    let overallTrend = 'STABLE';
    if (recentScores.length >= 3) {
      const recentAvg = recentScores.slice(0, 3).reduce((sum, s) => sum + s.overall, 0) / 3;
      const olderAvg = recentScores.slice(-3).reduce((sum, s) => sum + s.overall, 0) / Math.min(3, recentScores.length);
      if (recentAvg > olderAvg + 5) overallTrend = 'IMPROVING';
      else if (recentAvg < olderAvg - 5) overallTrend = 'DECLINING';
    }

    sendSuccess(res, {
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
    }, 'Patient health summary retrieved');
  })
);

// =============================================================================
// HEALTH EVENT TIMELINE
// =============================================================================

// Get patient health event timeline
// GET /api/v1/clinician/patients/:patientId/timeline
router.get(
  '/patients/:patientId/timeline',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const { days = '30' } = req.query;
    const hospitalId = req.user!.hospitalId;

    // Verify patient belongs to same hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      return sendError(res, 'Patient not found', 404);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Gather timeline events from various sources
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
        title: `Lab Order #${l.orderNumber}`,
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

    sendSuccess(res, {
      events,
      totalEvents: events.length,
      period: parseInt(days as string),
    }, 'Timeline retrieved');
  })
);

// =============================================================================
// CLINICIAN NOTES
// =============================================================================

const createNoteSchema = z.object({
  body: z.object({
    noteType: z.enum(['GENERAL', 'GENOMIC_REVIEW', 'WEARABLE_REVIEW', 'LAB_INTERPRETATION', 'RECOMMENDATION_OVERRIDE', 'CARE_PLAN']),
    content: z.string().min(1),
    isPrivate: z.boolean().optional(),
  }),
});

// Add clinical note to patient's health summary
// POST /api/v1/clinician/patients/:patientId/notes
router.post(
  '/patients/:patientId/notes',
  validate(createNoteSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const { noteType, content, isPrivate = false } = req.body;
    const hospitalId = req.user!.hospitalId;

    // Verify patient belongs to same hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      return sendError(res, 'Patient not found', 404);
    }

    const note = await prisma.clinicianHealthNote.create({
      data: {
        patientId,
        hospitalId,
        clinicianId: req.user!.userId,
        noteType: noteType as any,
        content,
        isPrivate,
      },
      include: {
        clinician: { select: { firstName: true, lastName: true } },
      },
    });

    sendCreated(res, note, 'Clinical note added');
  })
);

// Get clinical notes for a patient
// GET /api/v1/clinician/patients/:patientId/notes
router.get(
  '/patients/:patientId/notes',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const { noteType, limit = '20', offset = '0' } = req.query;
    const hospitalId = req.user!.hospitalId;

    // Verify patient belongs to same hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      return sendError(res, 'Patient not found', 404);
    }

    const where: any = { patientId };
    if (noteType) where.noteType = noteType;

    const [notes, total] = await Promise.all([
      prisma.clinicianHealthNote.findMany({
        where,
        include: {
          clinician: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.clinicianHealthNote.count({ where }),
    ]);

    sendSuccess(res, {
      notes,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    }, 'Clinical notes retrieved');
  })
);

// =============================================================================
// ALERTS (Critical values, abnormal readings)
// =============================================================================

// Get critical value alerts
// GET /api/v1/clinician/alerts
router.get(
  '/alerts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user!.hospitalId;
    const { acknowledged = 'false' } = req.query;

    // Find patients with concerning health data in last 24 hours
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

    // Get recent health data points
    const recentData = await prisma.healthDataPoint.findMany({
      where: {
        hospital: { id: hospitalId },
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

    // Check for critical values
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
        let alertType = 'CRITICAL';
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
          alertType,
          dataType: point.dataType,
          value: point.value,
          unit: point.unit,
          timestamp: point.timestamp,
          message,
        };
      });

    sendSuccess(res, {
      alerts,
      totalAlerts: alerts.length,
    }, 'Alerts retrieved');
  })
);

// =============================================================================
// REPORT GENERATION
// =============================================================================

// Generate PDF report for patient health summary
// POST /api/v1/clinician/reports/generate
router.post(
  '/reports/generate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, reportType = 'summary' } = req.body;
    const hospitalId = req.user!.hospitalId;

    // Verify patient belongs to same hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      return sendError(res, 'Patient not found', 404);
    }

    // TODO: Implement PDF generation using puppeteer or similar
    // For now, return stub response

    sendSuccess(res, {
      status: 'queued',
      reportType,
      patientId,
      message: 'Report generation queued. Download link will be available shortly.',
    }, 'Report generation queued');
  })
);

export default router;
