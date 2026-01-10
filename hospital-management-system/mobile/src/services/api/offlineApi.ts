import NetInfo from '@react-native-community/netinfo';
import { cacheManager, CacheTTL, CacheKeys, offlineActionQueue, QueuedActionType } from '../offline';
import { patientPortalApi } from './patientPortal';
import { ApiResponse } from '../../types';

interface OfflineOptions {
  cacheKey: string;
  cacheTTL: number;
  forceRefresh?: boolean;
}

interface OfflineResult<T> {
  data: T;
  isFromCache: boolean;
  isStale: boolean;
}

/**
 * Check if the device is online
 */
async function isOnline(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true && netInfo.isInternetReachable !== false;
}

/**
 * Wrapper for GET requests with offline caching support
 */
async function cachedGet<T>(
  fetcher: () => Promise<{ data: ApiResponse<T> }>,
  options: OfflineOptions
): Promise<OfflineResult<T>> {
  const { cacheKey, cacheTTL, forceRefresh } = options;
  const online = await isOnline();

  // If online and not forcing cache, try to fetch fresh data
  if (online && !forceRefresh) {
    try {
      const response = await fetcher();
      const data = response.data?.data as T;

      // Cache the response
      if (data) {
        await cacheManager.set(cacheKey, data, cacheTTL);
      }

      return { data, isFromCache: false, isStale: false };
    } catch (error) {
      // If fetch fails, try to get from cache
      const cached = await cacheManager.getStale<T>(cacheKey);
      if (cached) {
        return { data: cached.data, isFromCache: true, isStale: cached.isStale };
      }
      throw error;
    }
  }

  // Offline or force cache - get from cache
  const cached = await cacheManager.getStale<T>(cacheKey);
  if (cached) {
    return { data: cached.data, isFromCache: true, isStale: cached.isStale };
  }

  // No cached data available
  if (!online) {
    throw new Error('No internet connection and no cached data available');
  }

  // Online but cache miss - fetch from server
  const response = await fetcher();
  const data = response.data?.data as T;

  if (data) {
    await cacheManager.set(cacheKey, data, cacheTTL);
  }

  return { data, isFromCache: false, isStale: false };
}

/**
 * Queue an action for later execution when offline
 */
async function queueAction(
  type: QueuedActionType,
  payload: Record<string, any>,
  executor?: () => Promise<any>
): Promise<{ queued: boolean; result?: any }> {
  const online = await isOnline();

  if (online && executor) {
    try {
      const result = await executor();
      return { queued: false, result };
    } catch (error) {
      // If online but request fails, don't queue (might be a server error)
      throw error;
    }
  }

  // Offline - queue the action
  await offlineActionQueue.enqueue(type, payload);
  return { queued: true };
}

/**
 * Offline-aware Patient Portal API
 */
