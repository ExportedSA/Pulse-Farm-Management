import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import logger from './logger';

// Redis configuration
interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

// Create Redis configuration from environment
const getRedisConfig = (): RedisConfig => {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    // Parse Redis URL (e.g., redis://user:pass@host:port/db)
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      db: parseInt(url.pathname.slice(1)) || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };
  }
  
  // Fallback to individual environment variables
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  };
};

// Create Redis clients
let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;
let instanceId: string;

// Initialize Redis connections
export function initRedis(): boolean {
  try {
    const config = getRedisConfig();
    
    // Generate unique instance ID for this server instance
    instanceId = process.env.INSTANCE_ID || randomUUID();
    
    // Create main Redis client for publishing
    redisClient = new Redis(config);
    
    // Create separate Redis client for subscribing (Redis doesn't allow commands on subscribed clients)
    redisSubscriber = new Redis(config);
    
    // Handle connection events
    redisClient.on('connect', () => {
      logger.info('Redis publisher connected');
    });
    
    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis publisher error');
    });
    
    redisSubscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });
    
    redisSubscriber.on('error', (err) => {
      logger.error({ err }, 'Redis subscriber error');
    });
    
    logger.info({
      config: {
        host: config.host,
        port: config.port,
        db: config.db,
        instanceId,
      },
    }, 'Redis initialized');
    
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis');
    return false;
  }
}

// Get the Redis client
export function getRedisClient(): Redis | null {
  return redisClient;
}

// Get the Redis subscriber client
export function getRedisSubscriber(): Redis | null {
  return redisSubscriber;
}

// Get the instance ID
export function getInstanceId(): string {
  return instanceId;
}

// Redis channels for different purposes
export const REDIS_CHANNELS = {
  CHAT_MESSAGES: 'chat:messages',
  CHAT_TYPING: 'chat:typing',
  NOTIFICATIONS: 'notifications',
  REALTIME_UPDATES: 'realtime:updates',
} as const;

// Helper to publish messages to Redis
export async function publishToRedis(
  channel: string,
  data: any,
  originInstanceId?: string
): Promise<void> {
  if (!redisClient) {
    logger.warn('Redis not available, skipping publish');
    return;
  }
  
  try {
    const payload = {
      data,
      originInstanceId: originInstanceId || instanceId,
      timestamp: Date.now(),
    };
    
    await redisClient.publish(channel, JSON.stringify(payload));
  } catch (error) {
    logger.error({ error, channel }, 'Failed to publish to Redis');
  }
}

// Helper to subscribe to Redis channels
export function subscribeToRedis(
  channel: string,
  callback: (data: any, originInstanceId: string) => void
): void {
  if (!redisSubscriber) {
    logger.warn('Redis subscriber not available, skipping subscription');
    return;
  }
  
  redisSubscriber.subscribe(channel, (err, count) => {
    if (err) {
      logger.error({ err, channel }, 'Failed to subscribe to Redis channel');
      return;
    }
    
    logger.info({ channel, count }, 'Subscribed to Redis channel');
  });
  
  redisSubscriber.on('message', (receivedChannel, message) => {
    if (receivedChannel !== channel) return;
    
    try {
      const payload = JSON.parse(message);
      
      // Skip if message originated from this instance
      if (payload.originInstanceId === instanceId) {
        return;
      }
      
      callback(payload.data, payload.originInstanceId);
    } catch (error) {
      logger.error({ error, message }, 'Failed to parse Redis message');
    }
  });
}

// Check if Redis is available
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisSubscriber !== null;
}

// Close Redis connections
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  
  if (redisSubscriber) {
    await redisSubscriber.quit();
    redisSubscriber = null;
  }
  
  logger.info('Redis connections closed');
}
