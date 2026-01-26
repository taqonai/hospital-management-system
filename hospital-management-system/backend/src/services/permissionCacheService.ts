import Redis from 'ioredis';
import { config } from '../config';
import { rbacService } from './rbacService';

const CACHE_PREFIX = 'permissions:';
const CACHE_TTL = 300; // 5 minutes

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('[PermissionCache] Redis error:', err.message);
    });

    redis.connect().catch((err) => {
      console.error('[PermissionCache] Redis connection failed:', err.message);
    });
  }
  return redis;
}

/**
 * Get cached permissions for a user.
 * If not cached, fetches from DB via rbacService and caches.
 * Returns null if both cache and DB fail (caller should handle fallback).
 */
export async function getCachedPermissions(userId: string): Promise<string[] | null> {
  try {
    const r = getRedis();
    const key = `${CACHE_PREFIX}${userId}`;

    // Try cache first
    const cached = await r.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Cache miss — fetch from DB
    const permissions = await rbacService.getUserPermissions(userId);

    // Store in cache
    await r.setex(key, CACHE_TTL, JSON.stringify(permissions));

    return permissions;
  } catch (error) {
    console.error('[PermissionCache] getCachedPermissions error:', (error as Error).message);
    // Fall back to direct DB query if Redis is down
    try {
      return await rbacService.getUserPermissions(userId);
    } catch (dbError) {
      console.error('[PermissionCache] DB fallback also failed:', (dbError as Error).message);
      return null;
    }
  }
}

/**
 * Invalidate cached permissions for a specific user.
 */
export async function invalidatePermissions(userId: string): Promise<void> {
  try {
    const r = getRedis();
    await r.del(`${CACHE_PREFIX}${userId}`);
  } catch (error) {
    console.error('[PermissionCache] invalidatePermissions error:', (error as Error).message);
  }
}

/**
 * Invalidate ALL cached permissions (e.g., after a role definition change).
 */
export async function invalidateAllPermissions(): Promise<void> {
  try {
    const r = getRedis();
    const keys = await r.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await r.del(...keys);
    }
  } catch (error) {
    console.error('[PermissionCache] invalidateAllPermissions error:', (error as Error).message);
  }
}
