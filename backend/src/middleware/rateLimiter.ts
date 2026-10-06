import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisAvailable } from '../db/redis';
import { logger } from './requestLogger';
import { errorResponse } from '../types/api';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;

// Atomic Lua script for Redis rate limiting
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

// In-memory fallback rate-limiting store
interface MemoryRateRecord {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, MemoryRateRecord>();

// Cleanup stale records periodically
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryStore.entries()) {
    if (v.resetAt <= now) {
      memoryStore.delete(k);
    }
  }
}, 60000);
if (cleanupTimer.unref) cleanupTimer.unref();

export function checkMemoryRateLimit(identifier: string, maxRequests = MAX_REQUESTS, windowSeconds = WINDOW_SECONDS): number {
  const now = Date.now();
  const existing = memoryStore.get(identifier);
  if (!existing || existing.resetAt <= now) {
    memoryStore.set(identifier, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

export function clearMemoryRateLimit(): void {
  memoryStore.clear();
}

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const identifier = req.ip ?? 'unknown';
  const key = `ratelimit:${identifier}`;

  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const current = (await redis.eval(RATE_LIMIT_LUA, 1, key, String(WINDOW_SECONDS))) as number;

      res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - current));

      if (current > MAX_REQUESTS) {
        res.status(429).json(errorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests — please try again later'));
        return;
      }
      return next();
    } catch (err) {
      logger.warn('Rate limiter Redis eval error — falling back to in-memory store', { error: (err as Error).message });
    }
  }

  // Fallback to in-memory rate limiting
  const count = checkMemoryRateLimit(identifier, MAX_REQUESTS, WINDOW_SECONDS);
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - count));

  if (count > MAX_REQUESTS) {
    res.status(429).json(errorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests — please try again later'));
    return;
  }
  next();
}