export const offlinePatientApi = {
  // Dashboard
  async getSummary(forceRefresh = false) {
    return cachedGet(
      () => patientPortalApi.getSummary(),
      {
        cacheKey: CacheKeys.DASHBOARD,
        cacheTTL: CacheTTL.DASHBOARD,
        forceRefresh,
      }
    );
  },

  // Appointments
  async getAppointments(params?: Parameters<typeof patientPortalApi.getAppointments>[0], forceRefresh = false) {
    const cacheKey = params
      ? `${CacheKeys.APPOINTMENTS}_${JSON.stringify(params)}`
      : CacheKeys.APPOINTMENTS;

    return cachedGet(
      () => patientPortalApi.getAppointments(params),
      {
        cacheKey,
        cacheTTL: CacheTTL.APPOINTMENTS,
        forceRefresh,
      }
    );
  },

  async cancelAppointment(id: string, reason?: string) {
    return queueAction(
      'CANCEL_APPOINTMENT',
      { id, reason },
      () => patientPortalApi.cancelAppointment(id, reason)
    );
  },

  async rescheduleAppointment(id: string, data: { appointmentDate: string; startTime: string }) {
    return queueAction(
      'RESCHEDULE_APPOINTMENT',
      { id, ...data },
      () => patientPortalApi.rescheduleAppointment(id, data)
    );
  },

  // Doctors and Departments (read-only, cache only)
  async getDoctors(params?: Parameters<typeof patientPortalApi.getDoctors>[0], forceRefresh = false) {
    const cacheKey = params
      ? `${CacheKeys.DOCTORS}_${JSON.stringify(params)}`
      : CacheKeys.DOCTORS;

    return cachedGet(
      () => patientPortalApi.getDoctors(params),
      {
        cacheKey,
        cacheTTL: CacheTTL.DOCTORS,
        forceRefresh,
      }
    );
  },

  async getDepartments(forceRefresh = false) {
    return cachedGet(
      () => patientPortalApi.getDepartments(),
      {
        cacheKey: CacheKeys.DEPARTMENTS,
        cacheTTL: CacheTTL.DEPARTMENTS,
        forceRefresh,
      }
    );
  },

  // Medical Records
  async getMedicalRecords(params?: Parameters<typeof patientPortalApi.getMedicalRecords>[0], forceRefresh = false) {
    const cacheKey = params
      ? `${CacheKeys.MEDICAL_RECORDS}_${JSON.stringify(params)}`
      : CacheKeys.MEDICAL_RECORDS;

    return cachedGet(
      () => patientPortalApi.getMedicalRecords(params),
      {
        cacheKey,
        cacheTTL: CacheTTL.MEDICAL_RECORDS,
        forceRefresh,
      }
    );
  },

  // Prescriptions
  async getPrescriptions(params?: Parameters<typeof patientPortalApi.getPrescriptions>[0], forceRefresh = false) {
    const cacheKey = params
      ? `${CacheKeys.PRESCRIPTIONS}_${JSON.stringify(params)}`
      : CacheKeys.PRESCRIPTIONS;

    return cachedGet(
      () => patientPortalApi.getPrescriptions(params),
      {
        cacheKey,
        cacheTTL: CacheTTL.PRESCRIPTIONS,
        forceRefresh,
      }
    );
  },

  async requestRefill(id: string) {
    return queueAction(
      'REQUEST_REFILL',
      { id },
      () => patientPortalApi.requestRefill(id)
    );
  },

  // Lab Results
  async getLabResults(params?: Parameters<typeof patientPortalApi.getLabResults>[0], forceRefresh = false) {
    const cacheKey = params
      ? `${CacheKeys.LAB_RESULTS}_${JSON.stringify(params)}`
      : CacheKeys.LAB_RESULTS;

    return cachedGet(
      () => patientPortalApi.getLabResults(params),
      {
        cacheKey,
        cacheTTL: CacheTTL.LAB_RESULTS,
        forceRefresh,
      }
    );
  },

  // Billing
  async getBills(params?: Parameters<typeof patientPortalApi.getBills>[0], forceRefresh = false) {
    const cacheKey = params
      ? `${CacheKeys.BILLS}_${JSON.stringify(params)}`
      : CacheKeys.BILLS;

    return cachedGet(
      () => patientPortalApi.getBills(params),
      {
        cacheKey,
        cacheTTL: CacheTTL.BILLS,
        forceRefresh,
      }
    );
  },

  // Health Insights
  async getHealthInsights(forceRefresh = false) {
    return cachedGet(
      () => patientPortalApi.getHealthInsights(),
      {
        cacheKey: CacheKeys.HEALTH_INSIGHTS,
        cacheTTL: CacheTTL.HEALTH_INSIGHTS,
        forceRefresh,
      }
    );
  },

  // Medical History
  async getMedicalHistory(forceRefresh = false) {
    return cachedGet(
      () => patientPortalApi.getMedicalHistory(),
      {
        cacheKey: CacheKeys.MEDICAL_HISTORY,
        cacheTTL: CacheTTL.MEDICAL_HISTORY,
        forceRefresh,
      }
    );
  },

  async updateMedicalHistory(data: Parameters<typeof patientPortalApi.updateMedicalHistory>[0]) {
    return queueAction(
      'UPDATE_MEDICAL_HISTORY',
      data,
      () => patientPortalApi.updateMedicalHistory(data)
    );
  },

  // Allergies
  async getAllergies(forceRefresh = false) {
    return cachedGet(
      () => patientPortalApi.getAllergies(),
      {
        cacheKey: CacheKeys.ALLERGIES,
        cacheTTL: CacheTTL.MEDICAL_HISTORY,
        forceRefresh,
      }
    );
  },

  async addAllergy(data: Parameters<typeof patientPortalApi.addAllergy>[0]) {
    return queueAction(
      'ADD_ALLERGY',
      data as Record<string, any>,
      () => patientPortalApi.addAllergy(data)
    );
  },

  async updateAllergy(id: string, data: Parameters<typeof patientPortalApi.updateAllergy>[1]) {
    return queueAction(
      'UPDATE_ALLERGY',
      { id, ...data },
      () => patientPortalApi.updateAllergy(id, data)
    );
  },

  async deleteAllergy(id: string) {
    return queueAction(
      'DELETE_ALLERGY',
      { id },
      () => patientPortalApi.deleteAllergy(id)
    );
  },

  // Settings
  async getNotificationPreferences(forceRefresh = false) {
    return cachedGet(
      () => patientPortalApi.getNotificationPreferences(),
      {
        cacheKey: CacheKeys.NOTIFICATION_PREFERENCES,
        cacheTTL: CacheTTL.PROFILE,
        forceRefresh,
      }
    );
  },

  async updateNotificationPreferences(data: Parameters<typeof patientPortalApi.updateNotificationPreferences>[0]) {
    return queueAction(
      'UPDATE_NOTIFICATION_PREFERENCES',
      data,
      () => patientPortalApi.updateNotificationPreferences(data)
    );
  },

  async updateCommunicationPreferences(data: Parameters<typeof patientPortalApi.updateCommunicationPreferences>[0]) {
    return queueAction(
      'UPDATE_COMMUNICATION_PREFERENCES',
      data,
      () => patientPortalApi.updateCommunicationPreferences(data)
    );
  },
};

