import { api } from './client';
import { ApiResponse } from '../../types';

// ==================== Types ====================

export type HealthPlatformType =
  | 'GOOGLE_HEALTH_CONNECT'
  | 'APPLE_HEALTH_KIT'
  | 'SAMSUNG_HEALTH';

export type HealthDataType =
  | 'STEPS'
  | 'SLEEP_DURATION'
  | 'SLEEP_STAGE'
  | 'HEART_RATE'
  | 'HEART_RATE_RESTING'
  | 'HRV'
  | 'WORKOUT'
  | 'CALORIES_BURNED'
  | 'BLOOD_OXYGEN'
  | 'STRESS_LEVEL'
  | 'BLOOD_PRESSURE_SYSTOLIC'
  | 'BLOOD_PRESSURE_DIASTOLIC'
  | 'BLOOD_GLUCOSE'
  | 'BODY_TEMPERATURE'
  | 'WEIGHT'
  | 'RESPIRATORY_RATE'
  | 'DISTANCE'
  | 'FLOORS_CLIMBED'
  | 'ACTIVE_MINUTES';

export interface HealthDataPoint {
  dataType: HealthDataType;
  value: number;
  unit: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PlatformConnection {
  id: string;
  platform: HealthPlatformType;
  provider: string;
  isActive: boolean;
  lastSyncAt?: string;
  syncFrequency?: string;
  scopes: string[];
  createdAt: string;
}

export interface ConnectPlatformData {
  platform: HealthPlatformType;
  accessToken?: string;
  refreshToken?: string;
  providerUserId?: string;
  scopes?: string[];
}

export interface SyncHealthDataRequest {
  data: Array<{
    dataType: HealthDataType;
    value: number;
    unit: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
  source: HealthPlatformType | 'MANUAL';
}

export interface SyncHealthDataResponse {
  synced: number;
  source: string;
  syncedAt: string;
}

export interface HealthDataQuery {
  dataType?: HealthDataType;
  startDate?: string;
  endDate?: string;
  source?: HealthPlatformType;
  limit?: number;
  offset?: number;
}

export interface HealthDataResponse {
  data: HealthDataPoint[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface HealthSummary {
  dataType: string;
  unit: string;
  min: number;
  max: number;
  avg: number;
  total: number;
  count: number;
  latestValue: number;
  latestTimestamp: string;
}

export interface HealthSummaryResponse {
  period: string;
  startDate: string;
  endDate: string;
  summary: HealthSummary[];
}

// ==================== API Functions ====================

/**
 * Connect to a health platform
 */
export const connectPlatform = async (
  data: ConnectPlatformData
): Promise<ApiResponse<{ id: string; platform: string; connected: boolean }>> => {
  const response = await api.post(`/health/connect/${data.platform}`, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    providerUserId: data.providerUserId,
    scopes: data.scopes,
  });
  return response.data;
};

/**
 * Disconnect from a health platform
 */
export const disconnectPlatform = async (
  platform: HealthPlatformType
): Promise<ApiResponse<null>> => {
  const response = await api.delete(`/health/disconnect/${platform}`);
  return response.data;
};

/**
 * Get connected platforms status
 */
export const getConnectedPlatforms = async (): Promise<ApiResponse<PlatformConnection[]>> => {
  const response = await api.get('/health/platforms');
  return response.data;
};

/**
 * Sync health data to backend
 */
export const syncHealthData = async (
  data: SyncHealthDataRequest
): Promise<ApiResponse<SyncHealthDataResponse>> => {
  const response = await api.post('/health/sync', data);
  return response.data;
};

/**
 * Query health data
 */
export const getHealthData = async (
  query: HealthDataQuery
): Promise<ApiResponse<HealthDataResponse>> => {
  const params = new URLSearchParams();
  if (query.dataType) params.append('dataType', query.dataType);
  if (query.startDate) params.append('startDate', query.startDate);
  if (query.endDate) params.append('endDate', query.endDate);
  if (query.source) params.append('source', query.source);
  if (query.limit) params.append('limit', query.limit.toString());
  if (query.offset) params.append('offset', query.offset.toString());

  const url = `/health/data${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await api.get(url);
  return response.data;
};

/**
 * Get health summary for a period
 */
export const getHealthSummary = async (
  period: 'day' | 'week' | 'month' = 'week',
  startDate?: string,
  endDate?: string
): Promise<ApiResponse<HealthSummaryResponse>> => {
  const params = new URLSearchParams();
  params.append('period', period);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await api.get(`/health/summary?${params.toString()}`);
  return response.data;
};

// Export API object for consistent interface
export const healthPlatformApi = {
  connectPlatform,
  disconnectPlatform,
  getConnectedPlatforms,
  syncHealthData,
  getHealthData,
  getHealthSummary,
};

export default healthPlatformApi;
