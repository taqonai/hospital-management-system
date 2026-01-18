import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

const router = Router();

// =============================================================================
// PATIENT-FACING RECOMMENDATION ENDPOINTS
// =============================================================================

// Get active recommendations for the patient
// GET /api/v1/recommendations
router.get(
  '/',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { category, status = 'ACTIVE', limit = '20', offset = '0' } = req.query;
    const patient = req.patient!;

    const where: any = {
      patientId: patient.patientId,
      validUntil: { gte: new Date() },
    };

    if (status !== 'ALL') {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    const [recommendations, total] = await Promise.all([
      prisma.recommendation.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: {
          feedback: true,
        },
      }),
      prisma.recommendation.count({ where }),
    ]);

    sendSuccess(res, {
      recommendations,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    }, 'Recommendations retrieved');
  })
);

// Dismiss a recommendation
// PUT /api/v1/recommendations/:id/dismiss
router.put(
  '/:id/dismiss',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const patient = req.patient!;

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        patientId: patient.patientId,
      },
    });

    if (!recommendation) {
      return sendError(res, 'Recommendation not found', 404);
    }

    if (recommendation.status !== 'ACTIVE') {
      return sendError(res, 'Recommendation is not active', 400);
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        dismissedAt: new Date(),
      },
    });

    // Record feedback if reason provided
    if (reason) {
      await prisma.recommendationFeedback.create({
        data: {
          recommendationId: id,
          followed: false,
          comment: reason,
        },
      });
    }

    sendSuccess(res, updated, 'Recommendation dismissed');
  })
);

// Mark a recommendation as completed
// PUT /api/v1/recommendations/:id/complete
router.put(
  '/:id/complete',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const patient = req.patient!;

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        patientId: patient.patientId,
      },
    });

    if (!recommendation) {
      return sendError(res, 'Recommendation not found', 404);
    }

    if (recommendation.status !== 'ACTIVE') {
      return sendError(res, 'Recommendation is not active', 400);
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    sendSuccess(res, updated, 'Recommendation marked as completed');
  })
);

// Snooze a recommendation
// PUT /api/v1/recommendations/:id/snooze
router.put(
  '/:id/snooze',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { snoozeUntil } = req.body;
    const patient = req.patient!;

    if (!snoozeUntil) {
      return sendError(res, 'snoozeUntil date is required', 400);
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        patientId: patient.patientId,
      },
    });

    if (!recommendation) {
      return sendError(res, 'Recommendation not found', 404);
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: 'SNOOZED',
        validFrom: new Date(snoozeUntil),
      },
    });

    sendSuccess(res, updated, 'Recommendation snoozed');
  })
);

// Submit feedback on a recommendation
// POST /api/v1/recommendations/:id/feedback
router.post(
  '/:id/feedback',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { helpful, followed, rating, comment } = req.body;
    const patient = req.patient!;

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        patientId: patient.patientId,
      },
    });

    if (!recommendation) {
      return sendError(res, 'Recommendation not found', 404);
    }

    const feedback = await prisma.recommendationFeedback.create({
      data: {
        recommendationId: id,
        helpful,
        followed,
        rating,
        comment,
      },
    });

    sendCreated(res, feedback, 'Feedback submitted');
  })
);

// =============================================================================
// DAILY HEALTH SCORE
// =============================================================================

// Get daily health score
// GET /api/v1/recommendations/score
router.get(
  '/score',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { date } = req.query;
    const patient = req.patient!;

    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const score = await prisma.dailyHealthScore.findFirst({
      where: {
        patientId: patient.patientId,
        date: targetDate,
      },
    });

    if (!score) {
      // Return a placeholder score if none exists
      return sendSuccess(res, {
        date: targetDate.toISOString(),
        overall: null,
        sleep: null,
        activity: null,
        nutrition: null,
        recovery: null,
        compliance: null,
        trend: 'INSUFFICIENT_DATA',
        insights: ['Not enough data to calculate health score. Please sync your health devices.'],
        dataQuality: 0,
        message: 'No health score calculated for this date yet',
      }, 'Health score not available');
    }

    sendSuccess(res, score, 'Health score retrieved');
  })
);

