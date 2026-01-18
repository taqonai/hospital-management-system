/**
 * Google Health Connect Adapter
 *
 * This adapter integrates with Google Health Connect on Android devices.
 * It communicates with the native HealthPlatformModule (Kotlin).
 *
 * Requirements:
 * 1. Health Connect app installed on the device
 * 2. Proper permissions declared in AndroidManifest.xml
 * 3. User consent to share data
 */

import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';
import {
  HealthDataType,
  HealthDataPoint,
  HealthPermission,
  SyncOptions,
  SyncResult,
  AuthorizationResult,
  WorkoutData,
  SleepData,
} from '../types';

// Try to get the native module
let HealthPlatformModule: any;
try {
  HealthPlatformModule = requireNativeModule('HealthPlatformModule');
} catch (e) {
  console.warn('[GoogleHealthAdapter] Native module not available:', e);
  HealthPlatformModule = null;
}

export class GoogleHealthAdapter {
  private isInitialized: boolean = false;

  /**
   * Check if Health Connect is available on this device
   */
  async isAvailable(): Promise<boolean> {
    if (!HealthPlatformModule) {
      console.log('[GoogleHealthAdapter] Native module not loaded');
      return false;
    }

    try {
      return await HealthPlatformModule.isAvailable();
    } catch (e) {
      console.error('[GoogleHealthAdapter] isAvailable error:', e);
      return false;
    }
  }

  /**
   * Get SDK status
   */
  async getSdkStatus(): Promise<string> {
    if (!HealthPlatformModule) {
      return 'not_supported';
    }

    try {
      return await HealthPlatformModule.getSdkStatus();
    } catch (e) {
      return 'not_supported';
    }
  }

  /**
   * Check if we're connected and have active permissions
   */
  async isConnected(): Promise<boolean> {
    if (!HealthPlatformModule) {
      return false;
    }

    try {
      const permissions = await HealthPlatformModule.getGrantedPermissions();
      return permissions && permissions.length > 0;
    } catch (e) {
      console.error('[GoogleHealthAdapter] isConnected error:', e);
      return false;
    }
  }

  /**
   * Get current permissions
   */
  async getPermissions(): Promise<HealthPermission[]> {
    if (!HealthPlatformModule) {
      return [];
    }

    try {
      const permissions = await HealthPlatformModule.getGrantedPermissions();
      return permissions.map((p: any) => ({
        dataType: p.dataType as HealthDataType,
        read: p.read ?? false,
        write: p.write ?? false,
      }));
    } catch (e) {
      console.error('[GoogleHealthAdapter] getPermissions error:', e);
      return [];
    }
  }

  /**
   * Request authorization for specified data types
   */
  async requestAuthorization(dataTypes: HealthDataType[]): Promise<AuthorizationResult> {
    if (!HealthPlatformModule) {
      return {
        granted: false,
        permissions: [],
        error: 'Native module not available',
      };
    }

    try {
      const result = await HealthPlatformModule.requestAuthorization(dataTypes);

      if (result.needsPermission) {
        // Need to open Health Connect to grant permissions
        await HealthPlatformModule.openHealthConnectSettings();
        return {
          granted: false,
          permissions: [],
          error: 'Please grant permissions in Health Connect app',
        };
      }

      return {
        granted: result.granted ?? false,
        permissions: (result.permissions || []).map((p: any) => ({
          dataType: p.dataType as HealthDataType,
          read: p.read ?? false,
          write: p.write ?? false,
        })),
        error: result.error,
      };
    } catch (e: any) {
      console.error('[GoogleHealthAdapter] requestAuthorization error:', e);
      return {
        granted: false,
        permissions: [],
        error: e.message || 'Authorization failed',
      };
    }
  }

