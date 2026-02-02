import cron from 'node-cron';
import { noShowService } from '../services/noShowService';
import { prisma } from '../config/database';
import { NotificationType } from '@prisma/client';
import { notificationService, NotificationChannel } from '../services/notificationService';

/**
 * NO_SHOW Cron Job
 * Runs every 5 minutes during working hours (7 AM - 10 PM)
 *
 * Tasks:
 * 1. Check for appointments that should be marked as NO_SHOW
 * 2. Process stage alerts for waiting patients
 *
 * Health Monitoring:
 * - Each run is logged to cron_job_runs table
 * - Health endpoint checks last successful run
 * - External cron can trigger via API as backup
 */

const JOB_NAME = 'NO_SHOW_CHECK';
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max processing time
let isProcessing = false;
let processingStartTime: number | null = null;
let lastRunTime: Date | null = null;
let lastRunStatus: 'success' | 'error' | null = null;
let consecutiveFailures = 0;

const processNoShows = async (source: 'cron' | 'manual' | 'external' = 'cron') => {
  // Check for stuck processing (timeout protection)
  if (isProcessing && processingStartTime) {
    const elapsed = Date.now() - processingStartTime;
    if (elapsed > PROCESSING_TIMEOUT_MS) {
      console.error(`[CRON] Previous run stuck for ${Math.round(elapsed / 1000)}s, resetting flag...`);
      isProcessing = false;
      processingStartTime = null;
      consecutiveFailures++;
    } else {
      console.log('[CRON] NO_SHOW processing already in progress, skipping...');
      return { skipped: true, reason: 'already_processing' };
    }
  }

  isProcessing = true;
  processingStartTime = Date.now();
  const startTime = Date.now();
  let runId: string | null = null;

  try {
    // Log run start to database
    const run = await prisma.cronJobRun.create({
      data: {
        jobName: JOB_NAME,
        status: 'RUNNING',
        metadata: { source },
      },
    });
    runId = run.id;

    console.log(`[CRON] Starting NO_SHOW check (source: ${source})...`);

    // Process auto NO_SHOWs
    const noShowResults = await noShowService.processAutoNoShows();
    if (noShowResults.length > 0) {
      console.log(`[CRON] Processed ${noShowResults.length} NO_SHOW appointments`);
      noShowResults.forEach(result => {
        console.log(`  - ${result.patientName} (${result.slotTime}) - Slot Released: ${result.slotReleased}`);
      });
    }

    // Auto-complete past-date CHECKED_IN / IN_PROGRESS appointments
    const autoCompleteResults = await noShowService.processAutoComplete();
    if (autoCompleteResults.length > 0) {
      console.log(`[CRON] Auto-completed ${autoCompleteResults.length} stale appointments`);
      autoCompleteResults.forEach(result => {
        console.log(`  - ${result.patientName} (was ${result.previousStatus})`);
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

    // Update run status to completed
    await prisma.cronJobRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        durationMs: duration,
        itemsProcessed: noShowResults.length + autoCompleteResults.length + alertResults.length,
        metadata: {
          source,
          noShowsProcessed: noShowResults.length,
          autoCompleted: autoCompleteResults.length,
          alertsCreated: alertResults.length,
        },
      },
    });

    lastRunTime = new Date();
    lastRunStatus = 'success';
    consecutiveFailures = 0;

    return {
      success: true,
      duration,
      noShowsProcessed: noShowResults.length,
      alertsCreated: alertResults.length,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CRON] Error processing NO_SHOWs:', error);

    // Update run status to failed
    if (runId) {
      await prisma.cronJobRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          durationMs: duration,
          errorMessage,
        },
      }).catch(e => console.error('[CRON] Failed to update run status:', e));
    }

    lastRunTime = new Date();
    lastRunStatus = 'error';
    consecutiveFailures++;

    // Alert if too many consecutive failures
    if (consecutiveFailures >= 3) {
      console.error(`[CRON] ALERT: ${consecutiveFailures} consecutive failures for ${JOB_NAME}`);

      // Send notification to hospital admins
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'HOSPITAL_ADMIN', isActive: true },
          select: { id: true },
        });

        for (const admin of admins) {
          await notificationService.sendNotification(
            admin.id,
            'SYSTEM' as NotificationType,
            {
              title: 'Cron Job Alert',
              message: `${JOB_NAME} cron job has failed ${consecutiveFailures} times consecutively. Last error: ${errorMessage}`,
              priority: 'high',
              metadata: {
                jobName: JOB_NAME,
                consecutiveFailures,
                lastError: errorMessage,
              },
            },
            ['in_app', 'email'] as NotificationChannel[]
          );
        }
      } catch (notifyError) {
        console.error('[CRON] Failed to send admin notification:', notifyError);
      }
    }

    return {
      success: false,
      duration,
      error: errorMessage,
    };
  } finally {
    isProcessing = false;
    processingStartTime = null;
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

  const job = cron.schedule(schedule, () => processNoShows('cron'));

  console.log('[CRON] NO_SHOW cron job initialized - Running every 5 minutes (7 AM - 10 PM)');

  // Run immediately on startup to catch any missed NO_SHOWs
  setTimeout(() => {
    console.log('[CRON] Running initial NO_SHOW check...');
    processNoShows('cron');
  }, 5000); // Wait 5 seconds after startup

  return job;
};

