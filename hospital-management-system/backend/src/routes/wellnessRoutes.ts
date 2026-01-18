import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import prisma from '../config/database';

const router = Router();

// =============================================================================
// HEALTH DEVICE CONNECTIONS
// =============================================================================

const connectDeviceSchema = z.object({
  body: z.object({
    provider: z.enum(['APPLE_HEALTH', 'SAMSUNG_HEALTH', 'GOOGLE_FIT', 'FITBIT', 'GARMIN', 'WITHINGS']),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    scopes: z.array(z.string()).optional(),
  }),
});

// Get connected devices
router.get(
  '/devices',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const connections = await prisma.healthDeviceConnection.findMany({
      where: { patientId: req.patient!.patientId },
      select: {
        id: true,
        provider: true,
        isActive: true,
        lastSyncAt: true,
        syncFrequency: true,
        createdAt: true,
      },
    });
    sendSuccess(res, connections, 'Device connections retrieved');
  })
);

// Connect a new device
router.post(
  '/devices/connect',
  patientAuthenticate,
  validate(connectDeviceSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { provider, accessToken, refreshToken, scopes } = req.body;

    const connection = await prisma.healthDeviceConnection.upsert({
      where: {
        patientId_provider: {
          patientId: req.patient!.patientId,
          provider,
        },
      },
      update: {
        accessToken,
        refreshToken,
        scopes: scopes || [],
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        patientId: req.patient!.patientId,
        provider,
        accessToken,
        refreshToken,
        scopes: scopes || [],
      },
    });

    sendCreated(res, { id: connection.id, provider: connection.provider }, 'Device connected successfully');
  })
);

// Disconnect a device
router.delete(
  '/devices/:provider',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { provider } = req.params;

    await prisma.healthDeviceConnection.updateMany({
      where: {
        patientId: req.patient!.patientId,
        provider: provider as any,
      },
      data: { isActive: false },
    });

    sendSuccess(res, null, 'Device disconnected');
  })
);

// Sync data from a connected device
const syncDeviceSchema = z.object({
  body: z.object({
    metrics: z.array(z.object({
      dataType: z.string(),
      value: z.number(),
      unit: z.string(),
      timestamp: z.string(),
      endTime: z.string().optional(),
      metadata: z.any().optional(),
    })).optional(),
    workouts: z.array(z.object({
      workoutType: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      duration: z.number(),
      calories: z.number().optional(),
      distance: z.number().optional(),
      avgHeartRate: z.number().optional(),
    })).optional(),
    sleep: z.array(z.object({
      startTime: z.string(),
      endTime: z.string(),
      duration: z.number(),
      stages: z.array(z.object({
        stage: z.string(),
        startTime: z.string(),
        endTime: z.string(),
      })).optional(),
    })).optional(),
  }),
});

router.post(
  '/devices/:provider/sync',
  patientAuthenticate,
  validate(syncDeviceSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { provider } = req.params;
    const { metrics = [], workouts = [], sleep = [] } = req.body;
    const patientId = req.patient!.patientId;

    // Verify device is connected
    const connection = await prisma.healthDeviceConnection.findFirst({
      where: {
        patientId,
        provider: provider as any,
        isActive: true,
      },
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: `Device ${provider} is not connected`,
      });
    }

    let syncedMetrics = 0;
    let syncedWorkouts = 0;
    let syncedSleep = 0;

    // Map data types from health platform format to our schema
    const dataTypeMap: Record<string, string> = {
      'STEPS': 'STEPS',
      'HEART_RATE': 'HEART_RATE',
      'HEART_RATE_RESTING': 'HEART_RATE_RESTING',
      'HRV': 'HEART_RATE_VARIABILITY',
      'BLOOD_OXYGEN': 'BLOOD_OXYGEN',
      'BLOOD_PRESSURE_SYSTOLIC': 'BLOOD_PRESSURE_SYSTOLIC',
      'BLOOD_PRESSURE_DIASTOLIC': 'BLOOD_PRESSURE_DIASTOLIC',
      'BLOOD_GLUCOSE': 'BLOOD_GLUCOSE',
      'WEIGHT': 'WEIGHT',
      'BODY_TEMPERATURE': 'BODY_TEMPERATURE',
      'CALORIES_BURNED': 'CALORIES_BURNED',
      'DISTANCE': 'DISTANCE_WALKED',
      'RESPIRATORY_RATE': 'RESPIRATORY_RATE',
    };

    // Sync health metrics
    if (metrics.length > 0) {
      const metricsToCreate = metrics
        .filter((m: any) => dataTypeMap[m.dataType])
        .map((m: any) => ({
          patientId,
          metricType: dataTypeMap[m.dataType] as any,
          value: m.value,
          unit: m.unit,
          recordedAt: new Date(m.timestamp),
          source: provider as any,
          metadata: m.metadata || {},
        }));

      if (metricsToCreate.length > 0) {
        await prisma.healthMetric.createMany({
          data: metricsToCreate,
          skipDuplicates: true,
        });
        syncedMetrics = metricsToCreate.length;
      }
    }

    // Sync workouts
    if (workouts.length > 0) {
      const activityTypeMap: Record<string, string> = {
        'WALKING': 'walking',
        'RUNNING': 'running',
        'CYCLING': 'cycling',
        'SWIMMING': 'swimming',
        'HIIT': 'hiit',
        'STRENGTH_TRAINING': 'weight_training',
        'YOGA': 'yoga',
        'OTHER': 'other',
      };

      const workoutsToCreate = workouts.map((w: any) => ({
        patientId,
        activityType: activityTypeMap[w.workoutType] || 'other',
        duration: w.duration,
        caloriesBurned: w.calories,
        distance: w.distance,
        avgHeartRate: w.avgHeartRate,
        startTime: new Date(w.startTime),
        endTime: new Date(w.endTime),
        source: provider,
        metadata: { workoutType: w.workoutType },
      }));

      await prisma.activityLog.createMany({
        data: workoutsToCreate,
        skipDuplicates: true,
      });
      syncedWorkouts = workouts.length;
    }

    // Sync sleep data
    if (sleep.length > 0) {
      const sleepToCreate = sleep.map((s: any) => ({
        patientId,
        sleepStart: new Date(s.startTime),
        sleepEnd: new Date(s.endTime),
        duration: s.duration,
        quality: 'UNKNOWN' as any,
        stages: s.stages || [],
        source: provider,
      }));

      await prisma.sleepLog.createMany({
        data: sleepToCreate,
        skipDuplicates: true,
      });
      syncedSleep = sleep.length;
    }

    // Update last sync time on connection
    await prisma.healthDeviceConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    sendSuccess(res, {
      syncedMetrics,
      syncedWorkouts,
      syncedSleep,
      lastSyncAt: new Date().toISOString(),
    }, 'Data synced successfully');
  })
);

