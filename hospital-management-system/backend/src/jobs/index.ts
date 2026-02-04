import { initNoShowCron } from './noShowCron';
import { initAutoReorderCron } from './autoReorderCron';
import { initBillingCron } from './billingCron';
import { ipdInsuranceMonitorService } from '../services/ipdInsuranceMonitorService';

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

  // Initialize billing cron jobs (overdue reminders + IPD daily charges)
  initBillingCron();

  // Initialize IPD insurance expiry monitoring
  ipdInsuranceMonitorService.initializeCronJob();

  console.log('[JOBS] All cron jobs initialized');
};

export { triggerNoShowCheck, externalTriggerNoShowCheck, getCronHealth } from './noShowCron';
export { triggerAutoReorderCheck, getAutoReorderCronHealth } from './autoReorderCron';
export { triggerOverdueReminders, triggerIPDCharges, getBillingCronHealth } from './billingCron';
