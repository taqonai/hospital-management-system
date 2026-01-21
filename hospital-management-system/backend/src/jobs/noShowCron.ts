import cron from 'node-cron';
import { noShowService } from '../services/noShowService';

/**
 * NO_SHOW Cron Job
 * Runs every 5 minutes during working hours (7 AM - 10 PM)
 *
 * Tasks:
 * 1. Check for appointments that should be marked as NO_SHOW
 * 2. Process stage alerts for waiting patients
 */

let isProcessing = false;

const processNoShows = async () => {
  if (isProcessing) {
    console.log('[CRON] NO_SHOW processing already in progress, skipping...');
    return;
  }

  isProcessing = true;
  const startTime = Date.now();

  try {
    console.log('[CRON] Starting NO_SHOW check...');

    // Process auto NO_SHOWs
    const noShowResults = await noShowService.processAutoNoShows();
    if (noShowResults.length > 0) {
      console.log(`[CRON] Processed ${noShowResults.length} NO_SHOW appointments`);
      noShowResults.forEach(result => {
        console.log(`  - ${result.patientName} (${result.slotTime}) - Slot Released: ${result.slotReleased}`);
      });
    }

    // Process stage alerts
    const alertResults = await noShowService.processStageAlerts();
    if (alertResults.length > 0) {
      console.log(`[CRON] Created ${alertResults.length} stage alerts`);
      alertResults.forEach(result => {
        console.log(`  - ${result.alertType}: ${result.patientName}`);
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] NO_SHOW check completed in ${duration}ms`);
  } catch (error) {
    console.error('[CRON] Error processing NO_SHOWs:', error);
  } finally {
    isProcessing = false;
  }
};

/**
 * Initialize the NO_SHOW cron job
 * Schedule: Every 5 minutes from 7 AM to 10 PM
 */
export const initNoShowCron = () => {
  // Run every 5 minutes during working hours (7:00 - 22:00)
  // Cron format: minute hour day-of-month month day-of-week
  const schedule = '*/5 7-22 * * *';

  const job = cron.schedule(schedule, processNoShows);

  console.log('[CRON] NO_SHOW cron job initialized - Running every 5 minutes (7 AM - 10 PM)');

  // Run immediately on startup to catch any missed NO_SHOWs
  setTimeout(() => {
    console.log('[CRON] Running initial NO_SHOW check...');
    processNoShows();
  }, 5000); // Wait 5 seconds after startup

  return job;
};

/**
 * Manual trigger for testing
 */
export const triggerNoShowCheck = async () => {
  console.log('[MANUAL] Triggering NO_SHOW check...');
  return processNoShows();
};