// =============================================================================
// HEALTH METRICS
// =============================================================================

const logMetricSchema = z.object({
  body: z.object({
    metricType: z.enum([
      'STEPS', 'HEART_RATE', 'HEART_RATE_RESTING', 'HEART_RATE_VARIABILITY',
      'BLOOD_PRESSURE_SYSTOLIC', 'BLOOD_PRESSURE_DIASTOLIC', 'BLOOD_OXYGEN',
      'BLOOD_GLUCOSE', 'BODY_TEMPERATURE', 'WEIGHT', 'HEIGHT', 'BMI',
      'BODY_FAT', 'SLEEP_DURATION', 'SLEEP_QUALITY', 'CALORIES_BURNED',
      'CALORIES_CONSUMED', 'WATER_INTAKE', 'STRESS_LEVEL', 'RESPIRATORY_RATE',
      'ACTIVE_MINUTES', 'DISTANCE_WALKED', 'FLOORS_CLIMBED'
    ]),
    value: z.number(),
    unit: z.string(),
    recordedAt: z.string().datetime().optional(),
    source: z.enum(['APPLE_HEALTH', 'SAMSUNG_HEALTH', 'GOOGLE_FIT', 'FITBIT', 'GARMIN', 'WITHINGS', 'MANUAL']).optional(),
    metadata: z.any().optional(),
  }),
});

const bulkMetricsSchema = z.object({
  body: z.object({
    metrics: z.array(z.object({
      metricType: z.string(),
      value: z.number(),
      unit: z.string(),
      recordedAt: z.string().datetime(),
      source: z.string().optional(),
    })),
  }),
});

// Get health metrics
router.get(
  '/metrics',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { type, startDate, endDate, limit = '100' } = req.query;

    const where: any = { patientId: req.patient!.patientId };
    if (type) where.metricType = type;
    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = new Date(startDate as string);
      if (endDate) where.recordedAt.lte = new Date(endDate as string);
    }

    const metrics = await prisma.healthMetric.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: parseInt(limit as string),
    });

    sendSuccess(res, metrics, 'Health metrics retrieved');
  })
);

// Get metrics summary (today's stats)
router.get(
  '/metrics/summary',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayMetrics = await prisma.healthMetric.findMany({
      where: {
        patientId: req.patient!.patientId,
        recordedAt: { gte: today, lt: tomorrow },
      },
    });

    // Aggregate by type
    const summary: Record<string, { value: number; unit: string; count: number }> = {};
    todayMetrics.forEach((m) => {
      if (!summary[m.metricType]) {
        summary[m.metricType] = { value: 0, unit: m.unit, count: 0 };
      }
      summary[m.metricType].value += Number(m.value);
      summary[m.metricType].count++;
    });

    // Calculate averages for rate-based metrics
    ['HEART_RATE', 'BLOOD_OXYGEN', 'STRESS_LEVEL'].forEach((type) => {
      if (summary[type] && summary[type].count > 1) {
        summary[type].value = Math.round(summary[type].value / summary[type].count);
      }
    });

    sendSuccess(res, summary, 'Metrics summary retrieved');
  })
);

// Log a metric
router.post(
  '/metrics',
  patientAuthenticate,
  validate(logMetricSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { metricType, value, unit, recordedAt, source, metadata } = req.body;

    const metric = await prisma.healthMetric.create({
      data: {
        patientId: req.patient!.patientId,
        metricType,
        value,
        unit,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        source: source || 'MANUAL',
        metadata,
      },
    });

    sendCreated(res, metric, 'Metric logged successfully');
  })
);

// Bulk sync metrics (for health app sync)
router.post(
  '/metrics/sync',
  patientAuthenticate,
  validate(bulkMetricsSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { metrics } = req.body;

    const created = await prisma.healthMetric.createMany({
      data: metrics.map((m: any) => ({
        patientId: req.patient!.patientId,
        metricType: m.metricType,
        value: m.value,
        unit: m.unit,
        recordedAt: new Date(m.recordedAt),
        source: m.source || 'MANUAL',
      })),
    });

    sendSuccess(res, { count: created.count }, `${created.count} metrics synced`);
  })
);

// =============================================================================
// FITNESS ACTIVITIES
// =============================================================================

