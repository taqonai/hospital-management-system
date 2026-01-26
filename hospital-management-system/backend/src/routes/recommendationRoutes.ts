import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import axios from 'axios';

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Helper function to gather patient data for AI service
async function gatherPatientData(patientId: string, hospitalId: string) {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [healthData, genomicProfile, labResults, nutritionLogs, fitnessGoals, wellnessGoals] = await Promise.all([
    // Get health data from the last 7 days
    prisma.healthDataPoint.findMany({
      where: {
        patientId,
        timestamp: { gte: sevenDaysAgo },
      },
      orderBy: { timestamp: 'desc' },
    }),
    // Get genomic profile with markers
    prisma.genomicProfile.findFirst({
      where: { patientId },
      include: { markers: true },
    }),
    // Get recent lab results (last 90 days)
    prisma.labOrderTest.findMany({
      where: {
        labOrder: {
          patientId,
        },
        status: 'COMPLETED',
        performedAt: { gte: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { performedAt: 'desc' },
      take: 50,
      include: {
        labTest: true,
      },
    }),
    // Get nutrition logs from last 7 days
    prisma.nutritionLog.findMany({
      where: {
        patientId,
        loggedAt: { gte: sevenDaysAgo },
      },
      orderBy: { loggedAt: 'desc' },
    }),
    // Get active fitness goals
    prisma.fitnessGoal.findMany({
      where: {
        patientId,
        isActive: true,
      },
    }),
    // Get active wellness goals
    prisma.wellnessGoal.findMany({
      where: {
        patientId,
        status: 'ACTIVE',
      },
    }),
  ]);

  // Transform health data into grouped format
  const wearableData: Record<string, any> = {};
  for (const point of healthData) {
    if (!wearableData[point.dataType]) {
      wearableData[point.dataType] = { values: [] };
    }
    wearableData[point.dataType].values.push({
      value: point.value,
      unit: point.unit,
      timestamp: point.timestamp.toISOString(),
    });
  }

  // Transform genomic markers
  const genomicMarkers = genomicProfile?.markers?.map(m => ({
    gene: m.gene,
    rsId: m.rsId,
    genotype: m.genotype,
    phenotype: m.phenotype,
    category: m.category,
  })) || [];

  // Transform lab results
  const transformedLabResults = labResults.map((r: any) => ({
    testName: r.labTest?.name || 'Unknown Test',
    value: r.result || (r.resultValue ? String(r.resultValue) : null),
    unit: r.unit || r.labTest?.unit,
    referenceRange: r.normalRange || r.labTest?.normalRange,
    status: r.status,
    isAbnormal: r.isAbnormal,
    isCritical: r.isCritical,
    date: r.performedAt?.toISOString(),
  }));

  // Transform nutrition logs
  const transformedNutritionLogs = nutritionLogs.map(n => ({
    mealType: n.mealType,
    calories: n.calories,
    protein: n.protein ? Number(n.protein) : null,
    carbs: n.carbohydrates ? Number(n.carbohydrates) : null,
    fat: n.fat ? Number(n.fat) : null,
    fiber: n.fiber ? Number(n.fiber) : null,
    sodium: n.sodium ? Number(n.sodium) : null,
    date: n.loggedAt.toISOString(),
  }));

  // Transform goals
  const transformedGoals = {
    fitness: fitnessGoals.map(g => ({
      type: g.goalType,
      target: g.targetValue,
      current: g.currentValue,
      unit: g.unit,
    })),
    wellness: wellnessGoals.map(g => ({
      category: g.category,
      target: g.targetValue,
      current: g.currentValue,
    })),
  };

  return {
    wearable_data: wearableData,
    genomic_markers: genomicMarkers,
    lab_results: transformedLabResults,
    nutrition_logs: transformedNutritionLogs,
    fitness_goals: transformedGoals,
  };
}

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

// Calculate/refresh daily health score
// POST /api/v1/recommendations/score/calculate
router.post(
  '/score/calculate',
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

    try {
      // Gather patient data for AI service
      const patientData = await gatherPatientData(patient.patientId, patientRecord.hospitalId);

      // Get current active recommendations to include in score calculation
      const activeRecommendations = await prisma.recommendation.findMany({
        where: {
          patientId: patient.patientId,
          status: 'ACTIVE',
        },
        select: {
          category: true,
          priority: true,
          status: true,
        },
      });

      // Call AI service to calculate health score
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/recommendations/score`, {
        ...patientData,
        current_recommendations: activeRecommendations,
      }, {
        timeout: 15000,
      });

      const healthScore = aiResponse.data;

      // Store the calculated score
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate trend based on historical scores
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const historicalScores = await prisma.dailyHealthScore.findMany({
        where: {
          patientId: patient.patientId,
          date: {
            gte: sevenDaysAgo,
            lt: today,
          },
        },
        orderBy: { date: 'desc' },
        take: 7,
      });

      let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
      if (historicalScores.length >= 3) {
        const avgPreviousScore = historicalScores.reduce((sum, s) => sum + s.overall, 0) / historicalScores.length;
        const scoreDiff = healthScore.overall - avgPreviousScore;
        if (scoreDiff > 5) trend = 'IMPROVING';
        else if (scoreDiff < -5) trend = 'DECLINING';
      } else if (historicalScores.length === 0) {
        trend = 'STABLE'; // No history, default to stable
      }

      // Upsert daily health score
      const storedScore = await prisma.dailyHealthScore.upsert({
        where: {
          patientId_date: {
            patientId: patient.patientId,
            date: today,
          },
        },
        create: {
          patientId: patient.patientId,
          hospitalId: patientRecord.hospitalId,
          date: today,
          overall: Math.round(healthScore.overall || 0),
          sleep: Math.round(healthScore.sleep || 0),
          activity: Math.round(healthScore.activity || 0),
          nutrition: Math.round(healthScore.nutrition || 0),
          recovery: Math.round(healthScore.recovery || 0),
          compliance: Math.round(healthScore.compliance || 0),
          trend,
          insights: healthScore.insights || [],
          dataQuality: healthScore.data_quality || 0,
        },
        update: {
          overall: Math.round(healthScore.overall || 0),
          sleep: Math.round(healthScore.sleep || 0),
          activity: Math.round(healthScore.activity || 0),
          nutrition: Math.round(healthScore.nutrition || 0),
          recovery: Math.round(healthScore.recovery || 0),
          compliance: Math.round(healthScore.compliance || 0),
          trend,
          insights: healthScore.insights || [],
          dataQuality: healthScore.data_quality || 0,
        },
      });

      sendSuccess(res, storedScore, 'Health score calculated');
    } catch (error: any) {
      console.error('Error calculating health score:', error.message);

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return sendError(res, 'AI service is temporarily unavailable. Please try again later.', 503);
      }

      return sendError(res, `Failed to calculate health score: ${error.message}`, 500);
    }
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

    try {
      // Gather patient data for AI service
      const patientData = await gatherPatientData(patient.patientId, patientRecord.hospitalId);

      // Call AI service to generate recommendations
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/recommendations/generate`, {
        patient_id: patient.patientId,
        patient_data: patientData,
      }, {
        timeout: 30000, // 30 second timeout
      });

      const { recommendations: aiRecommendations, health_score } = aiResponse.data;

      // Expire old active recommendations before creating new ones
      await prisma.recommendation.updateMany({
        where: {
          patientId: patient.patientId,
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
        },
      });

      // Store new recommendations in database
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7); // Valid for 7 days

      const createdRecommendations = await Promise.all(
        aiRecommendations.map((rec: any) =>
          prisma.recommendation.create({
            data: {
              patientId: patient.patientId,
              hospitalId: patientRecord.hospitalId,
              category: rec.category || 'LIFESTYLE',
              priority: rec.priority || 'MEDIUM',
              title: rec.title,
              description: rec.description,
              reasoning: rec.reasoning || [],
              dataSources: rec.data_sources || [],
              validUntil,
              status: 'ACTIVE',
            },
          })
        )
      );

      // Store daily health score if provided
      let storedScore = null;
      if (health_score) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Upsert daily health score
        storedScore = await prisma.dailyHealthScore.upsert({
          where: {
            patientId_date: {
              patientId: patient.patientId,
              date: today,
            },
          },
          create: {
            patientId: patient.patientId,
            hospitalId: patientRecord.hospitalId,
            date: today,
            overall: Math.round(health_score.overall || 0),
            sleep: Math.round(health_score.sleep || 0),
            activity: Math.round(health_score.activity || 0),
            nutrition: Math.round(health_score.nutrition || 0),
            recovery: Math.round(health_score.recovery || 0),
            compliance: Math.round(health_score.compliance || 0),
            trend: 'STABLE', // Will be calculated separately
            insights: health_score.insights || [],
            dataQuality: health_score.data_quality || 0,
          },
          update: {
            overall: Math.round(health_score.overall || 0),
            sleep: Math.round(health_score.sleep || 0),
            activity: Math.round(health_score.activity || 0),
            nutrition: Math.round(health_score.nutrition || 0),
            recovery: Math.round(health_score.recovery || 0),
            compliance: Math.round(health_score.compliance || 0),
            insights: health_score.insights || [],
            dataQuality: health_score.data_quality || 0,
          },
        });

        // Calculate trend based on historical scores
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const historicalScores = await prisma.dailyHealthScore.findMany({
          where: {
            patientId: patient.patientId,
            date: {
              gte: sevenDaysAgo,
              lt: today,
            },
          },
          orderBy: { date: 'desc' },
          take: 7,
        });

        if (historicalScores.length >= 3) {
          const avgPreviousScore = historicalScores.reduce((sum, s) => sum + s.overall, 0) / historicalScores.length;
          const currentScore = storedScore.overall;
          const scoreDiff = currentScore - avgPreviousScore;

          let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
          if (scoreDiff > 5) trend = 'IMPROVING';
          else if (scoreDiff < -5) trend = 'DECLINING';

          await prisma.dailyHealthScore.update({
            where: { id: storedScore.id },
            data: { trend },
          });

          storedScore.trend = trend;
        }
      }

      sendSuccess(res, {
        status: 'completed',
        recommendationsCreated: createdRecommendations.length,
        recommendations: createdRecommendations,
        healthScore: storedScore,
      }, 'Recommendations generated successfully');
    } catch (error: any) {
      console.error('Error generating recommendations:', error.message);

      // If AI service is unavailable, return a helpful error
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return sendError(res, 'AI service is temporarily unavailable. Please try again later.', 503);
      }

      return sendError(res, `Failed to generate recommendations: ${error.message}`, 500);
    }
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
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
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
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
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
