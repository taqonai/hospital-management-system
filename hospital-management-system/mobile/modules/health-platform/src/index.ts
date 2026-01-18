/**
 * Health Platform Module
 *
 * This module provides native integration with health platforms:
 * - Apple HealthKit (iOS)
 * - Google Health Connect (Android)
 * - Samsung Health (Android)
 *
 * Usage:
 * ```typescript
 * import { HealthPlatformService } from '@modules/health-platform';
 *
 * // Check platform availability
 * const status = await HealthPlatformService.getStatus();
 *
 * // Request permissions
 * const auth = await HealthPlatformService.requestAuthorization(['STEPS', 'HEART_RATE']);
 *
 * // Sync data
 * const data = await HealthPlatformService.syncData({
 *   startDate: '2024-01-01T00:00:00Z',
 *   endDate: '2024-01-07T00:00:00Z',
 *   dataTypes: ['STEPS', 'HEART_RATE'],
 * });
 * ```
 */

export * from './types';
export { HealthPlatformService, healthPlatformService } from './HealthPlatformService';
export { GoogleHealthAdapter } from './adapters/GoogleHealthAdapter';
export { AppleHealthAdapter } from './adapters/AppleHealthAdapter';
export { SamsungHealthAdapter } from './adapters/SamsungHealthAdapter';
