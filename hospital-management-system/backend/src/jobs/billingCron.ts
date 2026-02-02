import cron from 'node-cron';
import { prisma } from '../config/database';
import { billingService } from '../services/billingService';

/**
 * Billing Cron Jobs
 *
 * Job 1: OVERDUE_PAYMENT_REMINDERS
 *   Schedule: Daily at 8:00 AM
 *   Sends overdue payment reminders for all hospitals
 *
 * Job 2: IPD_DAILY_CHARGES
 *   Schedule: Daily at 6:00 AM
 *   Generates daily room/bed charges for admitted IPD patients
 *
 * Health Monitoring:
 * - Each run is logged to cron_job_runs table
 * - Health endpoint checks last successful run
 * - Manual triggers available for testing
 */

// --- Overdue Payment Reminders ---

const OVERDUE_JOB_NAME = 'OVERDUE_PAYMENT_REMINDERS';
const OVERDUE_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max
let overdueIsProcessing = false;
let overdueProcessingStartTime: number | null = null;
let overdueLastRunTime: Date | null = null;
let overdueLastRunStatus: 'success' | 'error' | null = null;
let overdueConsecutiveFailures = 0;

const processOverdueReminders = async (source: 'cron' | 'manual' = 'cron') => {
  // Timeout protection
  if (overdueIsProcessing && overdueProcessingStartTime) {
    const elapsed = Date.now() - overdueProcessingStartTime;
    if (elapsed > OVERDUE_PROCESSING_TIMEOUT_MS) {
      console.error(`[CRON] Previous ${OVERDUE_JOB_NAME} run stuck for ${Math.round(elapsed / 1000)}s, resetting flag...`);
      overdueIsProcessing = false;
      overdueProcessingStartTime = null;
      overdueConsecutiveFailures++;
    } else {
      console.log(`[CRON] ${OVERDUE_JOB_NAME} already in progress, skipping...`);
      return { skipped: true, reason: 'already_processing' };
    }
  }

  overdueIsProcessing = true;
  overdueProcessingStartTime = Date.now();
  const startTime = Date.now();
  let runId: string | null = null;

  try {
    const run = await prisma.cronJobRun.create({
      data: {
        jobName: OVERDUE_JOB_NAME,
        status: 'RUNNING',
        metadata: { source },
      },
    });
    runId = run.id;

    console.log(`[CRON] Starting ${OVERDUE_JOB_NAME} (source: ${source})...`);

    const hospitals = await prisma.hospital.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    let totalReminders = 0;
    const results: Array<{ hospitalId: string; hospitalName: string; count: number }> = [];

    for (const hospital of hospitals) {
      try {
        const result = await billingService.sendOverduePaymentReminders(hospital.id);
        const count = typeof result === 'number' ? result : (result as any)?.count ?? 0;
        totalReminders += count;
        results.push({ hospitalId: hospital.id, hospitalName: hospital.name, count });
        if (count > 0) {
          console.log(`  - ${hospital.name}: ${count} overdue reminders sent`);
        }
      } catch (err) {
        console.error(`  - ${hospital.name}: Error sending reminders:`, err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] ${OVERDUE_JOB_NAME} completed in ${duration}ms — ${totalReminders} reminders across ${hospitals.length} hospitals`);

    await prisma.cronJobRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        durationMs: duration,
        itemsProcessed: totalReminders,
        metadata: {
          source,
          hospitalsProcessed: hospitals.length,
          totalReminders,
          results,
        },
      },
    });

    overdueLastRunTime = new Date();
    overdueLastRunStatus = 'success';
    overdueConsecutiveFailures = 0;

    return { success: true, duration, totalReminders, hospitalsProcessed: hospitals.length };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CRON] Error in ${OVERDUE_JOB_NAME}:`, error);

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

    overdueLastRunTime = new Date();
    overdueLastRunStatus = 'error';
    overdueConsecutiveFailures++;

    return { success: false, duration, error: errorMessage };
  } finally {
    overdueIsProcessing = false;
    overdueProcessingStartTime = null;
  }
};

// --- IPD Daily Room Charges ---

const IPD_JOB_NAME = 'IPD_DAILY_CHARGES';
const IPD_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max
let ipdIsProcessing = false;
let ipdProcessingStartTime: number | null = null;
let ipdLastRunTime: Date | null = null;
let ipdLastRunStatus: 'success' | 'error' | null = null;
let ipdConsecutiveFailures = 0;

const processIPDDailyCharges = async (source: 'cron' | 'manual' = 'cron') => {
  // Timeout protection
  if (ipdIsProcessing && ipdProcessingStartTime) {
    const elapsed = Date.now() - ipdProcessingStartTime;
    if (elapsed > IPD_PROCESSING_TIMEOUT_MS) {
      console.error(`[CRON] Previous ${IPD_JOB_NAME} run stuck for ${Math.round(elapsed / 1000)}s, resetting flag...`);
      ipdIsProcessing = false;
      ipdProcessingStartTime = null;
      ipdConsecutiveFailures++;
    } else {
      console.log(`[CRON] ${IPD_JOB_NAME} already in progress, skipping...`);
      return { skipped: true, reason: 'already_processing' };
    }
  }

  ipdIsProcessing = true;
  ipdProcessingStartTime = Date.now();
  const startTime = Date.now();
  let runId: string | null = null;

  try {
    const run = await prisma.cronJobRun.create({
      data: {
        jobName: IPD_JOB_NAME,
        status: 'RUNNING',
        metadata: { source },
      },
    });
    runId = run.id;

    console.log(`[CRON] Starting ${IPD_JOB_NAME} (source: ${source})...`);

    const hospitals = await prisma.hospital.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    let totalCharges = 0;
    const results: Array<{ hospitalId: string; hospitalName: string; count: number }> = [];

    for (const hospital of hospitals) {
      try {
        const result = await billingService.generateIPDDailyCharges(hospital.id, 'billing-cron');
        const count = typeof result === 'number' ? result : (result as any)?.count ?? 0;
        totalCharges += count;
        results.push({ hospitalId: hospital.id, hospitalName: hospital.name, count });
        if (count > 0) {
          console.log(`  - ${hospital.name}: ${count} IPD daily charges generated`);
        }
      } catch (err) {
        console.error(`  - ${hospital.name}: Error generating IPD charges:`, err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] ${IPD_JOB_NAME} completed in ${duration}ms — ${totalCharges} charges across ${hospitals.length} hospitals`);

    await prisma.cronJobRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        durationMs: duration,
        itemsProcessed: totalCharges,
        metadata: {
          source,
          hospitalsProcessed: hospitals.length,
          totalCharges,
          results,
        },
      },
    });

    ipdLastRunTime = new Date();
    ipdLastRunStatus = 'success';
    ipdConsecutiveFailures = 0;

    return { success: true, duration, totalCharges, hospitalsProcessed: hospitals.length };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CRON] Error in ${IPD_JOB_NAME}:`, error);

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

    ipdLastRunTime = new Date();
    ipdLastRunStatus = 'error';
    ipdConsecutiveFailures++;

    return { success: false, duration, error: errorMessage };
  } finally {
    ipdIsProcessing = false;
    ipdProcessingStartTime = null;
  }
};

// --- Init & Exports ---

/**
 * Initialize billing cron jobs
 */
export const initBillingCron = () => {
  // Overdue payment reminders — daily at 8:00 AM
  cron.schedule('0 8 * * *', () => processOverdueReminders('cron'));
  console.log('[CRON] OVERDUE_PAYMENT_REMINDERS cron job initialized — Daily at 8:00 AM');

  // IPD daily room charges — daily at 6:00 AM
  cron.schedule('0 6 * * *', () => processIPDDailyCharges('cron'));
  console.log('[CRON] IPD_DAILY_CHARGES cron job initialized — Daily at 6:00 AM');
};

/**
 * Manual trigger for overdue payment reminders
 */
export const triggerOverdueReminders = async () => {
  console.log('[MANUAL] Triggering overdue payment reminders...');
  return processOverdueReminders('manual');
};

/**
 * Manual trigger for IPD daily charges
 */
export const triggerIPDCharges = async () => {
  console.log('[MANUAL] Triggering IPD daily charges...');
  return processIPDDailyCharges('manual');
};

/**
 * Get billing cron health status
 */
export const getBillingCronHealth = async () => {
  const [overdueRuns, ipdRuns] = await Promise.all([
    prisma.cronJobRun.findMany({
      where: { jobName: OVERDUE_JOB_NAME },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    prisma.cronJobRun.findMany({
      where: { jobName: IPD_JOB_NAME },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
  ]);

  const buildHealthInfo = (
    jobName: string,
    runs: typeof overdueRuns,
    lastRunTime: Date | null,
    lastRunStatus: string | null,
    consecutiveFailures: number,
  ) => {
    const lastSuccess = runs.find(r => r.status === 'COMPLETED');
    const failedCount = runs.filter(r => r.status === 'FAILED').length;

    return {
      jobName,
      isHealthy: consecutiveFailures < 3 && (lastSuccess != null || runs.length === 0),
      lastRunTime,
      lastRunStatus,
      consecutiveFailures,
      lastSuccessfulRun: lastSuccess ? {
        id: lastSuccess.id,
        startedAt: lastSuccess.startedAt,
        durationMs: lastSuccess.durationMs,
        itemsProcessed: lastSuccess.itemsProcessed,
      } : null,
      recentRuns: runs.map(r => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt,
        durationMs: r.durationMs,
        itemsProcessed: r.itemsProcessed,
        errorMessage: r.errorMessage,
      })),
      stats: {
        totalRuns: runs.length,
        failedRuns: failedCount,
        successRate: runs.length > 0
          ? `${(((runs.length - failedCount) / runs.length) * 100).toFixed(1)}%`
          : 'N/A',
      },
    };
  };

  return {
    overdueReminders: buildHealthInfo(OVERDUE_JOB_NAME, overdueRuns, overdueLastRunTime, overdueLastRunStatus, overdueConsecutiveFailures),
    ipdDailyCharges: buildHealthInfo(IPD_JOB_NAME, ipdRuns, ipdLastRunTime, ipdLastRunStatus, ipdConsecutiveFailures),
  };
};