const logActivitySchema = z.object({
  body: z.object({
    activityType: z.string(),
    name: z.string(),
    description: z.string().optional(),
    durationMinutes: z.number().min(1),
    intensity: z.enum(['LIGHT', 'MODERATE', 'VIGOROUS', 'VERY_VIGOROUS']).optional(),
    caloriesBurned: z.number().optional(),
    distanceKm: z.number().optional(),
    steps: z.number().optional(),
    avgHeartRate: z.number().optional(),
    maxHeartRate: z.number().optional(),
    sets: z.number().optional(),
    reps: z.number().optional(),
    weightKg: z.number().optional(),
    location: z.string().optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    notes: z.string().optional(),
    moodBefore: z.number().min(1).max(5).optional(),
    moodAfter: z.number().min(1).max(5).optional(),
    difficultyRating: z.number().min(1).max(5).optional(),
  }),
});

// Get fitness activities
router.get(
  '/fitness/activities',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { type, startDate, endDate, limit = '50' } = req.query;

    const where: any = { patientId: req.patient!.patientId };
    if (type) where.activityType = type;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate as string);
      if (endDate) where.startTime.lte = new Date(endDate as string);
    }

    const activities = await prisma.fitnessActivity.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: parseInt(limit as string),
    });

    sendSuccess(res, activities, 'Fitness activities retrieved');
  })
);

// Get activity stats
router.get(
  '/fitness/stats',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { period = 'week' } = req.query;

    const startDate = new Date();
    if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);

    const activities = await prisma.fitnessActivity.findMany({
      where: {
        patientId: req.patient!.patientId,
        startTime: { gte: startDate },
      },
    });

    const stats = {
      totalWorkouts: activities.length,
      totalMinutes: activities.reduce((sum, a) => sum + a.durationMinutes, 0),
      totalCalories: activities.reduce((sum, a) => sum + (a.caloriesBurned || 0), 0),
      totalDistance: activities.reduce((sum, a) => sum + Number(a.distanceKm || 0), 0),
      avgDuration: activities.length ? Math.round(activities.reduce((sum, a) => sum + a.durationMinutes, 0) / activities.length) : 0,
      byType: {} as Record<string, number>,
      byIntensity: {} as Record<string, number>,
    };

    activities.forEach((a) => {
      stats.byType[a.activityType] = (stats.byType[a.activityType] || 0) + 1;
      stats.byIntensity[a.intensity] = (stats.byIntensity[a.intensity] || 0) + 1;
    });

    sendSuccess(res, stats, 'Fitness stats retrieved');
  })
);

// Log a fitness activity
router.post(
  '/fitness/activities',
  patientAuthenticate,
  validate(logActivitySchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const data = req.body;

    const activity = await prisma.fitnessActivity.create({
      data: {
        patientId: req.patient!.patientId,
        activityType: data.activityType,
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        intensity: data.intensity || 'MODERATE',
        caloriesBurned: data.caloriesBurned,
        distanceKm: data.distanceKm,
        steps: data.steps,
        avgHeartRate: data.avgHeartRate,
        maxHeartRate: data.maxHeartRate,
        sets: data.sets,
        reps: data.reps,
        weightKg: data.weightKg,
        location: data.location,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
        notes: data.notes,
        moodBefore: data.moodBefore,
        moodAfter: data.moodAfter,
        difficultyRating: data.difficultyRating,
      },
    });

    sendCreated(res, activity, 'Activity logged successfully');
  })
);

// Update activity
router.put(
  '/fitness/activities/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const activity = await prisma.fitnessActivity.updateMany({
      where: { id, patientId: req.patient!.patientId },
      data: req.body,
    });

    if (activity.count === 0) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    sendSuccess(res, null, 'Activity updated');
  })
);

// Delete activity
router.delete(
  '/fitness/activities/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await prisma.fitnessActivity.deleteMany({
      where: { id, patientId: req.patient!.patientId },
    });

    sendSuccess(res, null, 'Activity deleted');
  })
);

// =============================================================================
// FITNESS GOALS
// =============================================================================