/**
 * Manual trigger for testing/admin
 */
export const triggerNoShowCheck = async () => {
  console.log('[MANUAL] Triggering NO_SHOW check...');
  return processNoShows('manual');
};

/**
 * External trigger - called by external cron (CloudWatch, system cron) as backup
 */
export const externalTriggerNoShowCheck = async () => {
  console.log('[EXTERNAL] External trigger for NO_SHOW check...');
  return processNoShows('external');
};

/**
 * Get cron health status
 */
export const getCronHealth = async () => {
  // Get last 10 runs
  const recentRuns = await prisma.cronJobRun.findMany({
    where: { jobName: JOB_NAME },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });

  const lastSuccessfulRun = recentRuns.find(r => r.status === 'COMPLETED');
  const failedRuns = recentRuns.filter(r => r.status === 'FAILED').length;

  // Check if cron is healthy (last successful run within 10 minutes during working hours)
  const now = new Date();
  const currentHour = now.getHours();
  const isWorkingHours = currentHour >= 7 && currentHour < 22;

  let isHealthy = true;
  let healthMessage = 'OK';

  if (isWorkingHours) {
    if (!lastSuccessfulRun) {
      isHealthy = false;
      healthMessage = 'No successful runs recorded';
    } else {
      const minutesSinceLastRun = (now.getTime() - lastSuccessfulRun.startedAt.getTime()) / 60000;
      if (minutesSinceLastRun > 10) {
        isHealthy = false;
        healthMessage = `Last successful run was ${Math.round(minutesSinceLastRun)} minutes ago`;
      }
    }
  }

  return {
    jobName: JOB_NAME,
    isHealthy,
    healthMessage,
    isWorkingHours,
    lastRunTime,
    lastRunStatus,
    consecutiveFailures,
    lastSuccessfulRun: lastSuccessfulRun ? {
      id: lastSuccessfulRun.id,
      startedAt: lastSuccessfulRun.startedAt,
      durationMs: lastSuccessfulRun.durationMs,
      itemsProcessed: lastSuccessfulRun.itemsProcessed,
    } : null,
    recentRuns: recentRuns.map(r => ({
      id: r.id,
      status: r.status,
      startedAt: r.startedAt,
      durationMs: r.durationMs,
      itemsProcessed: r.itemsProcessed,
      errorMessage: r.errorMessage,
    })),
    stats: {
      totalRuns: recentRuns.length,
      failedRuns,
      successRate: recentRuns.length > 0
        ? `${((recentRuns.length - failedRuns) / recentRuns.length * 100).toFixed(1)}%`
        : 'N/A',
    },
  };
};