// Register action handlers for the queue
offlineActionQueue.registerHandler('CANCEL_APPOINTMENT', async (payload) => {
  await patientPortalApi.cancelAppointment(payload.id, payload.reason);
});

offlineActionQueue.registerHandler('RESCHEDULE_APPOINTMENT', async (payload) => {
  await patientPortalApi.rescheduleAppointment(payload.id, {
    appointmentDate: payload.appointmentDate,
    startTime: payload.startTime,
  });
});

offlineActionQueue.registerHandler('REQUEST_REFILL', async (payload) => {
  await patientPortalApi.requestRefill(payload.id);
});

offlineActionQueue.registerHandler('UPDATE_MEDICAL_HISTORY', async (payload) => {
  await patientPortalApi.updateMedicalHistory(payload);
});

offlineActionQueue.registerHandler('ADD_ALLERGY', async (payload) => {
  const { id, ...data } = payload;
  await patientPortalApi.addAllergy(data as any);
});

offlineActionQueue.registerHandler('UPDATE_ALLERGY', async (payload) => {
  const { id, ...data } = payload;
  await patientPortalApi.updateAllergy(id, data);
});

offlineActionQueue.registerHandler('DELETE_ALLERGY', async (payload) => {
  await patientPortalApi.deleteAllergy(payload.id);
});

offlineActionQueue.registerHandler('UPDATE_NOTIFICATION_PREFERENCES', async (payload) => {
  await patientPortalApi.updateNotificationPreferences(payload);
});

offlineActionQueue.registerHandler('UPDATE_COMMUNICATION_PREFERENCES', async (payload) => {
  await patientPortalApi.updateCommunicationPreferences(payload);
});

export default offlinePatientApi;