const fitnessGoalSchema = z.object({
  body: z.object({
    goalType: z.string(),
    targetValue: z.number(),
    unit: z.string(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ONE_TIME']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

// Get fitness goals
router.get(
  '/fitness/goals',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { active } = req.query;

    const where: any = { patientId: req.patient!.patientId };
    if (active === 'true') where.isActive = true;

    const goals = await prisma.fitnessGoal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, goals, 'Fitness goals retrieved');
  })
);

// Create fitness goal
router.post(
  '/fitness/goals',
  patientAuthenticate,
  validate(fitnessGoalSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const data = req.body;

    const goal = await prisma.fitnessGoal.create({
      data: {
        patientId: req.patient!.patientId,
        goalType: data.goalType,
        targetValue: data.targetValue,
        unit: data.unit,
        frequency: data.frequency || 'DAILY',
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    sendCreated(res, goal, 'Fitness goal created');
  })
);

// Update goal progress
router.put(
  '/fitness/goals/:id/progress',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { currentValue } = req.body;

    const goal = await prisma.fitnessGoal.findFirst({
      where: { id, patientId: req.patient!.patientId },
    });

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const isCompleted = currentValue >= Number(goal.targetValue);

    const updated = await prisma.fitnessGoal.update({
      where: { id },
      data: {
        currentValue,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    sendSuccess(res, updated, 'Goal progress updated');
  })
);

// =============================================================================
// NUTRITION
// =============================================================================

const nutritionLogSchema = z.object({
  body: z.object({
    mealType: z.enum(['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER', 'EVENING_SNACK', 'OTHER']),
    mealName: z.string(),
    description: z.string().optional(),
    calories: z.number().optional(),
    protein: z.number().optional(),
    carbohydrates: z.number().optional(),
    fat: z.number().optional(),
    fiber: z.number().optional(),
    sugar: z.number().optional(),
    sodium: z.number().optional(),
    servingSize: z.string().optional(),
    servings: z.number().optional(),
    foodItems: z.array(z.any()).optional(),
    photoUrl: z.string().optional(),
    loggedAt: z.string().datetime().optional(),
  }),
});

// Get nutrition logs
router.get(
  '/nutrition/logs',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { date, startDate, endDate, limit = '50' } = req.query;

    const where: any = { patientId: req.patient!.patientId };

    if (date) {
      const d = new Date(date as string);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.loggedAt = { gte: d, lt: nextDay };
    } else if (startDate || endDate) {
      where.loggedAt = {};
      if (startDate) where.loggedAt.gte = new Date(startDate as string);
      if (endDate) where.loggedAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.nutritionLog.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: parseInt(limit as string),
    });

    sendSuccess(res, logs, 'Nutrition logs retrieved');
  })
);

// Get daily nutrition summary
router.get(
  '/nutrition/summary',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const logs = await prisma.nutritionLog.findMany({
      where: {
        patientId: req.patient!.patientId,
        loggedAt: { gte: targetDate, lt: nextDay },
      },
    });

    const summary = {
      date: targetDate.toISOString().split('T')[0],
      totalMeals: logs.length,
      totalCalories: logs.reduce((sum, l) => sum + (l.calories || 0), 0),
      totalProtein: logs.reduce((sum, l) => sum + Number(l.protein || 0), 0),
      totalCarbs: logs.reduce((sum, l) => sum + Number(l.carbohydrates || 0), 0),
      totalFat: logs.reduce((sum, l) => sum + Number(l.fat || 0), 0),
      totalFiber: logs.reduce((sum, l) => sum + Number(l.fiber || 0), 0),
      byMealType: {} as Record<string, any>,
    };

    logs.forEach((l) => {
      if (!summary.byMealType[l.mealType]) {
        summary.byMealType[l.mealType] = { meals: [], calories: 0 };
      }
      summary.byMealType[l.mealType].meals.push(l.mealName);
      summary.byMealType[l.mealType].calories += l.calories || 0;
    });

    sendSuccess(res, summary, 'Nutrition summary retrieved');
  })
);

// Log a meal
router.post(
  '/nutrition/logs',
  patientAuthenticate,
  validate(nutritionLogSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const data = req.body;

    const log = await prisma.nutritionLog.create({
      data: {
        patientId: req.patient!.patientId,
        mealType: data.mealType,
        mealName: data.mealName,
        description: data.description,
        calories: data.calories,
        protein: data.protein,
        carbohydrates: data.carbohydrates,
        fat: data.fat,
        fiber: data.fiber,
        sugar: data.sugar,
        sodium: data.sodium,
        servingSize: data.servingSize,
        servings: data.servings,
        foodItems: data.foodItems,
        photoUrl: data.photoUrl,
        loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
      },
    });

    sendCreated(res, log, 'Meal logged successfully');
  })
);

// Update nutrition log
router.put(
  '/nutrition/logs/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const updated = await prisma.nutritionLog.updateMany({
      where: { id, patientId: req.patient!.patientId },
      data: req.body,
    });

    if (updated.count === 0) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }

    sendSuccess(res, null, 'Nutrition log updated');
  })
);

// Delete nutrition log
router.delete(
  '/nutrition/logs/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await prisma.nutritionLog.deleteMany({
      where: { id, patientId: req.patient!.patientId },
    });

    sendSuccess(res, null, 'Nutrition log deleted');
  })
);

// =============================================================================
// NUTRITION PLANS
// =============================================================================

const nutritionPlanSchema = z.object({
  body: z.object({
    name: z.string(),
    description: z.string().optional(),
    goal: z.enum([
      'WEIGHT_LOSS', 'WEIGHT_GAIN', 'MUSCLE_BUILDING', 'MAINTAIN_WEIGHT',
      'IMPROVE_ENERGY', 'HEART_HEALTH', 'DIABETES_MANAGEMENT', 'DIGESTIVE_HEALTH',
      'GENERAL_WELLNESS', 'ATHLETIC_PERFORMANCE', 'PREGNANCY', 'POSTPARTUM'
    ]),
    targetCalories: z.number(),
    targetProtein: z.number().optional(),
    targetCarbs: z.number().optional(),
    targetFat: z.number().optional(),
    targetFiber: z.number().optional(),
    targetWater: z.number().optional(),
    dietaryRestrictions: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
    preferences: z.array(z.string()).optional(),
  }),
});

// Get nutrition plans
router.get(
  '/nutrition/plans',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const plans = await prisma.nutritionPlan.findMany({
      where: { patientId: req.patient!.patientId },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, plans, 'Nutrition plans retrieved');
  })
);

// Get active nutrition plan
router.get(
  '/nutrition/plans/active',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const plan = await prisma.nutritionPlan.findFirst({
      where: { patientId: req.patient!.patientId, isActive: true },
    });

    sendSuccess(res, plan, plan ? 'Active plan retrieved' : 'No active plan');
  })
);

