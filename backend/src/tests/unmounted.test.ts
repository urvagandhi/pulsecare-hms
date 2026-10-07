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

describe('Scope Trimming Unmounted Routes (Task 2.1)', () => {
  it('returns 404 for unmounted lab routes', async () => {
    const res = await request(app).get('/api/v1/lab/orders');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unmounted pharmacy routes', async () => {
    const res = await request(app).get('/api/v1/pharmacy/drugs');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unmounted inventory routes', async () => {
    const res = await request(app).get('/api/v1/inventory');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unmounted documents routes', async () => {
    const res = await request(app).get('/api/v1/documents');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unmounted settings routes', async () => {
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unmounted lab analytics', async () => {
    const res = await request(app).get('/api/v1/analytics/lab');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unmounted prescription analytics', async () => {
    const res = await request(app).get('/api/v1/analytics/prescriptions');
    expect(res.status).toBe(404);
  });

  it('retains core 4 module routes (health, appointments, billing)', async () => {
    const healthRes = await request(app).get('/api/v1/health');
    expect(healthRes.status).toBe(200);

    const apptRes = await request(app).get('/api/v1/appointments');
    // Returns 401 Unauthorized because it exists and is protected by authenticate, NOT 404
    expect(apptRes.status).not.toBe(404);

    const billRes = await request(app).get('/api/v1/billing');
    expect(billRes.status).not.toBe(404);
  });
});