// Get health score history
// GET /api/v1/recommendations/score/history
router.get(
  '/score/history',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { days = '7' } = req.query;
    const patient = req.patient!;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));
    startDate.setHours(0, 0, 0, 0);

    const scores = await prisma.dailyHealthScore.findMany({
      where: {
        patientId: patient.patientId,
        date: { gte: startDate },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate trend
    const avgScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.overall, 0) / scores.length
      : null;

    sendSuccess(res, {
      scores,
      averageScore: avgScore,
      daysWithData: scores.length,
      period: parseInt(days as string),
    }, 'Health score history retrieved');
  })
);

// =============================================================================
// RECOMMENDATION GENERATION (Trigger AI to generate new recommendations)
// =============================================================================

// Trigger recommendation generation
// POST /api/v1/recommendations/generate
router.post(
  '/generate',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patient = req.patient!;

    // Get hospital ID from patient
    const patientRecord = await prisma.patient.findUnique({
      where: { id: patient.patientId },
      select: { hospitalId: true },
    });

    if (!patientRecord) {
      return sendError(res, 'Patient not found', 404);
    }

    // TODO: Call AI service to generate recommendations
    // This would trigger the ai-services/recommendation/ service
    // For now, return stub response

    sendSuccess(res, {
      status: 'queued',
      message: 'Recommendation generation has been queued. New recommendations will appear shortly.',
    }, 'Recommendation generation queued');
  })
);

// =============================================================================
// CLINICIAN-FACING ENDPOINTS
// =============================================================================

// Get all recommendations for a specific patient (clinician view)
// GET /api/v1/recommendations/patients/:patientId
router.get(
  '/patients/:patientId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const { status, category } = req.query;

    // Verify patient belongs to same hospital
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId: req.user!.hospitalId,
      },
    });

    if (!patient) {
      return sendError(res, 'Patient not found', 404);
    }

    const where: any = { patientId };
    if (status) where.status = status;
    if (category) where.category = category;

    const recommendations = await prisma.recommendation.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        feedback: true,
      },
    });

    sendSuccess(res, recommendations, 'Patient recommendations retrieved');
  })
);

// Create a manual recommendation (clinician only)
// POST /api/v1/recommendations/patients/:patientId
router.post(
  '/patients/:patientId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const { category, priority, title, description, reasoning, validDays = 30 } = req.body;

    // Verify patient belongs to same hospital
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId: req.user!.hospitalId,
      },
    });

    if (!patient) {
      return sendError(res, 'Patient not found', 404);
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const recommendation = await prisma.recommendation.create({
      data: {
        patientId,
        hospitalId: req.user!.hospitalId,
        category: category || 'MEDICAL',
        priority: priority || 'MEDIUM',
        title,
        description,
        reasoning: reasoning || ['Clinician recommendation'],
        dataSources: ['CLINICIAN_INPUT'],
        validUntil,
      },
    });

    sendCreated(res, recommendation, 'Recommendation created');
  })
);

// Get recommendation categories and statistics
// GET /api/v1/recommendations/stats
router.get(
  '/stats',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patient = req.patient!;

    const [
      totalActive,
      totalCompleted,
      totalDismissed,
      byCategory,
    ] = await Promise.all([
      prisma.recommendation.count({
        where: { patientId: patient.patientId, status: 'ACTIVE' },
      }),
      prisma.recommendation.count({
        where: { patientId: patient.patientId, status: 'COMPLETED' },
      }),
      prisma.recommendation.count({
        where: { patientId: patient.patientId, status: 'DISMISSED' },
      }),
      prisma.recommendation.groupBy({
        by: ['category'],
        where: { patientId: patient.patientId },
        _count: { category: true },
      }),
    ]);

    const complianceRate = totalCompleted + totalDismissed > 0
      ? (totalCompleted / (totalCompleted + totalDismissed)) * 100
      : null;

    sendSuccess(res, {
      active: totalActive,
      completed: totalCompleted,
      dismissed: totalDismissed,
      complianceRate,
      byCategory: byCategory.map(c => ({
        category: c.category,
        count: c._count.category,
      })),
    }, 'Recommendation statistics retrieved');
  })
);

export default router;