// Create nutrition plan
router.post(
  '/nutrition/plans',
  patientAuthenticate,
  validate(nutritionPlanSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const data = req.body;

    // Deactivate existing plans
    await prisma.nutritionPlan.updateMany({
      where: { patientId: req.patient!.patientId, isActive: true },
      data: { isActive: false },
    });

    const plan = await prisma.nutritionPlan.create({
      data: {
        patientId: req.patient!.patientId,
        name: data.name,
        description: data.description,
        goal: data.goal,
        targetCalories: data.targetCalories,
        targetProtein: data.targetProtein,
        targetCarbs: data.targetCarbs,
        targetFat: data.targetFat,
        targetFiber: data.targetFiber,
        targetWater: data.targetWater,
        dietaryRestrictions: data.dietaryRestrictions || [],
        allergies: data.allergies || [],
        preferences: data.preferences || [],
        startDate: new Date(),
        isActive: true,
      },
    });

    sendCreated(res, plan, 'Nutrition plan created');
  })
);

// =============================================================================
// WELLNESS GOALS
// =============================================================================

const wellnessGoalSchema = z.object({
  body: z.object({
    category: z.enum([
      'PHYSICAL_FITNESS', 'MENTAL_HEALTH', 'NUTRITION', 'SLEEP',
      'STRESS_MANAGEMENT', 'HYDRATION', 'WEIGHT_MANAGEMENT',
      'CHRONIC_DISEASE_MANAGEMENT', 'PREVENTIVE_CARE', 'SOCIAL_WELLNESS',
      'MINDFULNESS', 'HABIT_BUILDING'
    ]),
    title: z.string(),
    description: z.string().optional(),
    targetValue: z.number().optional(),
    unit: z.string().optional(),
    targetDate: z.string().datetime().optional(),
    priority: z.number().min(1).max(5).optional(),
  }),
});

// Get wellness goals
router.get(
  '/wellness/goals',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { status, category } = req.query;

    const where: any = { patientId: req.patient!.patientId };
    if (status) where.status = status;
    if (category) where.category = category;

    const goals = await prisma.wellnessGoal.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    sendSuccess(res, goals, 'Wellness goals retrieved');
  })
);

// Create wellness goal
router.post(
  '/wellness/goals',
  patientAuthenticate,
  validate(wellnessGoalSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const data = req.body;

    const goal = await prisma.wellnessGoal.create({
      data: {
        patientId: req.patient!.patientId,
        category: data.category,
        title: data.title,
        description: data.description,
        targetValue: data.targetValue,
        unit: data.unit,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        priority: data.priority || 1,
        startDate: new Date(),
      },
    });

    sendCreated(res, goal, 'Wellness goal created');
  })
);

// Update wellness goal
router.put(
  '/wellness/goals/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const data = req.body;

    const updated = await prisma.wellnessGoal.updateMany({
      where: { id, patientId: req.patient!.patientId },
      data: {
        ...data,
        completedAt: data.status === 'COMPLETED' ? new Date() : undefined,
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    sendSuccess(res, null, 'Wellness goal updated');
  })
);

// =============================================================================
// AI WELLNESS FEATURES
// =============================================================================

// AI Workout Recommendations
router.post(
  '/ai/workout-recommendations',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { fitnessLevel, goals, preferences, availableTime, equipment } = req.body;

    // Get patient's recent activity
    const recentActivities = await prisma.fitnessActivity.findMany({
      where: {
        patientId: req.patient!.patientId,
        startTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    // Get patient's goals
    const fitnessGoals = await prisma.fitnessGoal.findMany({
      where: { patientId: req.patient!.patientId, isActive: true },
    });

    // Generate AI recommendations (rule-based for now)
    const recommendations = generateWorkoutRecommendations(
      fitnessLevel || 'intermediate',
      goals || [],
      preferences || [],
      availableTime || 30,
      equipment || [],
      recentActivities,
      fitnessGoals
    );

    sendSuccess(res, recommendations, 'Workout recommendations generated');
  })
);

// AI Meal Plan Generation
router.post(
  '/ai/meal-plan',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { goal, targetCalories, restrictions, allergies, preferences, days = 7 } = req.body;

    // Get patient's medical history for context
    const medicalHistory = await prisma.medicalHistory.findUnique({
      where: { patientId: req.patient!.patientId },
    });

    const patientAllergies = await prisma.allergy.findMany({
      where: { patientId: req.patient!.patientId },
    });

    // Generate meal plan
    const mealPlan = generateAIMealPlan(
      goal || 'GENERAL_WELLNESS',
      targetCalories || 2000,
      [...(restrictions || []), ...(medicalHistory?.chronicConditions || [])],
      [...(allergies || []), ...patientAllergies.map(a => a.allergen)],
      preferences || [],
      days
    );

    // Save as nutrition plan
    const plan = await prisma.nutritionPlan.create({
      data: {
        patientId: req.patient!.patientId,
        name: `AI Generated ${goal || 'Wellness'} Plan`,
        description: `AI-generated ${days}-day meal plan`,
        goal: goal || 'GENERAL_WELLNESS',
        targetCalories: targetCalories || 2000,
        dietaryRestrictions: restrictions || [],
        allergies: allergies || [],
        preferences: preferences || [],
        mealPlan,
        isAiGenerated: true,
        startDate: new Date(),
        isActive: true,
      },
    });

    sendSuccess(res, { plan, mealPlan }, 'Meal plan generated');
  })
);

