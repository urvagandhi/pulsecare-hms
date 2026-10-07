import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Request, Response, NextFunction } from 'express';

// Mock rate limiter and requestLogger before importing app
jest.mock('../../../middleware/rateLimiter', () => ({
  rateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock('../../../middleware/requestLogger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  requestLogger: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock socket so emitToUser doesn't crash in tests
jest.mock('../../../socket', () => ({
  emitToUser: jest.fn(),
  emitToRole: jest.fn(),
}));

import { app } from '../../../app';
import { User } from '../../../models/User';
import { Patient } from '../../../models/Patient';
import { calculateInvoiceTotals } from '../calculator';

let mongoServer: MongoMemoryServer;

let patientProfileId = '';
let patientToken = '';
let receptionistToken = '';
let adminToken = '';
let secondPatientProfileId = '';
let secondPatientToken = '';

// Helper to create a draft invoice
const createDraftInvoice = async (token: string, patientId: string) => {
  return request(app)
    .post('/api/v1/billing')
    .set('Authorization', `Bearer ${token}`)
    .send({
      patientId,
      lineItems: [{ description: 'Consultation', quantity: 1, unitPrice: 150 }],
    });
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  process.env.JWT_SECRET = 'test-secret-key-for-jwt';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jwt';
  process.env.NODE_ENV = 'test';

  // Create admin user
  await User.create({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@test.com',
    password: 'AdminPass1!',
    role: 'admin',
  });

  // Create receptionist user
  await User.create({
    firstName: 'Rec',
    lastName: 'Staff',
    email: 'receptionist@test.com',
    password: 'RecPass1!',
    role: 'receptionist',
  });

  // Create patient user
  const patUser = await User.create({
    firstName: 'Jane',
    lastName: 'Patient',
    email: 'patient@test.com',
    password: 'PatPass1!',
    role: 'patient',
  });

  // Create patient profile
  const patientProfile = await Patient.create({ userId: patUser._id });
  patientProfileId = patientProfile._id.toString();

  // Create second patient user and profile
  const secondPatUser = await User.create({
    firstName: 'Other',
    lastName: 'Patient',
    email: 'other.patient@test.com',
    password: 'OtherPass1!',
    role: 'patient',
  });
  const secondPatientProfile = await Patient.create({ userId: secondPatUser._id });
  secondPatientProfileId = secondPatientProfile._id.toString();

  // Login all users
  const adminLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@test.com', password: 'AdminPass1!' });
  adminToken = adminLoginRes.body?.data?.accessToken ?? '';

  const recLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'receptionist@test.com', password: 'RecPass1!' });
  receptionistToken = recLoginRes.body?.data?.accessToken ?? '';

  const patLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'patient@test.com', password: 'PatPass1!' });
  patientToken = patLoginRes.body?.data?.accessToken ?? '';

  const secondPatLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'other.patient@test.com', password: 'OtherPass1!' });
  secondPatientToken = secondPatLoginRes.body?.data?.accessToken ?? '';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Only clear invoices between tests, not users/patients
  const collections = mongoose.connection.collections;
  if (collections['invoices']) {
    await collections['invoices'].deleteMany({});
  }
});

