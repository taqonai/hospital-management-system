import { Platform } from 'react-native';
import {
  HealthPlatformType,
  HealthDataType,
  HealthDataPoint,
  HealthPlatformStatus,
  SyncOptions,
  SyncResult,
  AuthorizationResult,
  WorkoutData,
  SleepData,
} from './types';
import { GoogleHealthAdapter } from './adapters/GoogleHealthAdapter';
import { AppleHealthAdapter } from './adapters/AppleHealthAdapter';
import { SamsungHealthAdapter } from './adapters/SamsungHealthAdapter';

/**
 * Health Platform Service
 *
 * Main service class that provides a unified interface for interacting with
 * native health platforms. Automatically selects the appropriate adapter
 * based on the device platform.
 */
export class HealthPlatformService {
  private static instance: HealthPlatformService;
  private adapter: GoogleHealthAdapter | AppleHealthAdapter | SamsungHealthAdapter | null = null;
  private platformType: HealthPlatformType | null = null;

  private constructor() {
    this.initializeAdapter();
  }

  public static getInstance(): HealthPlatformService {
    if (!HealthPlatformService.instance) {
      HealthPlatformService.instance = new HealthPlatformService();
    }
    return HealthPlatformService.instance;
  }

  /**
   * Initialize the appropriate adapter based on platform
   */
  private initializeAdapter(): void {
    if (Platform.OS === 'ios') {
      this.adapter = new AppleHealthAdapter();
      this.platformType = 'APPLE_HEALTH_KIT';
    } else if (Platform.OS === 'android') {
      // Check if Samsung Health is available, otherwise use Health Connect
      // For now, default to Health Connect
      this.adapter = new GoogleHealthAdapter();
      this.platformType = 'GOOGLE_HEALTH_CONNECT';
    }
  }

  /**
   * Get the current platform type
   */
  public getPlatformType(): HealthPlatformType | null {
    return this.platformType;
  }

  /**
   * Check if health platform is available on this device
   */
  public async isAvailable(): Promise<boolean> {
    if (!this.adapter) {
      return false;
    }
    return this.adapter.isAvailable();
  }

  /**
   * Get the current status of the health platform connection
   */
  public async getStatus(): Promise<HealthPlatformStatus> {
    if (!this.adapter || !this.platformType) {
      return {
        platform: 'GOOGLE_HEALTH_CONNECT',
        isAvailable: false,
        isConnected: false,
        permissions: [],
      };
    }

    const isAvailable = await this.adapter.isAvailable();
    const isConnected = await this.adapter.isConnected();
    const permissions = await this.adapter.getPermissions();

    return {
      platform: this.platformType,
      isAvailable,
      isConnected,
      permissions,
    };
  }

  /**
   * Request authorization to access health data
   *
   * @param dataTypes - Array of data types to request access for
   */
  public async requestAuthorization(
    dataTypes: HealthDataType[]
  ): Promise<AuthorizationResult> {
    if (!this.adapter) {
      return {
        granted: false,
        permissions: [],
        error: 'Health platform not available',
      };
    }

    return this.adapter.requestAuthorization(dataTypes);
  }

  /**
   * Sync health data from the platform
   *
   * @param options - Sync options including date range and data types
   */
  public async syncData(options: SyncOptions): Promise<SyncResult> {
    if (!this.adapter) {
      return {
        success: false,
        dataPoints: [],
        syncedAt: new Date().toISOString(),
        error: 'Health platform not available',
      };
    }

    return this.adapter.syncData(options);
  }

  /**
   * Get historical data for a specific data type
   *
   * @param dataType - Type of data to retrieve
   * @param startDate - Start date (ISO 8601)
   * @param endDate - End date (ISO 8601)
   */
  public async getHistoricalData(
    dataType: HealthDataType,
    startDate: string,
    endDate: string
  ): Promise<HealthDataPoint[]> {
    if (!this.adapter) {
      return [];
    }

    return this.adapter.getHistoricalData(dataType, startDate, endDate);
  }

  /**
   * Get workout data
   *
   * @param startDate - Start date (ISO 8601)
   * @param endDate - End date (ISO 8601)
   */
  public async getWorkouts(
    startDate: string,
    endDate: string
  ): Promise<WorkoutData[]> {
    if (!this.adapter) {
      return [];
    }

    return this.adapter.getWorkouts(startDate, endDate);
  }

  /**
   * Get sleep data
   *
   * @param startDate - Start date (ISO 8601)
   * @param endDate - End date (ISO 8601)
   */
  public async getSleepData(
    startDate: string,
    endDate: string
  ): Promise<SleepData[]> {
    if (!this.adapter) {
      return [];
    }

    return this.adapter.getSleepData(startDate, endDate);
  }

  /**
   * Disconnect from the health platform
   */
  public async disconnect(): Promise<boolean> {
    if (!this.adapter) {
      return false;
    }

    return this.adapter.disconnect();
  }

  /**
   * Start background sync (for periodic data collection)
   */
  public async startBackgroundSync(): Promise<boolean> {
    if (!this.adapter) {
      return false;
    }

    return this.adapter.startBackgroundSync();
  }

  /**
   * Stop background sync
   */
  public async stopBackgroundSync(): Promise<boolean> {
    if (!this.adapter) {
      return false;
    }

    return this.adapter.stopBackgroundSync();
  }

  /**
   * Write data to the health platform (if supported)
   *
   * @param dataPoint - Data point to write
   */
  public async writeData(dataPoint: HealthDataPoint): Promise<boolean> {
    if (!this.adapter) {
      return false;
    }

    return this.adapter.writeData(dataPoint);
  }
}

// Export singleton instance
export const healthPlatformService = HealthPlatformService.getInstance();
