import { initNoShowCron } from './noShowCron';

/**
 * Initialize all cron jobs
 * Called from app.ts on server startup
 */
export const initCronJobs = () => {
  console.log('[JOBS] Initializing cron jobs...');

  // Initialize NO_SHOW cron job
  initNoShowCron();

  console.log('[JOBS] All cron jobs initialized');
};

export { triggerNoShowCheck, externalTriggerNoShowCheck, getCronHealth } from './noShowCron';