// AI Wellness Assessment
router.post(
  '/ai/wellness-assessment',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient!.patientId;

    // Gather all patient data
    const [
      medicalHistory,
      allergies,
      recentMetrics,
      recentActivities,
      nutritionLogs,
      fitnessGoals,
      wellnessGoals,
    ] = await Promise.all([
      prisma.medicalHistory.findUnique({ where: { patientId } }),
      prisma.allergy.findMany({ where: { patientId } }),
      prisma.healthMetric.findMany({
        where: { patientId, recordedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.fitnessActivity.findMany({
        where: { patientId, startTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.nutritionLog.findMany({
        where: { patientId, loggedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.fitnessGoal.findMany({ where: { patientId, isActive: true } }),
      prisma.wellnessGoal.findMany({ where: { patientId, status: 'ACTIVE' } }),
    ]);

    // Generate comprehensive wellness assessment
    const assessment = generateWellnessAssessment({
      medicalHistory,
      allergies,
      recentMetrics,
      recentActivities,
      nutritionLogs,
      fitnessGoals,
      wellnessGoals,
    });

    // Save assessment
    const saved = await prisma.wellnessAssessment.create({
      data: {
        patientId,
        assessmentType: 'COMPREHENSIVE',
        overallScore: assessment.overallScore,
        categoryScores: assessment.categoryScores,
        strengths: assessment.strengths,
        areasToImprove: assessment.areasToImprove,
        recommendations: assessment.recommendations,
        actionPlan: assessment.actionPlan,
        healthRisks: assessment.healthRisks,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    sendSuccess(res, { ...assessment, id: saved.id }, 'Wellness assessment completed');
  })
);

// Get latest wellness assessment
router.get(
  '/ai/wellness-assessment',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const assessment = await prisma.wellnessAssessment.findFirst({
      where: { patientId: req.patient!.patientId },
      orderBy: { assessedAt: 'desc' },
    });

    sendSuccess(res, assessment, assessment ? 'Assessment retrieved' : 'No assessment found');
  })
);

// AI Health Coaching Chat
router.post(
  '/ai/health-coach',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { message, context } = req.body;

    // Get patient context
    const patient = await prisma.patient.findUnique({
      where: { id: req.patient!.patientId },
      include: {
        medicalHistory: true,
        allergies: true,
      },
    });

    // Generate AI response (rule-based coaching)
    const response = generateHealthCoachResponse(message, {
      patient,
      context,
    });

    sendSuccess(res, response, 'Coach response generated');
  })
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateWorkoutRecommendations(
  fitnessLevel: string,
  goals: string[],
  preferences: string[],
  availableTime: number,
  equipment: string[],
  recentActivities: any[],
  fitnessGoals: any[]
) {
  const workouts = [];

  // Analyze recent activity patterns
  const activityTypes = recentActivities.map(a => a.activityType);
  const frequentTypes = [...new Set(activityTypes)];

  // Base recommendations on goals
  if (goals.includes('WEIGHT_LOSS') || goals.includes('FAT_BURN')) {
    workouts.push({
      name: 'Fat-Burning HIIT',
      type: 'HIIT',
      duration: Math.min(availableTime, 30),
      intensity: fitnessLevel === 'beginner' ? 'MODERATE' : 'VIGOROUS',
      exercises: [
        { name: 'Jumping Jacks', duration: '45 sec', rest: '15 sec' },
        { name: 'Burpees', duration: '30 sec', rest: '30 sec' },
        { name: 'Mountain Climbers', duration: '45 sec', rest: '15 sec' },
        { name: 'High Knees', duration: '30 sec', rest: '30 sec' },
      ],
      calorieEstimate: Math.round(availableTime * 12),
      benefits: ['Burns calories', 'Boosts metabolism', 'Improves cardiovascular health'],
    });
  }

  if (goals.includes('MUSCLE_GAIN') || goals.includes('STRENGTH')) {
    workouts.push({
      name: 'Strength Training',
      type: 'WEIGHT_TRAINING',
      duration: Math.min(availableTime, 45),
      intensity: 'MODERATE',
      exercises: equipment.includes('dumbbells')
        ? [
            { name: 'Dumbbell Squats', sets: 3, reps: 12 },
            { name: 'Dumbbell Press', sets: 3, reps: 10 },
            { name: 'Dumbbell Rows', sets: 3, reps: 10 },
            { name: 'Lunges', sets: 3, reps: 12 },
          ]
        : [
            { name: 'Push-ups', sets: 3, reps: 15 },
            { name: 'Bodyweight Squats', sets: 3, reps: 20 },
            { name: 'Plank', sets: 3, duration: '30 sec' },
            { name: 'Glute Bridges', sets: 3, reps: 15 },
          ],
      benefits: ['Builds muscle', 'Increases strength', 'Boosts metabolism'],
    });
  }

  if (goals.includes('FLEXIBILITY') || goals.includes('STRESS_RELIEF')) {
    workouts.push({
      name: 'Yoga Flow',
      type: 'YOGA',
      duration: Math.min(availableTime, 30),
      intensity: 'LIGHT',
      exercises: [
        { name: 'Sun Salutation', duration: '5 min' },
        { name: 'Warrior Poses', duration: '5 min' },
        { name: 'Balance Poses', duration: '5 min' },
        { name: 'Stretching & Savasana', duration: '5 min' },
      ],
      benefits: ['Improves flexibility', 'Reduces stress', 'Enhances mindfulness'],
    });
  }

  // Default cardio recommendation
  if (workouts.length === 0 || preferences.includes('cardio')) {
    workouts.push({
      name: 'Cardio Session',
      type: frequentTypes.includes('RUNNING') ? 'RUNNING' : 'WALKING',
      duration: availableTime,
      intensity: fitnessLevel === 'advanced' ? 'VIGOROUS' : 'MODERATE',
      exercises: [
        { name: 'Warm-up walk', duration: '5 min' },
        { name: 'Main cardio', duration: `${availableTime - 10} min` },
        { name: 'Cool down', duration: '5 min' },
      ],
      calorieEstimate: Math.round(availableTime * 8),
      benefits: ['Improves heart health', 'Burns calories', 'Boosts endurance'],
    });
  }

  return {
    recommendations: workouts,
    personalizedTips: [
      fitnessLevel === 'beginner' ? 'Start slowly and focus on form' : 'Challenge yourself with progressive overload',
      'Stay hydrated throughout your workout',
      'Listen to your body and rest when needed',
    ],
    weeklyPlan: generateWeeklyPlan(workouts, fitnessLevel),
  };
}

function generateWeeklyPlan(workouts: any[], fitnessLevel: string) {
  const daysPerWeek = fitnessLevel === 'beginner' ? 3 : fitnessLevel === 'intermediate' ? 4 : 5;
  const plan = [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (let i = 0; i < 7; i++) {
    if (i < daysPerWeek) {
      plan.push({
        day: days[i],
        workout: workouts[i % workouts.length],
        isRestDay: false,
      });
    } else {
      plan.push({
        day: days[i],
        workout: null,
        isRestDay: true,
        suggestion: 'Light stretching or walk recommended',
      });
    }
  }

  return plan;
}

function generateAIMealPlan(
  goal: string,
  targetCalories: number,
  restrictions: string[],
  allergies: string[],
  preferences: string[],
  days: number
) {
  const mealPlan = [];
  const mealTemplates = getMealTemplates(goal, restrictions, allergies);

  for (let day = 1; day <= days; day++) {
    const dayPlan = {
      day,
      meals: {
        breakfast: selectMeal(mealTemplates.breakfast, targetCalories * 0.25),
        lunch: selectMeal(mealTemplates.lunch, targetCalories * 0.35),
        dinner: selectMeal(mealTemplates.dinner, targetCalories * 0.30),
        snacks: selectMeal(mealTemplates.snacks, targetCalories * 0.10),
      },
      totalCalories: targetCalories,
      macros: {
        protein: Math.round(targetCalories * 0.25 / 4),
        carbs: Math.round(targetCalories * 0.45 / 4),
        fat: Math.round(targetCalories * 0.30 / 9),
      },
    };
    mealPlan.push(dayPlan);
  }

  return mealPlan;
}

function getMealTemplates(goal: string, restrictions: string[], allergies: string[]) {
  const isVegetarian = restrictions.includes('vegetarian');
  const isVegan = restrictions.includes('vegan');
  const isLowCarb = goal === 'WEIGHT_LOSS' || restrictions.includes('low-carb');

  return {
    breakfast: [
      { name: 'Oatmeal with Berries', calories: 350, protein: 10, carbs: 60, fat: 8 },
      { name: 'Greek Yogurt Parfait', calories: 300, protein: 15, carbs: 40, fat: 10 },
      { name: 'Scrambled Eggs with Toast', calories: 400, protein: 20, carbs: 35, fat: 18 },
      { name: 'Smoothie Bowl', calories: 350, protein: 12, carbs: 55, fat: 8 },
      isLowCarb ? { name: 'Avocado Eggs', calories: 350, protein: 18, carbs: 10, fat: 28 } : null,
    ].filter(Boolean),
    lunch: [
      { name: 'Grilled Chicken Salad', calories: 450, protein: 35, carbs: 25, fat: 22 },
      { name: 'Quinoa Buddha Bowl', calories: 500, protein: 18, carbs: 65, fat: 18 },
      { name: 'Turkey Wrap', calories: 420, protein: 28, carbs: 45, fat: 14 },
      isVegetarian ? { name: 'Veggie Stir-fry', calories: 380, protein: 15, carbs: 50, fat: 14 } : null,
    ].filter(Boolean),
    dinner: [
      { name: 'Grilled Salmon with Vegetables', calories: 520, protein: 40, carbs: 25, fat: 28 },
      { name: 'Chicken Breast with Rice', calories: 480, protein: 38, carbs: 45, fat: 14 },
      { name: 'Lean Beef Stir-fry', calories: 500, protein: 35, carbs: 40, fat: 20 },
      isVegetarian ? { name: 'Lentil Curry', calories: 450, protein: 22, carbs: 60, fat: 12 } : null,
    ].filter(Boolean),
    snacks: [
      { name: 'Mixed Nuts', calories: 180, protein: 6, carbs: 8, fat: 16 },
      { name: 'Apple with Peanut Butter', calories: 200, protein: 5, carbs: 25, fat: 10 },
      { name: 'Protein Bar', calories: 220, protein: 20, carbs: 22, fat: 8 },
      { name: 'Vegetables with Hummus', calories: 150, protein: 5, carbs: 18, fat: 7 },
    ],
  };
}

function selectMeal(meals: any[], targetCalories: number) {
  if (!meals.length) return { name: 'Custom Meal', calories: targetCalories, protein: 20, carbs: 30, fat: 15 };
  // Sort by closest to target calories and pick from top options
  const sorted = [...meals].sort((a, b) =>
    Math.abs(a.calories - targetCalories) - Math.abs(b.calories - targetCalories)
  );
  // Return the closest match or a random one from top 3 closest
  const topMatches = sorted.slice(0, Math.min(3, sorted.length));
  return topMatches[Math.floor(Math.random() * topMatches.length)];
}

function generateWellnessAssessment(data: any) {
  const scores: Record<string, number> = {};
  const strengths: string[] = [];
  const areasToImprove: string[] = [];
  const recommendations: any[] = [];

  // Physical Activity Score
  const activityScore = Math.min(100, (data.recentActivities.length / 12) * 100);
  scores['Physical Activity'] = activityScore;
  if (activityScore >= 70) strengths.push('Consistent exercise routine');
  else areasToImprove.push('Increase physical activity frequency');

  // Nutrition Score
  const nutritionScore = data.nutritionLogs.length > 0 ? 70 : 40;
  scores['Nutrition'] = nutritionScore;
  if (nutritionScore < 60) {
    recommendations.push({
      category: 'Nutrition',
      title: 'Track Your Meals',
      description: 'Start logging your meals to better understand your eating habits',
      priority: 'high',
    });
  }

  // Sleep Score (from metrics)
  const sleepMetrics = data.recentMetrics.filter((m: any) => m.metricType === 'SLEEP_DURATION');
  const avgSleep = sleepMetrics.length > 0
    ? sleepMetrics.reduce((sum: number, m: any) => sum + Number(m.value), 0) / sleepMetrics.length
    : 0;
  scores['Sleep'] = avgSleep >= 7 ? 85 : avgSleep >= 6 ? 65 : 40;

  // Hydration Score
  const waterMetrics = data.recentMetrics.filter((m: any) => m.metricType === 'WATER_INTAKE');
  scores['Hydration'] = waterMetrics.length > 0 ? 70 : 50;

  // Stress Management
  const stressMetrics = data.recentMetrics.filter((m: any) => m.metricType === 'STRESS_LEVEL');
  const hasYoga = data.recentActivities.some((a: any) => ['YOGA', 'MEDITATION'].includes(a.activityType));
  scores['Stress Management'] = hasYoga ? 75 : 55;

  // Goal Progress
  const completedGoals = [...data.fitnessGoals, ...data.wellnessGoals].filter((g: any) => g.isCompleted);
  scores['Goal Achievement'] = completedGoals.length > 0 ? 80 : 50;

  // Calculate overall score
  const overallScore = Math.round(
    Object.values(scores).reduce((sum, s) => sum + s, 0) / Object.keys(scores).length
  );

  // Generate action plan
  const actionPlan = [
    { week: 1, focus: 'Build habits', actions: ['Set daily reminders', 'Start with small goals'] },
    { week: 2, focus: 'Increase intensity', actions: ['Add variety to workouts', 'Try new healthy recipes'] },
    { week: 3, focus: 'Track progress', actions: ['Review metrics weekly', 'Adjust goals as needed'] },
    { week: 4, focus: 'Maintain momentum', actions: ['Celebrate achievements', 'Set new challenges'] },
  ];

  // Identify health risks
  const healthRisks = [];
  if (data.medicalHistory?.chronicConditions?.length > 0) {
    healthRisks.push({
      risk: 'Chronic condition management',
      level: 'moderate',
      recommendation: 'Regular monitoring and medication adherence',
    });
  }

  return {
    overallScore,
    categoryScores: scores,
    strengths,
    areasToImprove,
    recommendations,
    actionPlan,
    healthRisks,
  };
}

function generateHealthCoachResponse(message: string, context: any) {
  const lowerMessage = message.toLowerCase();

  // Pattern matching for common questions
  if (lowerMessage.includes('lose weight') || lowerMessage.includes('weight loss')) {
    return {
      response: "For healthy weight loss, I recommend combining regular exercise with mindful eating. Aim for a caloric deficit of 500 calories per day through a combination of diet and exercise. Focus on whole foods, lean proteins, and plenty of vegetables.",
      suggestions: [
        'Start tracking your daily calorie intake',
        'Add 30 minutes of cardio 4-5 times per week',
        'Drink water before meals to help with portion control',
      ],
      relatedGoals: ['WEIGHT_LOSS', 'NUTRITION', 'PHYSICAL_FITNESS'],
    };
  }

  if (lowerMessage.includes('sleep') || lowerMessage.includes('tired')) {
    return {
      response: "Quality sleep is crucial for overall health. Most adults need 7-9 hours of sleep per night. Good sleep hygiene includes maintaining a consistent sleep schedule and creating a relaxing bedtime routine.",
      suggestions: [
        'Set a consistent bedtime and wake time',
        'Avoid screens 1 hour before bed',
        'Keep your bedroom cool and dark',
        'Limit caffeine after 2 PM',
      ],
      relatedGoals: ['SLEEP', 'STRESS_MANAGEMENT'],
    };
  }

  if (lowerMessage.includes('stress') || lowerMessage.includes('anxious')) {
    return {
      response: "Managing stress is essential for both mental and physical health. Regular exercise, mindfulness practices, and adequate sleep can significantly reduce stress levels.",
      suggestions: [
        'Try 10 minutes of meditation daily',
        'Practice deep breathing exercises',
        'Take regular breaks during work',
        'Consider yoga or tai chi',
      ],
      relatedGoals: ['STRESS_MANAGEMENT', 'MINDFULNESS', 'MENTAL_HEALTH'],
    };
  }

  if (lowerMessage.includes('workout') || lowerMessage.includes('exercise')) {
    return {
      response: "A balanced workout routine should include cardio, strength training, and flexibility work. Start with activities you enjoy to build a sustainable habit.",
      suggestions: [
        'Aim for 150 minutes of moderate cardio per week',
        'Include strength training 2-3 times per week',
        'Don\'t skip warm-up and cool-down',
        'Rest days are important for recovery',
      ],
      relatedGoals: ['PHYSICAL_FITNESS', 'STRENGTH', 'ENDURANCE'],
    };
  }

  // Default response
  return {
    response: "I'm here to help you on your wellness journey! I can assist with workout recommendations, nutrition advice, sleep improvement, stress management, and setting health goals. What would you like to focus on?",
    suggestions: [
      'Tell me about your fitness goals',
      'Ask about healthy eating tips',
      'Get help with sleep improvement',
      'Learn stress management techniques',
    ],
    relatedGoals: [],
  };
}

export default router;