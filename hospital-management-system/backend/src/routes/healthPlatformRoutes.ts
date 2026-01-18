import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import prisma from '../config/database';

const router = Router();

// =============================================================================
// NATIVE HEALTH PLATFORM CONNECTIONS (HealthKit, Health Connect, Samsung Health)
// =============================================================================

const platformConnectSchema = z.object({
  body: z.object({
    platform: z.enum(['GOOGLE_HEALTH_CONNECT', 'APPLE_HEALTH_KIT', 'SAMSUNG_HEALTH']),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    providerUserId: z.string().optional(),
    scopes: z.array(z.string()).optional(),
  }),
});

// Initiate OAuth connection for a health platform
// POST /api/v1/health/connect/:platform
router.post(
  '/connect/:platform',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { platform } = req.params;
    const { accessToken, refreshToken, providerUserId, scopes } = req.body || {};

    const validPlatforms = ['GOOGLE_HEALTH_CONNECT', 'APPLE_HEALTH_KIT', 'SAMSUNG_HEALTH'];
    if (!validPlatforms.includes(platform)) {
      return sendError(res, 'Invalid platform', 400);
    }

    // Map platform to HealthProvider enum
    const providerMapping: Record<string, string> = {
      'GOOGLE_HEALTH_CONNECT': 'GOOGLE_FIT',
      'APPLE_HEALTH_KIT': 'APPLE_HEALTH',
      'SAMSUNG_HEALTH': 'SAMSUNG_HEALTH',
    };

    const provider = providerMapping[platform] as any;

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
        providerUserId,
        scopes: scopes || [],
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        patientId: req.patient!.patientId,
        provider,
        accessToken,
        refreshToken,
        providerUserId,
        scopes: scopes || [],
      },
    });

    sendCreated(res, {
      id: connection.id,
      platform,
      connected: true,
    }, `${platform} connected successfully`);
  })
);

// OAuth callback handler
// GET /api/v1/health/callback/:platform
router.get(
  '/callback/:platform',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { platform } = req.params;
    const { code, state } = req.query;

    // TODO: Implement OAuth token exchange for each platform
    // For now, return stub response
    sendSuccess(res, {
      platform,
      status: 'callback_received',
      code: code ? 'present' : 'missing',
    }, 'OAuth callback received - implementation pending');
  })
);

// Disconnect a health platform
// DELETE /api/v1/health/disconnect/:platform
router.delete(
  '/disconnect/:platform',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { platform } = req.params;

    const providerMapping: Record<string, string> = {
      'GOOGLE_HEALTH_CONNECT': 'GOOGLE_FIT',
      'APPLE_HEALTH_KIT': 'APPLE_HEALTH',
      'SAMSUNG_HEALTH': 'SAMSUNG_HEALTH',
    };

    const provider = providerMapping[platform];
    if (!provider) {
      return sendError(res, 'Invalid platform', 400);
    }

    await prisma.healthDeviceConnection.updateMany({
      where: {
        patientId: req.patient!.patientId,
        provider: provider as any,
      },
      data: {
        isActive: false,
        accessToken: null,
        refreshToken: null,
      },
    });

    sendSuccess(res, null, `${platform} disconnected successfully`);
  })
);

// =============================================================================
// HEALTH DATA SYNC
// =============================================================================

const syncDataSchema = z.object({
  body: z.object({
    data: z.array(z.object({
      dataType: z.enum([
        'STEPS', 'SLEEP_DURATION', 'SLEEP_STAGE', 'HEART_RATE', 'HEART_RATE_RESTING',
        'HRV', 'WORKOUT', 'CALORIES_BURNED', 'BLOOD_OXYGEN', 'STRESS_LEVEL',
        'BLOOD_PRESSURE_SYSTOLIC', 'BLOOD_PRESSURE_DIASTOLIC', 'BLOOD_GLUCOSE',
        'BODY_TEMPERATURE', 'WEIGHT', 'RESPIRATORY_RATE', 'DISTANCE',
        'FLOORS_CLIMBED', 'ACTIVE_MINUTES'
      ]),
      value: z.number(),
      unit: z.string(),
      timestamp: z.string().datetime(),
      metadata: z.any().optional(),
    })),
    source: z.enum(['GOOGLE_HEALTH_CONNECT', 'APPLE_HEALTH_KIT', 'SAMSUNG_HEALTH', 'MANUAL']),
  }),
});