describe('Billing Routes', () => {
  it('1. POST /api/v1/billing — admin creates a draft invoice', async () => {
    const res = await createDraftInvoice(adminToken, patientProfileId);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoiceId).toMatch(/^INV-\d{4}$/);
    expect(res.body.data.status).toBe('draft');
  });

  it('2. POST /api/v1/billing — patient gets 403', async () => {
    const res = await createDraftInvoice(patientToken, patientProfileId);

    expect(res.status).toBe(403);
  });

  it('3. POST /api/v1/billing — receptionist creates a draft invoice', async () => {
    const res = await createDraftInvoice(receptionistToken, patientProfileId);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
  });

  it('4. GET /api/v1/billing — admin lists all invoices', async () => {
    // Create one invoice first
    await createDraftInvoice(adminToken, patientProfileId);

    const res = await request(app)
      .get('/api/v1/billing')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('5. GET /api/v1/billing — patient sees only own invoices (ownOnly)', async () => {
    // Create an invoice for the primary patient
    await createDraftInvoice(adminToken, patientProfileId);

    // Create an invoice for the second patient (should NOT appear when first patient lists)
    await createDraftInvoice(adminToken, secondPatientProfileId);

    const res = await request(app)
      .get('/api/v1/billing')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Only the first patient's invoice should appear
    expect(res.body.data.length).toBe(1);
    // All returned invoices should belong to patient's profile
    for (const invoice of res.body.data) {
      const invoicePatientId =
        typeof invoice.patient === 'object' ? invoice.patient._id : invoice.patient;
      expect(invoicePatientId.toString()).toBe(patientProfileId);
      expect(invoicePatientId.toString()).not.toBe(secondPatientProfileId);
    }
  });

  it('6. PATCH /api/v1/billing/:id/issue — admin issues a draft invoice', async () => {
    const createRes = await createDraftInvoice(adminToken, patientProfileId);
    expect(createRes.status).toBe(201);
    const invoiceMongoId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/v1/billing/${invoiceMongoId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('issued');
    expect(res.body.data.issuedDate).toBeTruthy();
  });

  it('7. PATCH /api/v1/billing/:id/issue — receptionist gets 403 (only admin can issue)', async () => {
    const createRes = await createDraftInvoice(adminToken, patientProfileId);
    expect(createRes.status).toBe(201);
    const invoiceMongoId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/v1/billing/${invoiceMongoId}/issue`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(res.status).toBe(403);
  });

  it('8. POST /api/v1/billing/:id/payments — admin records a partial payment', async () => {
    // Create and issue invoice
    const createRes = await createDraftInvoice(adminToken, patientProfileId);
    expect(createRes.status).toBe(201);
    const invoiceMongoId = createRes.body.data._id;

    await request(app)
      .patch(`/api/v1/billing/${invoiceMongoId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Record partial payment (75 < 150)
    const res = await request(app)
      .post(`/api/v1/billing/${invoiceMongoId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 75, method: 'cash' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('partial');
    expect(res.body.data.amountPaid).toBe(75);
  });

  it('9. POST /api/v1/billing/:id/payments — receptionist records a payment', async () => {
    // Create and issue invoice
    const createRes = await createDraftInvoice(adminToken, patientProfileId);
    expect(createRes.status).toBe(201);
    const invoiceMongoId = createRes.body.data._id;

    await request(app)
      .patch(`/api/v1/billing/${invoiceMongoId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Receptionist records payment
    const res = await request(app)
      .post(`/api/v1/billing/${invoiceMongoId}/payments`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ amount: 75, method: 'cash' });

    expect(res.status).toBe(200);
    expect(res.body.data.amountPaid).toBe(75);
    expect(res.body.data.status).toBe('partial');
  });

  it('10. POST /api/v1/billing/:id/payments — full payment marks invoice paid', async () => {
    // Create and issue invoice
    const createRes = await createDraftInvoice(adminToken, patientProfileId);
    expect(createRes.status).toBe(201);
    const invoiceMongoId = createRes.body.data._id;

    await request(app)
      .patch(`/api/v1/billing/${invoiceMongoId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Record full payment (150 = 150)
    const res = await request(app)
      .post(`/api/v1/billing/${invoiceMongoId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 150, method: 'cash' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paid');
    expect(res.body.data.paidDate).toBeTruthy();
  });

  it('11. PATCH /api/v1/billing/:id/void — admin voids an invoice', async () => {
    const createRes = await createDraftInvoice(adminToken, patientProfileId);
    expect(createRes.status).toBe(201);
    const invoiceMongoId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/v1/billing/${invoiceMongoId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ voidReason: 'Billing error' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('void');
    expect(res.body.data.voidReason).toBe('Billing error');
  });

  it('12. PATCH /api/v1/billing/:id/void — cannot void a paid invoice', async () => {
    // Create, issue, and fully pay invoice
    const createRes = await createDraftInvoice(adminToken, patientProfileId);
    expect(createRes.status).toBe(201);
    const invoiceMongoId = createRes.body.data._id;

    await request(app)
      .patch(`/api/v1/billing/${invoiceMongoId}/issue`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .post(`/api/v1/billing/${invoiceMongoId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 150, method: 'cash' });

    // Now try to void
    const res = await request(app)
      .patch(`/api/v1/billing/${invoiceMongoId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ voidReason: 'Should not work' });

    expect(res.status).toBe(400);
  });

  it('13. GET /api/v1/billing/:id — patient cannot access another patient invoice (403 or 404)', async () => {
    // Create invoice for the second patient (set up in beforeAll)
    const createRes = await createDraftInvoice(adminToken, secondPatientProfileId);
    expect(createRes.status).toBe(201);
    const invoiceMongoId = createRes.body.data._id;

    // First patient tries to access the other patient's invoice
    const res = await request(app)
      .get(`/api/v1/billing/${invoiceMongoId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect([403, 404]).toContain(res.status);
  });

  describe('Task 3.5 — calculateInvoiceTotals unit tests', () => {
    it('calculates totals, tax, and rounding correctly for single and multi-item invoices', () => {
      const items = [
        { description: 'Cardiology Consultation', quantity: 1, unitPrice: 150, category: 'consultation' as const },
        { description: 'ECG Procedure', quantity: 2, unitPrice: 75.25, category: 'procedure' as const },
      ];

      // Subtotal = 150 + 150.5 = 300.5
      // Tax at 7.5% = 300.5 * 0.075 = 22.5375 -> rounded to 22.54
      // Discount = 20
      // Total = 300.5 + 22.54 - 20 = 303.04
      const result = calculateInvoiceTotals(items, 7.5, 20, 100);

      expect(result.subtotal).toBe(300.5);
      expect(result.tax).toBe(22.54);
      expect(result.total).toBe(303.04);
      expect(result.amountPaid).toBe(100);
      expect(result.balance).toBe(203.04);
      expect(result.lineItems[0].total).toBe(150);
      expect(result.lineItems[1].total).toBe(150.5);
    });

    it('handles zero tax, zero discount, and default categories', () => {
      const items = [{ description: 'General checkup', quantity: 1, unitPrice: 100 }];
      const result = calculateInvoiceTotals(items);

      expect(result.subtotal).toBe(100);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(100);
      expect(result.balance).toBe(100);
    });

    it('throws error when discount is negative', () => {
      const items = [{ description: 'Medicine', quantity: 1, unitPrice: 50 }];
      expect(() => calculateInvoiceTotals(items, 0, -10)).toThrow('Discount cannot be negative');
    });

    it('throws error when discount exceeds subtotal + tax', () => {
      const items = [{ description: 'Medicine', quantity: 1, unitPrice: 50 }];
      expect(() => calculateInvoiceTotals(items, 10, 100)).toThrow('Discount cannot exceed subtotal + tax');
    });
  });

  describe('Task 3.5 — DELETE /api/v1/billing/:id/items/:itemIndex endpoint tests', () => {
    it('removes item from draft invoice and recalculates totals (draft ok)', async () => {
      // Create draft invoice with 2 items
      const createRes = await request(app)
        .post('/api/v1/billing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId: patientProfileId,
          lineItems: [
            { description: 'Item 1', quantity: 1, unitPrice: 100, category: 'consultation' },
            { description: 'Item 2', quantity: 2, unitPrice: 50, category: 'medicine' },
          ],
          taxRate: 10,
          discount: 10,
        });

      expect(createRes.status).toBe(201);
      const invId = createRes.body.data._id;
      // Initial: subtotal = 200, tax = 20, total = 210
      expect(createRes.body.data.subtotal).toBe(200);

      // Remove item at index 0 (Item 1 @ 100)
      const delRes = await request(app)
        .delete(`/api/v1/billing/${invId}/items/0`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.data.lineItems.length).toBe(1);
      expect(delRes.body.data.lineItems[0].description).toBe('Item 2');
      // New: subtotal = 100, tax = 10, discount = 10 -> total = 100
      expect(delRes.body.data.subtotal).toBe(100);
      expect(delRes.body.data.tax).toBe(10);
      expect(delRes.body.data.total).toBe(100);
    });

    it('returns 409 Conflict when attempting to remove an item from an issued invoice', async () => {
      const createRes = await request(app)
        .post('/api/v1/billing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId: patientProfileId,
          lineItems: [
            { description: 'Item 1', quantity: 1, unitPrice: 100 },
            { description: 'Item 2', quantity: 1, unitPrice: 50 },
          ],
        });

      const invId = createRes.body.data._id;

      // Issue invoice
      await request(app)
        .patch(`/api/v1/billing/${invId}/issue`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Try to remove item from issued invoice
      const delRes = await request(app)
        .delete(`/api/v1/billing/${invId}/items/0`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(409);
      expect(delRes.body.error.message).toMatch(/draft/i);
    });

    it('returns 400 Bad Request when attempting to remove the last remaining item', async () => {
      const createRes = await createDraftInvoice(adminToken, patientProfileId);
      const invId = createRes.body.data._id;

      const delRes = await request(app)
        .delete(`/api/v1/billing/${invId}/items/0`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(400);
      expect(delRes.body.error.message).toMatch(/last remaining/i);
    });

    it('returns 403 Forbidden when a patient attempts to remove an item', async () => {
      const createRes = await request(app)
        .post('/api/v1/billing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId: patientProfileId,
          lineItems: [
            { description: 'Item 1', quantity: 1, unitPrice: 100 },
            { description: 'Item 2', quantity: 1, unitPrice: 50 },
          ],
        });

      const invId = createRes.body.data._id;

      const delRes = await request(app)
        .delete(`/api/v1/billing/${invId}/items/0`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(delRes.status).toBe(403);
    });
  });

  describe('Task 3.6 — GET /api/v1/billing/:id/pdf tests', () => {
    it('returns 200 and application/pdf starting with %PDF for admin', async () => {
      const createRes = await createDraftInvoice(adminToken, patientProfileId);
      const invId = createRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/billing/${invId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      const textHeader = Buffer.isBuffer(res.body)
        ? res.body.toString('utf-8', 0, 4)
        : (res.text || '').substring(0, 4);
      expect(textHeader).toBe('%PDF');
    });

    it('returns 200 for patient viewing their own invoice PDF', async () => {
      const createRes = await createDraftInvoice(adminToken, patientProfileId);
      const invId = createRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/billing/${invId}/pdf`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('returns 403 Forbidden when patient tries to access another patient invoice PDF', async () => {
      const createRes = await createDraftInvoice(adminToken, patientProfileId);
      const invId = createRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/billing/${invId}/pdf`)
        .set('Authorization', `Bearer ${secondPatientToken}`);

      expect(res.status).toBe(403);
    });
  });
});
