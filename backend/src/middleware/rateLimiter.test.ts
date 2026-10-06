import { Request, Response, NextFunction } from 'express';
import { rateLimiter, checkMemoryRateLimit, clearMemoryRateLimit } from './rateLimiter';
import { isRedisAvailable, connectRedis } from '../db/redis';

describe('Rate Limiter (Redis-optional with In-Memory fallback)', () => {
  beforeEach(() => {
    clearMemoryRateLimit();
  });

  it('reports redis unavailable in fallback mode', () => {
    expect(isRedisAvailable()).toBe(false);
  });

  it('increments memory rate limit count for an identifier', () => {
    const id = '127.0.0.1';
    expect(checkMemoryRateLimit(id, 5, 60)).toBe(1);
    expect(checkMemoryRateLimit(id, 5, 60)).toBe(2);
    expect(checkMemoryRateLimit(id, 5, 60)).toBe(3);
  });

  it('tracks different identifiers independently in memory store', () => {
    expect(checkMemoryRateLimit('client-a', 5, 60)).toBe(1);
    expect(checkMemoryRateLimit('client-b', 5, 60)).toBe(1);
    expect(checkMemoryRateLimit('client-a', 5, 60)).toBe(2);
    expect(checkMemoryRateLimit('client-b', 5, 60)).toBe(2);
  });

  it('passes through middleware and sets rate limit headers when below limit', async () => {
    const req = { ip: '192.168.1.10' } as unknown as Request;
    const headers: Record<string, string | number> = {};
    const res = {
      setHeader: jest.fn((k: string, v: string | number) => {
        headers[k] = v;
      }),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    expect(headers['X-RateLimit-Remaining']).toBe(99);
  });

  it('returns 429 RATE_LIMIT_EXCEEDED when rate limit exceeded in memory fallback', async () => {
    const ip = '10.0.0.1';
    const req = { ip } as unknown as Request;
    let statusCode: number | null = null;
    let jsonBody: any = null;

    const res = {
      setHeader: jest.fn(),
      status: jest.fn((code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      }),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    // Simulate 100 requests
    for (let i = 0; i < 100; i++) {
      checkMemoryRateLimit(ip, 100, 60);
    }

    // 101st request goes through middleware
    await rateLimiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusCode).toBe(429);
    expect(jsonBody).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED',
        }),
      })
    );
  });

  it('handles connectRedis gracefully without crashing when Redis is unreachable or disabled', async () => {
    const client = await connectRedis('redis://localhost:9999');
    expect(client).toBeNull();
    expect(isRedisAvailable()).toBe(false);
  });
});