// Receive bulk health data from native platforms
// POST /api/v1/health/sync
router.post(
  '/sync',
  patientAuthenticate,
  validate(syncDataSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { data, source } = req.body;
    const patient = req.patient!;

    // Get hospital ID from patient
    const patientRecord = await prisma.patient.findUnique({
      where: { id: patient.patientId },
      select: { hospitalId: true },
    });

    if (!patientRecord) {
      return sendError(res, 'Patient not found', 404);
    }

    // Batch create health data points
    const healthDataPoints = data.map((item: any) => ({
      patientId: patient.patientId,
      hospitalId: patientRecord.hospitalId,
      source: source as any,
      dataType: item.dataType as any,
      value: item.value,
      unit: item.unit,
      timestamp: new Date(item.timestamp),
      metadata: item.metadata || null,
    }));

    const result = await prisma.healthDataPoint.createMany({
      data: healthDataPoints,
      skipDuplicates: true,
    });

    // Update last sync time for the connection
    const providerMapping: Record<string, string> = {
      'GOOGLE_HEALTH_CONNECT': 'GOOGLE_FIT',
      'APPLE_HEALTH_KIT': 'APPLE_HEALTH',
      'SAMSUNG_HEALTH': 'SAMSUNG_HEALTH',
    };

    const provider = providerMapping[source];
    if (provider) {
      await prisma.healthDeviceConnection.updateMany({
        where: {
          patientId: patient.patientId,
          provider: provider as any,
        },
        data: { lastSyncAt: new Date() },
      });
    }

    sendCreated(res, {
      synced: result.count,
      source,
      syncedAt: new Date().toISOString(),
    }, `Synced ${result.count} health data points`);
  })
);

// =============================================================================
// HEALTH DATA QUERIES
// =============================================================================

// Get normalized health data
// GET /api/v1/health/data
router.get(
  '/data',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { dataType, startDate, endDate, source, limit = '100', offset = '0' } = req.query;

    const where: any = { patientId: req.patient!.patientId };

    if (dataType) {
      where.dataType = dataType;
    }

    if (source) {
      where.source = source;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const [data, total] = await Promise.all([
      prisma.healthDataPoint.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.healthDataPoint.count({ where }),
    ]);

    sendSuccess(res, {
      data,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    }, 'Health data retrieved');
  })
);

// Get daily/weekly aggregations
// GET /api/v1/health/summary
router.get(
  '/summary',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { period = 'day', startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get all health data points for the period
    const data = await prisma.healthDataPoint.findMany({
      where: {
        patientId: req.patient!.patientId,
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Group by data type and calculate aggregations
    const summary: Record<string, any> = {};

    for (const point of data) {
      if (!summary[point.dataType]) {
        summary[point.dataType] = {
          dataType: point.dataType,
          unit: point.unit,
          values: [],
          min: point.value,
          max: point.value,
          sum: 0,
          count: 0,
        };
      }

      const s = summary[point.dataType];
      s.values.push({ value: point.value, timestamp: point.timestamp });
      s.min = Math.min(s.min, point.value);
      s.max = Math.max(s.max, point.value);
      s.sum += point.value;
      s.count++;
    }

    // Calculate averages
    const result = Object.values(summary).map((s: any) => ({
      dataType: s.dataType,
      unit: s.unit,
      min: s.min,
      max: s.max,
      avg: s.count > 0 ? s.sum / s.count : 0,
      total: s.sum,
      count: s.count,
      latestValue: s.values[0]?.value,
      latestTimestamp: s.values[0]?.timestamp,
    }));

    sendSuccess(res, {
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      summary: result,
    }, 'Health summary retrieved');
  })
);

// Get connected platforms status
// GET /api/v1/health/platforms
router.get(
  '/platforms',
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
        scopes: true,
        createdAt: true,
      },
    });

    // Map to platform names
    const platformMapping: Record<string, string> = {
      'GOOGLE_FIT': 'GOOGLE_HEALTH_CONNECT',
      'APPLE_HEALTH': 'APPLE_HEALTH_KIT',
      'SAMSUNG_HEALTH': 'SAMSUNG_HEALTH',
    };

    const platforms = connections.map(c => ({
      ...c,
      platform: platformMapping[c.provider] || c.provider,
    }));

    sendSuccess(res, platforms, 'Connected platforms retrieved');
  })
);

export default router;
