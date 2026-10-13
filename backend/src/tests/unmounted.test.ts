import request from 'supertest';
import { Request, Response, NextFunction } from 'express';

// Mock rate limiter and requestLogger before importing app
jest.mock('../middleware/rateLimiter', () => ({
  rateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock('../middleware/requestLogger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  requestLogger: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import { app } from '../app';

describe('System API Route Mounting & Protection', () => {
  it('verifies health check endpoint returns 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });

  it('verifies lab routes are mounted and protected with authentication', async () => {
    const res = await request(app).get('/api/v1/lab/orders');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('verifies pharmacy routes are mounted and protected', async () => {
    const res = await request(app).get('/api/v1/pharmacy/drugs');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('verifies inventory routes are mounted and protected', async () => {
    const res = await request(app).get('/api/v1/inventory/items');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('verifies documents routes are mounted and protected', async () => {
    const res = await request(app).get('/api/v1/documents');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('verifies settings routes are mounted and protected', async () => {
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('verifies lab analytics route is mounted and protected', async () => {
    const res = await request(app).get('/api/v1/analytics/lab');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('verifies prescription analytics route is mounted and protected', async () => {
    const res = await request(app).get('/api/v1/analytics/prescriptions');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('verifies core appointments and billing routes are mounted and protected', async () => {
    const apptRes = await request(app).get('/api/v1/appointments');
    expect(apptRes.status).not.toBe(404);
    expect(apptRes.status).toBe(401);

    const billRes = await request(app).get('/api/v1/billing');
    expect(billRes.status).not.toBe(404);
    expect(billRes.status).toBe(401);
  });

  it('returns 404 for truly non-existent routes', async () => {
    const res = await request(app).get('/api/v1/unknown-service-route-xyz');
    expect(res.status).toBe(404);
  });
});
