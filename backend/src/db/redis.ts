import Redis from 'ioredis';
import { logger } from '../middleware/requestLogger';
import { env } from '../config/env';

let redisClient: Redis | null = null;
let isConnected = false;

export function isRedisAvailable(): boolean {
  return isConnected && redisClient !== null;
}

export function getRedisClient(): Redis {
  if (!redisClient || !isConnected) {
    throw new Error('Redis not initialized or unavailable');
  }
  return redisClient;
}

export async function connectRedis(url?: string): Promise<Redis | null> {
  if (!env.REDIS_ENABLED) {
    logger.info('Redis disabled by config (REDIS_ENABLED=false) — running with in-memory fallbacks');
    redisClient = null;
    isConnected = false;
    return null;
  }

  const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy: () => null, // don't infinite retry if host down
    });

    await client.connect();
    redisClient = client;
    isConnected = true;
    logger.info('Redis connected');

    client.on('error', (err) => {
      logger.error('Redis error:', err);
      isConnected = false;
    });

    client.on('reconnecting', () => logger.warn('Redis reconnecting...'));
    client.on('ready', () => {
      isConnected = true;
    });

    return redisClient;
  } catch (err) {
    logger.warn('Redis connection failed — continuing without Redis (in-memory fallback mode)', {
      error: (err as Error).message,
    });
    redisClient = null;
    isConnected = false;
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // ignore quit error during teardown
    }
    redisClient = null;
    isConnected = false;
  }
}
