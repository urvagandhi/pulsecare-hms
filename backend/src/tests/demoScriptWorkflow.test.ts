import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
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

jest.mock('../socket', () => ({
  emitToUser: jest.fn(),
  emitToRole: jest.fn(),
}));

import { app } from '../app';
import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { Department } from '../models/Department';
import { Appointment } from '../models/Appointment';
import { Invoice } from '../models/Invoice';
import { clearCounterCache } from '../models/Counter';

let mongoServer: MongoMemoryServer;

let adminToken = '';
let receptionistToken = '';
let doctorToken = '';
let drSharmaProfileId = '';
let drSharmaUserId = '';
let cardiologyDeptId = '';
let kavyaToken = '';
let kavyaPatientId = '';
let kavyaUserId = '';
let kavyaApptId = '';
let invoiceId = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_for_demo_script_testing_min_32';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_for_demo_script_testing_min_32';
  clearCounterCache();

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Seed Admin
  const adminUser = await User.create({
    firstName: 'Rajesh',
    lastName: 'Malhotra',
    email: 'admin@pulsecare.test',
    password: 'Test@123',
    role: 'admin',
  });
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@pulsecare.test', password: 'Test@123' });
  adminToken = adminLogin.body.data.accessToken;

  // Seed Receptionist
  await User.create({
    firstName: 'Pooja',
    lastName: 'Verma',
    email: 'reception@pulsecare.test',
    password: 'Test@123',
    role: 'receptionist',
  });
  const recLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'reception@pulsecare.test', password: 'Test@123' });
  receptionistToken = recLogin.body.data.accessToken;

  // Seed Department: Cardiology
  const dept = await Department.create({
    name: 'Cardiology',
    description: 'Heart and cardiovascular system care',
  });
  cardiologyDeptId = dept._id.toString();

  // Seed Doctor: Dr. Arvind Sharma (Mon-Fri 09:00 - 13:00, Fee 600)
  const drUser = await User.create({
    firstName: 'Arvind',
    lastName: 'Sharma',
    email: 'dr.sharma@pulsecare.test',
    password: 'Test@123',
    role: 'doctor',
    phone: '9820011223',
  });
  drSharmaUserId = drUser._id.toString();

  const drDoc = await Doctor.create({
    userId: drUser._id,
    specialization: 'Cardiology',
    qualification: ['MBBS', 'MD', 'DM (Cardiology)'],
    department: dept._id,
    consultationFee: 600,
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '13:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '13:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '13:00' },
      { day: 'thursday', startTime: '09:00', endTime: '13:00' },
      { day: 'friday', startTime: '09:00', endTime: '13:00' },
      { day: 'saturday', startTime: '09:00', endTime: '13:00' },
      { day: 'sunday', startTime: '09:00', endTime: '13:00' },
    ],
  });
  drSharmaProfileId = drDoc._id.toString();

  const drLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'dr.sharma@pulsecare.test', password: 'Test@123' });
  doctorToken = drLogin.body.data.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('PulseCare HMS — Official Demonstration Script & Workflow End-to-End Test Suite', () => {
  // ─── SCENE 1 & 2: Health & System Baseline ──────────────────────────────────
  describe('Scene 1 & 2: System Health and SCM/SQA Verification', () => {
    it('verifies system health check endpoint is operational', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
    });

    it('verifies seeded staff accounts authenticate cleanly', async () => {
      expect(adminToken).toBeTruthy();
      expect(receptionistToken).toBeTruthy();
      expect(doctorToken).toBeTruthy();
    });
  });

  // ─── SCENE 3: Module 1 — Patient Registration & Safe Search ────────────────
  describe('Scene 3: Module 1 — Patient Registration & Search Workflow', () => {
    it('registers new patient Kavya Patel with blood group B+ and phone 9876543210', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Kavya',
          lastName: 'Patel',
          email: 'kavya.patel@test.com',
          password: 'Test@123',
          phone: '9876543210',
          bloodGroup: 'B+',
          allergies: ['Penicillin'],
          emergencyContact: {
            name: 'Ramesh Patel',
            relationship: 'Father',
            phone: '9876543211',
          },
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.data.user.role).toBe('patient');
      expect(regRes.body.data.accessToken).toBeTruthy();

      kavyaToken = regRes.body.data.accessToken;
      kavyaUserId = regRes.body.data.user._id;

      // Verify atomic PAT-XXXX generation
      const pat = await Patient.findOne({ userId: kavyaUserId });
      expect(pat).toBeTruthy();
      expect(pat!.patientId).toMatch(/^PAT-\d{4}$/);
      expect(pat!.bloodGroup).toBe('B+');
      kavyaPatientId = pat!._id.toString();
    });

    it('allows patient Kavya to download her official Patient ID Card PDF', async () => {
      const cardRes = await request(app)
        .get('/api/v1/patients/me/id-card')
        .set('Authorization', `Bearer ${kavyaToken}`);

      expect(cardRes.status).toBe(200);
      expect(cardRes.headers['content-type']).toContain('application/pdf');
      // Verify %PDF magic header bytes
      expect(cardRes.body.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('allows Receptionist to search patients safely by phone and name with regex escaping', async () => {
      // 1. Search by exact phone
      const phoneRes = await request(app)
        .get('/api/v1/patients?search=9876543210')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(phoneRes.status).toBe(200);
      expect(phoneRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(phoneRes.body.data[0].userId.firstName).toBe('Kavya');

      // 2. Search with regex metacharacters (e.g. Kavya (Patel) or .*) without throwing 500
      const regexRes = await request(app)
        .get('/api/v1/patients?search=Kavya+(Patel)')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(regexRes.status).toBe(200);
      expect(regexRes.body.success).toBe(true);
    });
  });

  // ─── SCENE 4: Module 2 — Doctor Leave & Slot Blackout ───────────────────────
  describe('Scene 4: Module 2 — Doctor Leave & Automatic Slot Blackout (Defect D-022)', () => {
    const tomorrowStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    })();

    it('allows Admin to schedule approved leave for Dr. Sharma for tomorrow', async () => {
      const leaveRes = await request(app)
        .post(`/api/v1/staff/doctors/${drSharmaProfileId}/leaves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          startDate: tomorrowStr,
          endDate: tomorrowStr,
          reason: 'Medical Conference in Ahmedabad',
        });

      expect([200, 201]).toContain(leaveRes.status);
      expect(leaveRes.body.success).toBe(true);

      const updatedDoc = await Doctor.findById(drSharmaProfileId);
      expect(updatedDoc!.leaves).toHaveLength(1);
      expect(updatedDoc!.leaves![0].reason).toBe('Medical Conference in Ahmedabad');
    });

    it('returns empty slots [] and blocks appointment booking when doctor is on leave', async () => {
      // 1. Slot engine returns empty available slots
      const slotsRes = await request(app)
        .get(`/api/v1/appointments/slots?doctorId=${drSharmaProfileId}&date=${tomorrowStr}`)
        .set('Authorization', `Bearer ${kavyaToken}`);

      expect(slotsRes.status).toBe(200);
      expect(slotsRes.body.data).toEqual([]);

      // 2. Direct API booking attempt is rejected with 400 'Doctor is on leave'
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${kavyaToken}`)
        .send({
          doctorId: drSharmaProfileId,
          patientId: kavyaPatientId,
          date: tomorrowStr,
          timeSlot: '10:00',
          type: 'consultation',
          reason: 'ECG consultation',
        });

      expect(bookRes.status).toBe(400);
      expect(bookRes.body.error.message).toMatch(/leave/i);
    });
  });

  // ─── SCENE 5: Module 3 — Appointment Booking, Queue Token & PDF Slip ────────
  describe('Scene 5: Module 3 — Appointment Booking, Daily Queue Token #1 & Concurrency Lockout', () => {
    // Pick day after tomorrow (when Dr. Sharma is back on duty)
    const bookingDateStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      return d.toISOString().split('T')[0];
    })();

    it('books appointment for Kavya Patel at 10:00 and generates atomic daily Queue Token #1', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${kavyaToken}`)
        .send({
          doctorId: drSharmaProfileId,
          patientId: kavyaPatientId,
          date: bookingDateStr,
          timeSlot: '10:00',
          type: 'consultation',
          reason: 'ECG consultation',
        });

      expect(bookRes.status).toBe(201);
      expect(bookRes.body.success).toBe(true);
      expect(bookRes.body.data.appointmentId).toMatch(/^APT-\d{4}$/);
      expect(bookRes.body.data.tokenNumber).toBe(1); // Queue Token #1!

      kavyaApptId = bookRes.body.data._id;
    });

    it('prevents concurrent double-booking with 409 Conflict via database partial unique index', async () => {
      // Create a second patient
      const user2 = await User.create({
        firstName: 'Diya',
        lastName: 'Patel',
        email: 'diya.patel@test.com',
        password: 'Test@123',
        role: 'patient',
      });
      const pat2 = await Patient.create({ userId: user2._id });

      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'diya.patel@test.com', password: 'Test@123' });

      // Attempt to claim the exact same doctor, date, and 10:00 slot
      const conflictRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${login2.body.data.accessToken}`)
        .send({
          doctorId: drSharmaProfileId,
          patientId: pat2._id.toString(),
          date: bookingDateStr,
          timeSlot: '10:00',
          type: 'consultation',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe('CONFLICT');
    });

    it('allows downloading printable Appointment Slip PDF with Token #1 badge', async () => {
      const slipRes = await request(app)
        .get(`/api/v1/appointments/${kavyaApptId}/slip`)
        .set('Authorization', `Bearer ${kavyaToken}`);

      expect(slipRes.status).toBe(200);
      expect(slipRes.headers['content-type']).toContain('application/pdf');
      expect(slipRes.body.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('shows appointment on Dr. Sharmas OPD schedule with Token #1', async () => {
      const schedRes = await request(app)
        .get(`/api/v1/appointments?date=${bookingDateStr}`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(schedRes.status).toBe(200);
      expect(schedRes.body.data.length).toBeGreaterThanOrEqual(1);

      const found = schedRes.body.data.find((a: any) => a._id === kavyaApptId);
      expect(found).toBeTruthy();
      expect(found.tokenNumber).toBe(1);
      expect(found.timeSlot).toBe('10:00');
    });
  });

  // ─── SCENE 6: Module 4 — Itemized Billing, Recalculation & Tax PDF ──────────
  describe('Scene 6: Module 4 — Itemized Billing, Defect D-019 Recalculation & Invoice PDF', () => {
    it('creates draft invoice with Consultation (₹600), ECG (₹450), Medicine (₹160), Tax 5%, Discount ₹50', async () => {
      const invRes = await request(app)
        .post('/api/v1/billing')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId: kavyaPatientId,
          appointmentId: kavyaApptId,
          lineItems: [
            { description: 'Dr. Sharma Consultation', quantity: 1, unitPrice: 600, category: 'consultation' },
            { description: 'ECG Test Diagnostic', quantity: 1, unitPrice: 450, category: 'procedure' },
            { description: 'Prescribed Cardiac Medicine', quantity: 1, unitPrice: 160, category: 'medicine' },
          ],
          taxRate: 5,
          discount: 50,
          notes: 'Outpatient consultation and routine diagnostic',
        });

      expect(invRes.status).toBe(201);
      expect(invRes.body.success).toBe(true);
      const inv = invRes.body.data;
      expect(inv.status).toBe('draft');
      expect(inv.invoiceId).toMatch(/^INV-\d{4}$/);

      // Verify initial financial math:
      // Subtotal = 600 + 450 + 160 = 1210
      // Tax = 5% of 1210 = 60.50
      // Total = 1210 + 60.50 - 50 = 1220.50
      expect(inv.subtotal).toBe(1210);
      expect(inv.tax).toBe(60.5);
      expect(inv.total).toBe(1220.5);
      expect(inv.balance).toBe(1220.5);

      invoiceId = inv._id;
    });

    it('demonstrates Defect D-019 fix: removes ECG item and instantly recalculates subtotal, tax, and balance', async () => {
      // Delete ECG item at index 1
      const delRes = await request(app)
        .delete(`/api/v1/billing/${invoiceId}/items/1`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(delRes.status).toBe(200);
      const updatedInv = delRes.body.data;
      expect(updatedInv.lineItems).toHaveLength(2);

      // Subtotal: 600 + 160 = 760
      // Tax: 5% of 760 = 38.00
      // Total: 760 + 38.00 - 50 = 748.00
      // Balance: 748.00
      expect(updatedInv.subtotal).toBe(760);
      expect(updatedInv.tax).toBe(38);
      expect(updatedInv.total).toBe(748);
      expect(updatedInv.balance).toBe(748);
    });

    it('issues invoice and records full payment transitioning status to paid', async () => {
      // 1. Issue invoice
      const issueRes = await request(app)
        .patch(`/api/v1/billing/${invoiceId}/issue`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(issueRes.status).toBe(200);
      expect(issueRes.body.data.status).toBe('issued');

      // 2. Record payment of ₹748 via POST /pay (or /payments)
      const payRes = await request(app)
        .post(`/api/v1/billing/${invoiceId}/pay`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          amount: 748,
          method: 'cash',
        });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.amountPaid).toBe(748);
      expect(payRes.body.data.balance).toBe(0);
      expect(payRes.body.data.status).toBe('paid');
    });

    it('downloads official printable Tax Invoice PDF', async () => {
      const pdfRes = await request(app)
        .get(`/api/v1/billing/${invoiceId}/pdf`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.body.toString('utf-8', 0, 4)).toBe('%PDF');
    });
  });

  // ─── SCENE 7: Executive Analytics ──────────────────────────────────────────
  describe('Scene 7: Executive Analytics & SPM Synthesis', () => {
    it('allows Admin to retrieve executive appointment metrics and revenue summaries', async () => {
      const apptAnalytics = await request(app)
        .get('/api/v1/analytics/appointments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(apptAnalytics.status).toBe(200);
      expect(apptAnalytics.body.success).toBe(true);

      const revAnalytics = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(revAnalytics.status).toBe(200);
      expect(revAnalytics.body.success).toBe(true);
    });
  });
});
