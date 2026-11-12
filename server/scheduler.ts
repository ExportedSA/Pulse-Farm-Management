import { runComplianceChecks, getComplianceSummary } from './domain/complianceChecks';
import logger from './config/logger';
import { runJobReminders } from './domain/job-reminders';
import { syncCowCounts } from './domain/billing';
import { systemDb, withFarmDb } from './db';
import { farms } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Schedule intervals (in milliseconds)
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

// Track scheduled jobs
let complianceCheckInterval: NodeJS.Timeout | null = null;
let jobReminderInterval: NodeJS.Timeout | null = null;
let jobReminderStart: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Run compliance checks with error handling and logging
 */
async function executeComplianceChecks(): Promise<void> {
  if (isRunning) {
    logger.warn('Compliance checks already running, skipping this run');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    logger.info('Starting scheduled compliance checks');

    // One farm at a time, each limited to its own rows
    const farmIds = (await systemDb.select({ id: farms.id }).from(farms).where(eq(farms.isActive, true))).map(f => f.id);
    const runs = [];
    for (const farmId of farmIds) runs.push(await withFarmDb(farmId, () => runComplianceChecks(farmId)));
    const result = {
      totalTasksCreated: runs.reduce((n, r) => n + r.totalTasksCreated, 0),
      checks: runs.flatMap(r => r.checks),
      success: runs.every(r => r.success),
    };

    const duration = Date.now() - startTime;
    logger.info({
      duration: `${duration}ms`,
      totalTasksCreated: result.totalTasksCreated,
      checksRun: result.checks.length,
      success: result.success,
    }, 'Scheduled compliance checks completed');

    // Log summary of each check
    for (const check of result.checks) {
      if (check.issuesFound > 0 || check.errors.length > 0) {
        logger.info({
          checkType: check.checkType,
          itemsChecked: check.itemsChecked,
          issuesFound: check.issuesFound,
          tasksCreated: check.tasksCreated,
          errors: check.errors.length,
        }, `Compliance check result: ${check.checkType}`);
      }
    }

  } catch (error) {
    logger.error({ error }, 'Scheduled compliance checks failed');
  } finally {
    isRunning = false;
  }
}

/**
 * Start the compliance check scheduler
 * @param intervalMs - Interval in milliseconds (default: 24 hours)
 * @param runImmediately - Whether to run checks immediately on start
 */
export function startComplianceScheduler(
  intervalMs: number = ONE_DAY,
  runImmediately: boolean = false
): void {
  // Clear any existing interval
  if (complianceCheckInterval) {
    clearInterval(complianceCheckInterval);
  }

  logger.info({
    intervalHours: intervalMs / ONE_HOUR,
    runImmediately,
  }, 'Starting compliance check scheduler');

  // Run immediately if requested
  if (runImmediately) {
    // Delay slightly to allow server to fully start
    setTimeout(() => {
      executeComplianceChecks();
    }, 5000);
  }

  // Schedule recurring checks
  complianceCheckInterval = setInterval(() => {
    executeComplianceChecks();
  }, intervalMs);

  logger.info('Compliance check scheduler started');
}

/**
 * Stop the compliance check scheduler
 */
export function stopComplianceScheduler(): void {
  if (complianceCheckInterval) {
    clearInterval(complianceCheckInterval);
    complianceCheckInterval = null;
    logger.info('Compliance check scheduler stopped');
  }
}

/**
 * Manually trigger compliance checks (for admin use)
 */
export async function triggerComplianceChecks(farmId?: string): Promise<{
  success: boolean;
  message: string;
  result?: any;
}> {
  if (isRunning) {
    return {
      success: false,
      message: 'Compliance checks are already running. Please wait for the current run to complete.',
    };
  }

  try {
    logger.info({ farmId }, 'Manual compliance check triggered');
    const result = await runComplianceChecks(farmId);
    
    return {
      success: result.success,
      message: `Compliance checks completed. ${result.totalTasksCreated} tasks created.`,
      result,
    };
  } catch (error) {
    logger.error({ error }, 'Manual compliance check failed');
    return {
      success: false,
      message: `Compliance checks failed: ${error}`,
    };
  }
}

/**
 * Get current compliance status summary
 */
export async function getComplianceStatus(farmId?: string): Promise<{
  summary: {
    animalsNeedingHealthCheck: number;
    equipmentNeedingService: number;
    unresolvedHazards: number;
    staffNeedingTraining: number;
  };
  schedulerRunning: boolean;
  lastCheckRunning: boolean;
}> {
  const summary = await getComplianceSummary(farmId);
  
  return {
    summary,
    schedulerRunning: complianceCheckInterval !== null,
    lastCheckRunning: isRunning,
  };
}

/**
 * Initialize all scheduled jobs
 * Call this from server startup
 */
export function initializeScheduler(): void {
  logger.info('Initializing scheduled jobs');

  // Start compliance checks - run daily, with initial run after 1 minute
  // In development, you might want shorter intervals for testing
  const isDev = process.env.NODE_ENV !== 'production';
  const interval = isDev ? ONE_HOUR : ONE_DAY; // Hourly in dev, daily in prod
  
  startComplianceScheduler(interval, true);

  // Job reminders: check every 15 minutes (each message only ever goes once)
  const remind = () => runJobReminders().catch(error => logger.error({ error }, 'Job reminders failed'));
  jobReminderStart = setTimeout(remind, 60 * 1000);
  jobReminderInterval = setInterval(remind, 15 * 60 * 1000);

  // Billing: send each subscribed farm's cow count to Stripe daily (does nothing without Stripe)
  const syncCows = () => syncCowCounts()
    .then(r => r.changed && logger.info(r, 'Billing cow counts updated'))
    .catch(error => logger.error({ error }, 'Billing cow count sync failed'));
  setTimeout(syncCows, 5 * 60 * 1000);
  setInterval(syncCows, ONE_DAY);

  logger.info('All scheduled jobs initialized');
}

/**
 * Cleanup all scheduled jobs
 * Call this on server shutdown
 */
export function cleanupScheduler(): void {
  logger.info('Cleaning up scheduled jobs');
  stopComplianceScheduler();
  if (jobReminderStart) clearTimeout(jobReminderStart);
  if (jobReminderInterval) clearInterval(jobReminderInterval);
  jobReminderStart = jobReminderInterval = null;
  logger.info('All scheduled jobs cleaned up');
}