  /**
   * Sync data from Health Connect
   */
  async syncData(options: SyncOptions): Promise<SyncResult> {
    if (!HealthPlatformModule) {
      return {
        success: false,
        dataPoints: [],
        syncedAt: new Date().toISOString(),
        error: 'Native module not available',
      };
    }

    try {
      const allDataPoints: HealthDataPoint[] = [];

      // Fetch data for each requested data type
      for (const dataType of options.dataTypes) {
        const records = await HealthPlatformModule.readRecords(
          dataType,
          options.startDate,
          options.endDate
        );

        const dataPoints = records.map((r: any) => ({
          dataType: r.dataType as HealthDataType,
          value: r.value,
          unit: r.unit,
          timestamp: r.timestamp,
          metadata: r.metadata,
        }));

        allDataPoints.push(...dataPoints);
      }

      return {
        success: true,
        dataPoints: allDataPoints,
        syncedAt: new Date().toISOString(),
      };
    } catch (e: any) {
      console.error('[GoogleHealthAdapter] syncData error:', e);
      return {
        success: false,
        dataPoints: [],
        syncedAt: new Date().toISOString(),
        error: e.message || 'Sync failed',
      };
    }
  }

  /**
   * Get historical data for a specific type
   */
  async getHistoricalData(
    dataType: HealthDataType,
    startDate: string,
    endDate: string
  ): Promise<HealthDataPoint[]> {
    if (!HealthPlatformModule) {
      return [];
    }

    try {
      const records = await HealthPlatformModule.readRecords(dataType, startDate, endDate);
      return records.map((r: any) => ({
        dataType: r.dataType as HealthDataType,
        value: r.value,
        unit: r.unit,
        timestamp: r.timestamp,
        metadata: r.metadata,
      }));
    } catch (e) {
      console.error('[GoogleHealthAdapter] getHistoricalData error:', e);
      return [];
    }
  }

  /**
   * Get workout/exercise sessions
   */
  async getWorkouts(startDate: string, endDate: string): Promise<WorkoutData[]> {
    if (!HealthPlatformModule) {
      return [];
    }

    try {
      const sessions = await HealthPlatformModule.readExerciseSessions(startDate, endDate);
      return sessions.map((s: any) => ({
        workoutType: s.workoutType as any,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration,
        calories: s.calories,
        distance: s.distance,
        avgHeartRate: s.avgHeartRate,
        maxHeartRate: s.maxHeartRate,
        metadata: s.metadata,
      }));
    } catch (e) {
      console.error('[GoogleHealthAdapter] getWorkouts error:', e);
      return [];
    }
  }

  /**
   * Get sleep data
   */
  async getSleepData(startDate: string, endDate: string): Promise<SleepData[]> {
    if (!HealthPlatformModule) {
      return [];
    }

    try {
      const sessions = await HealthPlatformModule.readSleepSessions(startDate, endDate);
      return sessions.map((s: any) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration,
        stages: s.stages?.map((stage: any) => ({
          stage: stage.stage as any,
          startTime: stage.startTime,
          endTime: stage.endTime,
        })),
      }));
    } catch (e) {
      console.error('[GoogleHealthAdapter] getSleepData error:', e);
      return [];
    }
  }

  /**
   * Get aggregated data
   */
  async getAggregatedData(
    dataType: HealthDataType,
    startDate: string,
    endDate: string
  ): Promise<{ total: number; average: number; min: number; max: number; count: number }> {
    if (!HealthPlatformModule) {
      return { total: 0, average: 0, min: 0, max: 0, count: 0 };
    }

    try {
      return await HealthPlatformModule.aggregateData(dataType, startDate, endDate);
    } catch (e) {
      console.error('[GoogleHealthAdapter] getAggregatedData error:', e);
      return { total: 0, average: 0, min: 0, max: 0, count: 0 };
    }
  }

  /**
   * Disconnect from Health Connect
   */
  async disconnect(): Promise<boolean> {
    // Health Connect doesn't support programmatic disconnection
    // Users must revoke permissions in the Health Connect app
    console.log('[GoogleHealthAdapter] Disconnect requested - user must revoke in Health Connect app');
    return true;
  }

  /**
   * Start background sync
   */
  async startBackgroundSync(): Promise<boolean> {
    // TODO: Implement background sync using WorkManager
    console.log('[GoogleHealthAdapter] Background sync not yet implemented');
    return false;
  }

  /**
   * Stop background sync
   */
  async stopBackgroundSync(): Promise<boolean> {
    return true;
  }

  /**
   * Write data to Health Connect
   */
  async writeData(dataPoint: HealthDataPoint): Promise<boolean> {
    // TODO: Implement write functionality
    console.log('[GoogleHealthAdapter] Write data not yet implemented');
    return false;
  }
}
