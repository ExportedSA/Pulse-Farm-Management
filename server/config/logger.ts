import pino from 'pino';
import pinoPretty from 'pino-pretty';

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: logLevel,
  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,
  // Include process ID for debugging
  pid: process.pid,
  // Include hostname for multi-instance deployments
  hostname: require('os').hostname(),
};

// Create logger instance
let logger: pino.Logger;

// Configure pretty printing for development
if (process.env.NODE_ENV !== 'production') {
  logger = pino(baseConfig, pinoPretty({
    colorize: true,
    translateTime: 'HH:MM:ss Z',
    ignore: 'pid,hostname',
    messageFormat: (log, messageKey) => {
      const msg = log[messageKey];
      const reqId = log.reqId;
      return reqId ? `[${reqId}] ${msg}` : msg;
    },
  }));
} else {
  // Production logger with JSON output
  logger = pino(baseConfig);
}

// Create child logger with request context
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    reqId: requestId,
    userId: userId || 'anonymous',
  });
}

// Export the logger instance
export default logger;
export { logger };
