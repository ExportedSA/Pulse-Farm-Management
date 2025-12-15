import { runComplianceChecks, getComplianceSummary } from './domain/complianceChecks';
import logger from './config/logger';

// Schedule intervals (in milliseconds)
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

// Track scheduled jobs
let complianceCheckInterval: NodeJS.Timeout | null = null;
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
    
    const result = await runComplianceChecks();
    
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

  logger.info('All scheduled jobs initialized');
}

/**
 * Cleanup all scheduled jobs
 * Call this on server shutdown
 */
export function cleanupScheduler(): void {
  logger.info('Cleaning up scheduled jobs');
  stopComplianceScheduler();
  logger.info('All scheduled jobs cleaned up');
}
