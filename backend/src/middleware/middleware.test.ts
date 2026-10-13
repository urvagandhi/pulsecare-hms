import { Request, Response, NextFunction } from 'express';
import { authenticate } from './authenticate';
import { errorHandler, AppError, ValidationError, NotFoundError, ConflictError } from './errorHandler';
import { requestLogger } from './requestLogger';
import { checkMemoryRateLimit, clearMemoryRateLimit, rateLimiter } from './rateLimiter';
import { parseUtcMidnight, getUtcDayOfWeek } from '../utils/dateUtils';
import * as redisDb from '../db/redis';
import jwt from 'jsonwebtoken';

describe('Middleware & Utils Comprehensive Unit Tests', () => {
  describe('authenticate middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
      mockReq = { headers: {} };
      mockRes = {};
      next = jest.fn();
    });

    it('calls next with AuthError when no authorization header is provided', () => {
      authenticate(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No token provided', statusCode: 401 })
      );
    });

    it('calls next with AuthError when token does not start with Bearer', () => {
      mockReq.headers = { authorization: 'Basic 12345' };
      authenticate(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No token provided', statusCode: 401 })
      );
    });

    it('calls next with AuthError when JWT_SECRET is unset', () => {
      const origSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      mockReq.headers = { authorization: 'Bearer valid.token.here' };
      authenticate(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Server configuration error', statusCode: 401 })
      );

      process.env.JWT_SECRET = origSecret;
    });

    it('calls next with AuthError when token is invalid or malformed', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      authenticate(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid or expired token', statusCode: 401 })
      );
    });

    it('attaches user to req and calls next() on valid token', () => {
      const token = jwt.sign(
        { _id: 'user123', role: 'admin', email: 'admin@test.com' },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(mockReq.user).toEqual({ _id: 'user123', role: 'admin' });
    });
  });

  describe('errorHandler middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let next: jest.Mock;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
      mockReq = {};
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnValue({ json: jsonMock });
      mockRes = { status: statusMock };
      next = jest.fn();
    });

    it('handles AppError subclasses (ValidationError, NotFoundError, ConflictError)', () => {
      const err = new NotFoundError('Patient');
      errorHandler(err, mockReq as Request, mockRes as Response, next as NextFunction);
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'NOT_FOUND', message: 'Patient not found' }),
        })
      );
    });

    it('handles Mongoose ValidationError (err.name === "ValidationError")', () => {
      const err = new Error('Field is required');
      err.name = 'ValidationError';
      errorHandler(err, mockReq as Request, mockRes as Response, next as NextFunction);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'Field is required' }),
        })
      );
    });

    it('handles Mongoose duplicate key error (code === "11000")', () => {
      const err = new Error('E11000 duplicate key error');
      (err as any).code = '11000';
      errorHandler(err, mockReq as Request, mockRes as Response, next as NextFunction);
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'DUPLICATE_KEY', message: 'Resource already exists' }),
        })
      );
    });

    it('handles generic unhandled Error with 500 INTERNAL_ERROR', () => {
      const err = new Error('Random unexpected crash');
      errorHandler(err, mockReq as Request, mockRes as Response, next as NextFunction);
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }),
        })
      );
    });
  });

  describe('requestLogger middleware', () => {
    it('registers finish event listener and calls next()', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/v1/test',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Jest' },
      } as Partial<Request>;
      const onMock = jest.fn();
      const mockRes = { on: onMock } as Partial<Response>;
      const next = jest.fn();

      requestLogger(mockReq as Request, mockRes as Response, next);
      expect(onMock).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(next).toHaveBeenCalled();

      // Trigger the finish callback to exercise logging line
      const finishCb = onMock.mock.calls[0][1];
      finishCb();
    });
  });

  describe('rateLimiter in-memory store', () => {
    beforeEach(() => {
      clearMemoryRateLimit();
    });

    it('increments request count within window', () => {
      const id = 'client-1';
      expect(checkMemoryRateLimit(id, 10, 60)).toBe(1);
      expect(checkMemoryRateLimit(id, 10, 60)).toBe(2);
      expect(checkMemoryRateLimit(id, 10, 60)).toBe(3);
    });

    it('resets count after window expires', () => {
      const id = 'client-expired';
      checkMemoryRateLimit(id, 10, -1); // expired 1s ago
      expect(checkMemoryRateLimit(id, 10, 60)).toBe(1);
    });
  });

  describe('rateLimiter middleware execution', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let next: jest.Mock;
    let setHeaderMock: jest.Mock;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
      clearMemoryRateLimit();
      setHeaderMock = jest.fn();
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnValue({ json: jsonMock });
      mockReq = { ip: '127.0.0.1' };
      mockRes = { setHeader: setHeaderMock, status: statusMock };
      next = jest.fn();
      jest.restoreAllMocks();
    });

    it('passes through and sets headers in memory mode', async () => {
      jest.spyOn(redisDb, 'isRedisAvailable').mockReturnValue(false);
      await rateLimiter(mockReq as Request, mockRes as Response, next);
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(next).toHaveBeenCalled();
    });

    it('returns 429 when memory limit is exceeded', async () => {
      jest.spyOn(redisDb, 'isRedisAvailable').mockReturnValue(false);
      // Consume all 100 requests
      for (let i = 0; i < 100; i++) {
        checkMemoryRateLimit('127.0.0.1', 100, 60);
      }
      await rateLimiter(mockReq as Request, mockRes as Response, next);
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    it('uses Redis eval when Redis is available', async () => {
      jest.spyOn(redisDb, 'isRedisAvailable').mockReturnValue(true);
      const mockEval = jest.fn().mockResolvedValue(5);
      jest.spyOn(redisDb, 'getRedisClient').mockReturnValue({ eval: mockEval } as any);

      await rateLimiter(mockReq as Request, mockRes as Response, next);
      expect(mockEval).toHaveBeenCalled();
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Remaining', 95);
      expect(next).toHaveBeenCalled();
    });

    it('returns 429 when Redis current exceeds max requests', async () => {
      jest.spyOn(redisDb, 'isRedisAvailable').mockReturnValue(true);
      const mockEval = jest.fn().mockResolvedValue(105);
      jest.spyOn(redisDb, 'getRedisClient').mockReturnValue({ eval: mockEval } as any);

      await rateLimiter(mockReq as Request, mockRes as Response, next);
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    it('falls back to memory store when Redis eval rejects', async () => {
      jest.spyOn(redisDb, 'isRedisAvailable').mockReturnValue(true);
      const mockEval = jest.fn().mockRejectedValue(new Error('Redis connection drop'));
      jest.spyOn(redisDb, 'getRedisClient').mockReturnValue({ eval: mockEval } as any);

      await rateLimiter(mockReq as Request, mockRes as Response, next);
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('dateUtils Date normalization', () => {
    it('normalizes a Date instance to UTC midnight', () => {
      const now = new Date('2026-10-15T15:30:45.000Z');
      const normalized = parseUtcMidnight(now);
      expect(normalized.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    });

    it('computes correct day of week for Date object across all 7 days', () => {
      expect(getUtcDayOfWeek(new Date('2026-10-18T00:00:00.000Z'))).toBe('sunday');
      expect(getUtcDayOfWeek(new Date('2026-10-19T00:00:00.000Z'))).toBe('monday');
      expect(getUtcDayOfWeek(new Date('2026-10-20T00:00:00.000Z'))).toBe('tuesday');
      expect(getUtcDayOfWeek(new Date('2026-10-21T00:00:00.000Z'))).toBe('wednesday');
      expect(getUtcDayOfWeek(new Date('2026-10-22T00:00:00.000Z'))).toBe('thursday');
      expect(getUtcDayOfWeek(new Date('2026-10-23T00:00:00.000Z'))).toBe('friday');
      expect(getUtcDayOfWeek(new Date('2026-10-24T00:00:00.000Z'))).toBe('saturday');
    });
  });
});
