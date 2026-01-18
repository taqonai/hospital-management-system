import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { HealthPlatformSource, HealthPlatformDataType } from '@prisma/client';
import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Health Platform Service
 * Handles integration with native health platforms:
 * - Apple HealthKit
 * - Google Health Connect
 * - Samsung Health
 *
 * Provides data normalization, sync management, and aggregation
 */
export class HealthPlatformService {
  /**
   * Sync health data from a platform
   */
  async syncData(
    patientId: string,
    hospitalId: string,
    source: HealthPlatformSource,
    data: Array<{
      dataType: HealthPlatformDataType;
      value: number;
      unit: string;
      timestamp: Date;
      metadata?: any;
    }>
  ) {
    // Create health data points in batch
    const healthDataPoints = data.map(item => ({
      patientId,
      hospitalId,
      source,
      dataType: item.dataType,
      value: item.value,
      unit: item.unit,
      timestamp: item.timestamp,
      metadata: item.metadata || null,
    }));

    const result = await prisma.healthDataPoint.createMany({
      data: healthDataPoints,
      skipDuplicates: true,
    });

    // Update last sync time
    const providerMapping: Record<string, string> = {
      'GOOGLE_HEALTH_CONNECT': 'GOOGLE_FIT',
      'APPLE_HEALTH_KIT': 'APPLE_HEALTH',
      'SAMSUNG_HEALTH': 'SAMSUNG_HEALTH',
    };

    const provider = providerMapping[source];
    if (provider) {
      await prisma.healthDeviceConnection.updateMany({
        where: {
          patientId,
          provider: provider as any,
        },
        data: { lastSyncAt: new Date() },
      });
    }

    // Trigger daily health score recalculation
    await this.triggerScoreCalculation(patientId, hospitalId);

    return {
      synced: result.count,
      source,
      syncedAt: new Date(),
    };
  }

  /**
   * Get aggregated health data for a time range
   */
  async getAggregatedData(
    patientId: string,
    startDate: Date,
    endDate: Date,
    dataTypes?: HealthPlatformDataType[]
  ) {
    const where: any = {
      patientId,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (dataTypes && dataTypes.length > 0) {
      where.dataType = { in: dataTypes };
    }

    const data = await prisma.healthDataPoint.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    // Group by data type and calculate aggregations
    const aggregations: Record<string, any> = {};

    for (const point of data) {
      if (!aggregations[point.dataType]) {
        aggregations[point.dataType] = {
          dataType: point.dataType,
          unit: point.unit,
          values: [],
          min: point.value,
          max: point.value,
          sum: 0,
          count: 0,
        };
      }

      const agg = aggregations[point.dataType];
      agg.values.push({ value: point.value, timestamp: point.timestamp });
      agg.min = Math.min(agg.min, point.value);
      agg.max = Math.max(agg.max, point.value);
      agg.sum += point.value;
      agg.count++;
    }

    // Calculate averages
    return Object.values(aggregations).map((agg: any) => ({
      dataType: agg.dataType,
      unit: agg.unit,
      min: agg.min,
      max: agg.max,
      avg: agg.count > 0 ? agg.sum / agg.count : 0,
      total: agg.sum,
      count: agg.count,
      latestValue: agg.values[0]?.value,
      latestTimestamp: agg.values[0]?.timestamp,
    }));
  }

  /**
   * Get connected platforms for a patient
   */
  async getConnectedPlatforms(patientId: string) {
    const connections = await prisma.healthDeviceConnection.findMany({
      where: { patientId, isActive: true },
      select: {
        id: true,
        provider: true,
        lastSyncAt: true,
        syncFrequency: true,
        scopes: true,
        createdAt: true,
      },
    });

    const platformMapping: Record<string, string> = {
      'GOOGLE_FIT': 'GOOGLE_HEALTH_CONNECT',
      'APPLE_HEALTH': 'APPLE_HEALTH_KIT',
      'SAMSUNG_HEALTH': 'SAMSUNG_HEALTH',
    };

    return connections.map(c => ({
      ...c,
      platform: platformMapping[c.provider] || c.provider,
    }));
  }

  /**
   * Trigger daily health score calculation via AI service
   */
  async triggerScoreCalculation(patientId: string, hospitalId: string) {
    try {
      // Call AI service to calculate health score
      const response = await axios.post(`${AI_SERVICE_URL}/recommendation/calculate-score`, {
        patientId,
        hospitalId,
      });

      if (response.data.score) {
        // Store the calculated score
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.dailyHealthScore.upsert({
          where: {
            patientId_date: {
              patientId,
              date: today,
            },
          },
          update: {
            overall: response.data.score.overall,
            sleep: response.data.score.sleep,
            activity: response.data.score.activity,
            nutrition: response.data.score.nutrition,
            recovery: response.data.score.recovery,
            compliance: response.data.score.compliance,
            stress: response.data.score.stress,
            trend: response.data.score.trend,
            insights: response.data.score.insights,
            dataQuality: response.data.score.dataQuality,
            calculatedAt: new Date(),
          },
          create: {
            patientId,
            hospitalId,
            date: today,
            overall: response.data.score.overall,
            sleep: response.data.score.sleep,
            activity: response.data.score.activity,
            nutrition: response.data.score.nutrition,
            recovery: response.data.score.recovery,
            compliance: response.data.score.compliance,
            stress: response.data.score.stress,
            trend: response.data.score.trend,
            insights: response.data.score.insights,
            dataQuality: response.data.score.dataQuality,
          },
        });
      }

      return response.data;
    } catch (error) {
      // Log error but don't fail the sync
      console.error('Failed to calculate health score:', error);
      return null;
    }
  }

  /**
   * Check if patient has granted consent for health data collection
   */
  async checkConsent(patientId: string): Promise<boolean> {
    const consent = await prisma.patientConsent.findUnique({
      where: {
        patientId_consentType: {
          patientId,
          consentType: 'HEALTH_DATA_COLLECTION',
        },
      },
    });

    return consent?.granted === true && !consent.revokedAt;
  }

  /**
   * Record consent for health data collection
   */
  async recordConsent(
    patientId: string,
    hospitalId: string,
    granted: boolean,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.patientConsent.upsert({
      where: {
        patientId_consentType: {
          patientId,
          consentType: 'HEALTH_DATA_COLLECTION',
        },
      },
      update: {
        granted,
        grantedAt: granted ? new Date() : null,
        revokedAt: granted ? null : new Date(),
        ipAddress,
        userAgent,
      },
      create: {
        patientId,
        hospitalId,
        consentType: 'HEALTH_DATA_COLLECTION',
        granted,
        grantedAt: granted ? new Date() : null,
        ipAddress,
        userAgent,
      },
    });
  }
}

export const healthPlatformService = new HealthPlatformService();
