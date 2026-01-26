import { initNoShowCron } from './noShowCron';
import { initAutoReorderCron } from './autoReorderCron';

/**
 * Initialize all cron jobs
 * Called from app.ts on server startup
 */
export const initCronJobs = () => {
  console.log('[JOBS] Initializing cron jobs...');

  // Initialize NO_SHOW cron job
  initNoShowCron();

  // Initialize AUTO_REORDER cron job
  initAutoReorderCron();

  console.log('[JOBS] All cron jobs initialized');
};

export { triggerNoShowCheck, externalTriggerNoShowCheck, getCronHealth } from './noShowCron';
export { triggerAutoReorderCheck, getAutoReorderCronHealth } from './autoReorderCron';
