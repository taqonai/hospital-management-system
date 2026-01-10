import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache key prefixes
const CACHE_PREFIX = '@hms_cache:';
const CACHE_METADATA_PREFIX = '@hms_cache_meta:';

// Default TTL values in milliseconds
export const CacheTTL = {
  DASHBOARD: 5 * 60 * 1000,        // 5 minutes
  APPOINTMENTS: 15 * 60 * 1000,    // 15 minutes
  PRESCRIPTIONS: 30 * 60 * 1000,   // 30 minutes
  LAB_RESULTS: 60 * 60 * 1000,     // 1 hour
  MEDICAL_HISTORY: 24 * 60 * 60 * 1000, // 24 hours
  MEDICAL_RECORDS: 60 * 60 * 1000, // 1 hour
  DOCTORS: 60 * 60 * 1000,         // 1 hour
  DEPARTMENTS: 24 * 60 * 60 * 1000, // 24 hours
  PROFILE: 60 * 60 * 1000,         // 1 hour
  BILLS: 30 * 60 * 1000,           // 30 minutes
  HEALTH_INSIGHTS: 15 * 60 * 1000, // 15 minutes
};

// Cache keys for different data types
export const CacheKeys = {
  DASHBOARD: 'dashboard',
  APPOINTMENTS: 'appointments',
  PRESCRIPTIONS: 'prescriptions',
  LAB_RESULTS: 'lab_results',
  MEDICAL_HISTORY: 'medical_history',
  MEDICAL_RECORDS: 'medical_records',
  DOCTORS: 'doctors',
  DEPARTMENTS: 'departments',
  PROFILE: 'profile',
  BILLS: 'bills',
  HEALTH_INSIGHTS: 'health_insights',
  ALLERGIES: 'allergies',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
};

interface CacheMetadata {
  timestamp: number;
  ttl: number;
  version: number;
}

interface CacheEntry<T> {
  data: T;
  metadata: CacheMetadata;
}

// Current cache version - increment to invalidate all caches
const CACHE_VERSION = 1;

class CacheManager {
  /**
   * Store data in cache with TTL
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const metadataKey = `${CACHE_METADATA_PREFIX}${key}`;

      const metadata: CacheMetadata = {
        timestamp: Date.now(),
        ttl,
        version: CACHE_VERSION,
      };

      await Promise.all([
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)),
        AsyncStorage.setItem(metadataKey, JSON.stringify(metadata)),
      ]);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Get data from cache if valid (not expired)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const metadataKey = `${CACHE_METADATA_PREFIX}${key}`;

      const [dataStr, metadataStr] = await Promise.all([
        AsyncStorage.getItem(cacheKey),
        AsyncStorage.getItem(metadataKey),
      ]);

      if (!dataStr || !metadataStr) {
        return null;
      }

      const metadata: CacheMetadata = JSON.parse(metadataStr);

      // Check version
      if (metadata.version !== CACHE_VERSION) {
        await this.remove(key);
        return null;
      }

      // Check if expired
      if (Date.now() - metadata.timestamp > metadata.ttl) {
        await this.remove(key);
        return null;
      }

      return JSON.parse(dataStr) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get data from cache regardless of expiration (for offline mode)
   */
  async getStale<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const metadataKey = `${CACHE_METADATA_PREFIX}${key}`;

      const [dataStr, metadataStr] = await Promise.all([
        AsyncStorage.getItem(cacheKey),
        AsyncStorage.getItem(metadataKey),
      ]);

      if (!dataStr) {
        return null;
      }

      const data = JSON.parse(dataStr) as T;

      if (!metadataStr) {
        return { data, isStale: true };
      }

      const metadata: CacheMetadata = JSON.parse(metadataStr);
      const isStale = Date.now() - metadata.timestamp > metadata.ttl;

      return { data, isStale };
    } catch (error) {
      console.error(`Cache getStale error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove a specific cache entry
   */
  async remove(key: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const metadataKey = `${CACHE_METADATA_PREFIX}${key}`;

      await Promise.all([
        AsyncStorage.removeItem(cacheKey),
        AsyncStorage.removeItem(metadataKey),
      ]);
    } catch (error) {
      console.error(`Cache remove error for key ${key}:`, error);
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  async isValid(key: string): Promise<boolean> {
    try {
      const metadataKey = `${CACHE_METADATA_PREFIX}${key}`;
      const metadataStr = await AsyncStorage.getItem(metadataKey);

      if (!metadataStr) {
        return false;
      }

      const metadata: CacheMetadata = JSON.parse(metadataStr);

      if (metadata.version !== CACHE_VERSION) {
        return false;
      }

      return Date.now() - metadata.timestamp <= metadata.ttl;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache age in milliseconds
   */
  async getAge(key: string): Promise<number | null> {
    try {
      const metadataKey = `${CACHE_METADATA_PREFIX}${key}`;
      const metadataStr = await AsyncStorage.getItem(metadataKey);

      if (!metadataStr) {
        return null;
      }

      const metadata: CacheMetadata = JSON.parse(metadataStr);
      return Date.now() - metadata.timestamp;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(
        (key) => key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_METADATA_PREFIX)
      );

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.error('Cache clearAll error:', error);
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpired(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const metadataKeys = allKeys.filter((key) => key.startsWith(CACHE_METADATA_PREFIX));

      const keysToRemove: string[] = [];

      for (const metaKey of metadataKeys) {
        const metadataStr = await AsyncStorage.getItem(metaKey);
        if (!metadataStr) continue;

        const metadata: CacheMetadata = JSON.parse(metadataStr);
        const isExpired =
          metadata.version !== CACHE_VERSION ||
          Date.now() - metadata.timestamp > metadata.ttl;

        if (isExpired) {
          const baseKey = metaKey.replace(CACHE_METADATA_PREFIX, '');
          keysToRemove.push(`${CACHE_PREFIX}${baseKey}`, metaKey);
        }
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Cache clearExpired error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    totalSize: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key) => key.startsWith(CACHE_PREFIX));

      let validEntries = 0;
      let expiredEntries = 0;
      let totalSize = 0;

      for (const cacheKey of cacheKeys) {
        const baseKey = cacheKey.replace(CACHE_PREFIX, '');
        const isValid = await this.isValid(baseKey);

        if (isValid) {
          validEntries++;
        } else {
          expiredEntries++;
        }

        const data = await AsyncStorage.getItem(cacheKey);
        if (data) {
          totalSize += data.length;
        }
      }

      return {
        totalEntries: cacheKeys.length,
        validEntries,
        expiredEntries,
        totalSize,
      };
    } catch (error) {
      console.error('Cache getStats error:', error);
      return {
        totalEntries: 0,
        validEntries: 0,
        expiredEntries: 0,
        totalSize: 0,
      };
    }
  }
}

export const cacheManager = new CacheManager();
export default cacheManager;
