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
import { Doctor } from '../../../models/Doctor';

let mongoServer: MongoMemoryServer;

// IDs we'll reuse across tests
let doctorProfileId = '';
let patientProfileId = '';
let patientToken = '';
let doctorToken = '';
let adminToken = '';

// A future date for scheduling
const FUTURE_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  // Get the day of week to align with doctor availability
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
})();

// Day name for FUTURE_DATE
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const futureDayName = DAY_NAMES[new Date(FUTURE_DATE + 'T12:00:00Z').getDay()];

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  process.env.JWT_SECRET = 'test-secret-key-for-jwt';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jwt';
  process.env.NODE_ENV = 'test';

  // Create doctor user
  const docUser = await User.create({
    firstName: 'Vikram',
    lastName: 'Sharma',
    email: 'doctor@test.com',
    password: 'DocPass1!',
    role: 'doctor',
  });

  // Create doctor profile with availability on all days
  const doctorProfile = await Doctor.create({
    userId: docUser._id,
    specialization: 'General Medicine',
    qualification: ['MBBS'],
    availability: [
      { day: 'monday', startTime: '09:00', endTime: '17:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '17:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '17:00' },
      { day: 'thursday', startTime: '09:00', endTime: '17:00' },
      { day: 'friday', startTime: '09:00', endTime: '17:00' },
      { day: 'saturday', startTime: '09:00', endTime: '17:00' },
      { day: 'sunday', startTime: '09:00', endTime: '17:00' },
    ],
    consultationFee: 100,
  });
  doctorProfileId = doctorProfile._id.toString();

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

  // Create admin user
  await User.create({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@test.com',
    password: 'AdminPass1!',
    role: 'admin',
  });

  // Login all users
  const docLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'doctor@test.com', password: 'DocPass1!' });
  doctorToken = docLoginRes.body?.data?.accessToken ?? '';

  const patLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'patient@test.com', password: 'PatPass1!' });
  patientToken = patLoginRes.body?.data?.accessToken ?? '';

  const adminLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@test.com', password: 'AdminPass1!' });
  adminToken = adminLoginRes.body?.data?.accessToken ?? '';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Only clear appointments between tests, not users/doctors/patients
  const collections = mongoose.connection.collections;
  if (collections['appointments']) {
    await collections['appointments'].deleteMany({});
  }
});

describe('Appointment Routes', () => {
  it('1. POST /api/v1/appointments — books a new appointment, returns APT-XXXX id', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        patientId: patientProfileId,
        date: FUTURE_DATE,
        timeSlot: '09:00',
        type: 'consultation',
        reason: 'Regular checkup',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.appointmentId).toMatch(/^APT-\d{4}$/);
    expect(res.body.data.status).toBe('scheduled');
  });

  it('2. POST /api/v1/appointments — same doctor+date+slot second time returns 409', async () => {
    // First booking
    await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        patientId: patientProfileId,
        date: FUTURE_DATE,
        timeSlot: '10:00',
        type: 'consultation',
      });

    // Second booking same slot
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        patientId: patientProfileId,
        date: FUTURE_DATE,
        timeSlot: '10:00',
        type: 'consultation',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('3. POST /api/v1/appointments — date in the past returns 400', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        patientId: patientProfileId,
        date: pastDate,
        timeSlot: '09:00',
        type: 'consultation',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('4. GET /api/v1/appointments/slots?doctorId=&date= — returns array of available time strings', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/slots?doctorId=${doctorProfileId}&date=${FUTURE_DATE}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Slots should be HH:MM format
    expect(res.body.data[0]).toMatch(/^\d{2}:\d{2}$/);
  });

  it('5. PATCH /api/v1/appointments/:id/status — doctor updates to confirmed', async () => {
    // Book first
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        patientId: patientProfileId,
        date: FUTURE_DATE,
        timeSlot: '11:00',
        type: 'consultation',
      });

    expect(bookRes.status).toBe(201);
    const appointmentId = bookRes.body.data._id;

    // Doctor confirms
    const res = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('confirmed');
  });

  it('6. DELETE /api/v1/appointments/:id — patient cancels own appointment', async () => {
    // Book first
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorProfileId,
        patientId: patientProfileId,
        date: FUTURE_DATE,
        timeSlot: '12:00',
        type: 'consultation',
      });

    expect(bookRes.status).toBe(201);
    const appointmentId = bookRes.body.data._id;

    // Patient cancels
    const res = await request(app)
      .delete(`/api/v1/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ cancelReason: 'Change of plans' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('7. DELETE /api/v1/appointments/:id — patient cannot cancel another patient appointment (403)', async () => {
    // Create another patient
    const otherPatUser = await User.create({
      firstName: 'Other',
      lastName: 'Patient',
      email: 'other.patient@test.com',
      password: 'OtherPass1!',
      role: 'patient',
    });
    const otherPatProfile = await Patient.create({ userId: otherPatUser._id });

    // Book appointment for the other patient (as admin)
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        doctorId: doctorProfileId,
        patientId: otherPatProfile._id.toString(),
        date: FUTURE_DATE,
        timeSlot: '14:00',
        type: 'consultation',
      });

    expect(bookRes.status).toBe(201);
    const appointmentId = bookRes.body.data._id;

    // Original patient tries to cancel other patient's appointment
    const res = await request(app)
      .delete(`/api/v1/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ cancelReason: 'Unauthorized cancel' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  describe('8. Doctor Leave Window Enforcement [Task 3.3 / F2]', () => {
    let leaveDoctorProfileId: string;

    beforeEach(async () => {
      const docUser = await User.create({
        firstName: 'Holiday',
        lastName: 'Doctor',
        email: `holiday.doc.${Date.now()}@test.com`,
        password: 'DocPass1!',
        role: 'doctor',
      });

      const leaveDoctor = await Doctor.create({
        userId: docUser._id,
        specialization: 'Dermatology',
        availability: [
          { day: 'monday', startTime: '09:00', endTime: '12:00' },
          { day: 'tuesday', startTime: '09:00', endTime: '12:00' },
          { day: 'wednesday', startTime: '09:00', endTime: '12:00' },
          { day: 'thursday', startTime: '09:00', endTime: '12:00' },
          { day: 'friday', startTime: '09:00', endTime: '12:00' },
          { day: 'saturday', startTime: '09:00', endTime: '12:00' },
          { day: 'sunday', startTime: '09:00', endTime: '12:00' },
        ],
        leaves: [
          {
            startDate: new Date('2026-11-10T00:00:00.000Z'),
            endDate: new Date('2026-11-12T00:00:00.000Z'),
            reason: 'Medical Conference',
          },
        ],
      });
      leaveDoctorProfileId = leaveDoctor._id.toString();
    });

    it('rejects booking on dates inside the leave window (inclusive)', async () => {
      // 2026-11-10 is the leave start date
      const resStart = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: leaveDoctorProfileId,
          patientId: patientProfileId,
          date: '2026-11-10',
          timeSlot: '09:00',
          type: 'consultation',
        });

      expect(resStart.status).toBe(400);
      expect(resStart.body.error.message).toMatch(/leave/i);

      // 2026-11-11 is inside the leave window
      const resMid = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: leaveDoctorProfileId,
          patientId: patientProfileId,
          date: '2026-11-11',
          timeSlot: '09:00',
          type: 'consultation',
        });

      expect(resMid.status).toBe(400);
      expect(resMid.body.error.message).toMatch(/leave/i);

      // 2026-11-12 is the leave end date (inclusive)
      const resEnd = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: leaveDoctorProfileId,
          patientId: patientProfileId,
          date: '2026-11-12',
          timeSlot: '09:00',
          type: 'consultation',
        });

      expect(resEnd.status).toBe(400);
      expect(resEnd.body.error.message).toMatch(/leave/i);
    });

    it('succeeds booking on the day before and day after the leave window', async () => {
      // Day before: 2026-11-09
      const resBefore = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: leaveDoctorProfileId,
          patientId: patientProfileId,
          date: '2026-11-09',
          timeSlot: '09:00',
          type: 'consultation',
        });

      expect(resBefore.status).toBe(201);
      expect(resBefore.body.success).toBe(true);

      // Day after: 2026-11-13
      const resAfter = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: leaveDoctorProfileId,
          patientId: patientProfileId,
          date: '2026-11-13',
          timeSlot: '09:00',
          type: 'consultation',
        });

      expect(resAfter.status).toBe(201);
      expect(resAfter.body.success).toBe(true);
    });

    it('returns empty slots array on a leave day and normal slots on working day', async () => {
      // Leave day: 2026-11-11
      const resLeave = await request(app)
        .get(`/api/v1/appointments/slots?doctorId=${leaveDoctorProfileId}&date=2026-11-11`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(resLeave.status).toBe(200);
      expect(resLeave.body.data).toEqual([]);

      // Working day: 2026-11-09
      const resWork = await request(app)
        .get(`/api/v1/appointments/slots?doctorId=${leaveDoctorProfileId}&date=2026-11-09`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(resWork.status).toBe(200);
      expect(resWork.body.data.length).toBeGreaterThan(0);
      expect(resWork.body.data).toContain('09:00');
    });
  });

  describe('Task 3.4 — Queue token on appointments', () => {
    let secondDoctorProfileId: string;

    beforeAll(async () => {
      // Create a second doctor with monday-friday availability
      const doc2User = await User.create({
        firstName: 'Second',
        lastName: 'Doctor',
        email: 'doc2.token@test.com',
        password: 'Password123!',
        role: 'doctor',
      });
      const doc2Profile = await Doctor.create({
        userId: doc2User._id,
        specialization: 'Neurology',
        consultationFee: 200,
        availability: [
          { day: 'monday', startTime: '09:00', endTime: '17:00' },
          { day: 'tuesday', startTime: '09:00', endTime: '17:00' },
          { day: 'wednesday', startTime: '09:00', endTime: '17:00' },
          { day: 'thursday', startTime: '09:00', endTime: '17:00' },
          { day: 'friday', startTime: '09:00', endTime: '17:00' },
        ],
      });
      secondDoctorProfileId = doc2Profile._id.toString();
    });

    it('assigns sequential tokens per doctor and date, and never reuses tokens after cancellation', async () => {
      const testDate = '2026-12-01'; // Tuesday
      // 1. First booking -> token 1
      const res1 = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: testDate,
          timeSlot: '09:00',
          type: 'consultation',
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.tokenNumber).toBe(1);

      // Cancel first booking
      const appt1Id = res1.body.data._id;
      const cancelRes = await request(app)
        .delete(`/api/v1/appointments/${appt1Id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ cancelReason: 'Rescheduling' });

      expect(cancelRes.status).toBe(200);

      // 2. Second booking on same date -> token 2 (never reuses token 1)
      const res2 = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: testDate,
          timeSlot: '10:00',
          type: 'consultation',
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.tokenNumber).toBe(2);
    });

    it('generates independent token sequences across doctors and dates', async () => {
      const dateA = '2026-12-02'; // Wednesday
      const dateB = '2026-12-03'; // Thursday

      // Doctor 1 on dateA -> token 1
      const resDoc1DateA = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: dateA,
          timeSlot: '09:00',
          type: 'consultation',
        });
      expect(resDoc1DateA.status).toBe(201);
      expect(resDoc1DateA.body.data.tokenNumber).toBe(1);

      // Doctor 2 on dateA -> token 1 (independent doctor)
      const resDoc2DateA = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: secondDoctorProfileId,
          patientId: patientProfileId,
          date: dateA,
          timeSlot: '09:00',
          type: 'consultation',
        });
      expect(resDoc2DateA.status).toBe(201);
      expect(resDoc2DateA.body.data.tokenNumber).toBe(1);

      // Doctor 1 on dateB -> token 1 (independent date)
      const resDoc1DateB = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: dateB,
          timeSlot: '09:00',
          type: 'consultation',
        });
      expect(resDoc1DateB.status).toBe(201);
      expect(resDoc1DateB.body.data.tokenNumber).toBe(1);
    });

    it('assigns unique tokens under 5 parallel bookings for different slots', async () => {
      const testDate = '2026-12-04'; // Friday
      const slots = ['09:00', '09:30', '10:00', '10:30', '11:00'];

      // Admin books 5 slots in parallel
      const parallelPromises = slots.map((timeSlot) =>
        request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            doctorId: doctorProfileId,
            patientId: patientProfileId,
            date: testDate,
            timeSlot,
            type: 'consultation',
          })
      );

      const responses = await Promise.all(parallelPromises);
      for (const res of responses) {
        expect(res.status).toBe(201);
        expect(typeof res.body.data.tokenNumber).toBe('number');
      }

      const tokenNumbers = responses.map((r) => r.body.data.tokenNumber);
      const uniqueTokens = new Set(tokenNumbers);
      expect(uniqueTokens.size).toBe(5);
      expect(tokenNumbers.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Task 3.6 — GET /api/v1/appointments/:id/slip tests', () => {
    it('returns 200 and application/pdf starting with %PDF for doctor/admin', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-07',
          timeSlot: '09:00',
          type: 'consultation',
        });

      const aptId = bookRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/appointments/${aptId}/slip`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      const textHeader = Buffer.isBuffer(res.body)
        ? res.body.toString('utf-8', 0, 4)
        : (res.text || '').substring(0, 4);
      expect(textHeader).toBe('%PDF');
    });

    it('returns 200 when patient downloads their own appointment slip', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-07',
          timeSlot: '09:30',
          type: 'consultation',
        });

      const aptId = bookRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/appointments/${aptId}/slip`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('returns 403 Forbidden when another patient tries to download appointment slip', async () => {
      const otherUser = await User.create({
        firstName: 'Other',
        lastName: 'Patient',
        email: 'other_pat_slip@test.com',
        password: 'Password1!',
        role: 'patient',
      });
      await Patient.create({ userId: otherUser._id });

      const otherLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'other_pat_slip@test.com', password: 'Password1!' });
      const otherPatientToken = otherLoginRes.body?.data?.accessToken;

      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-07',
          timeSlot: '10:00',
          type: 'consultation',
        });

      const aptId = bookRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/appointments/${aptId}/slip`)
        .set('Authorization', `Bearer ${otherPatientToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Comprehensive Appointment Branch & Filter Coverage', () => {
    it('retrieves appointment by ID and handles 404 for non-existent appointment', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '09:00',
          type: 'consultation',
        });
      const aptId = bookRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/appointments/${aptId}`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(aptId);

      const notFoundRes = await request(app)
        .get(`/api/v1/appointments/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(notFoundRes.status).toBe(404);
    });

    it('prevents another patient from viewing appointment details (403)', async () => {
      const otherUser = await User.create({
        firstName: 'Stranger',
        lastName: 'Patient',
        email: 'stranger_pat@test.com',
        password: 'Password1!',
        role: 'patient',
      });
      await Patient.create({ userId: otherUser._id });

      const otherLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'stranger_pat@test.com', password: 'Password1!' });
      const otherToken = otherLoginRes.body?.data?.accessToken;

      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '09:30',
          type: 'consultation',
        });
      const aptId = bookRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/appointments/${aptId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });

    it('lists appointments with date, doctorId, patientId, status, and departmentId filters', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '10:00',
          type: 'consultation',
        });
      expect(bookRes.status).toBe(201);

      const res = await request(app)
        .get(`/api/v1/appointments?date=2026-12-08&doctorId=${doctorProfileId}&patientId=${patientProfileId}&status=scheduled,confirmed`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects doctor trying to update another doctor appointment (403)', async () => {
      // Create a second doctor
      const secondDocUser = await User.create({
        firstName: 'Dr',
        lastName: 'Other',
        email: 'other_doc@test.com',
        password: 'DocPass1!',
        role: 'doctor',
      });
      await Doctor.create({
        userId: secondDocUser._id,
        specialization: 'Dermatology',
        availability: [{ day: 'tuesday', startTime: '09:00', endTime: '17:00' }],
      });
      const secondDocLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'other_doc@test.com', password: 'DocPass1!' });
      const secondDocToken = secondDocLogin.body?.data?.accessToken;

      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '11:00',
          type: 'consultation',
        });
      const aptId = bookRes.body.data._id;

      const res = await request(app)
        .patch(`/api/v1/appointments/${aptId}/status`)
        .set('Authorization', `Bearer ${secondDocToken}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(403);
    });

    it('rejects patient trying to set status other than cancelled (403)', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '11:30',
          type: 'consultation',
        });
      const aptId = bookRes.body.data._id;

      const res = await request(app)
        .patch(`/api/v1/appointments/${aptId}/status`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(403);
    });

    it('allows patient to cancel their own appointment via DELETE /:id', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '14:00',
          type: 'consultation',
        });
      const aptId = bookRes.body.data._id;

      const res = await request(app)
        .delete(`/api/v1/appointments/${aptId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ cancelReason: 'Patient feeling better' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('validates booking business rules: past date, inactive doctor, doctor on leave, outside availability', async () => {
      // Past date
      const pastRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2020-01-01',
          timeSlot: '09:00',
          type: 'consultation',
        });
      expect(pastRes.status).toBe(400);

      // Inactive doctor
      const inactiveDocUser = await User.create({
        firstName: 'Inactive',
        lastName: 'Doc',
        email: 'inactive_doc@test.com',
        password: 'DocPass1!',
        role: 'doctor',
      });
      const inactiveDoc = await Doctor.create({
        userId: inactiveDocUser._id,
        specialization: 'Pediatrics',
        isActive: false,
        availability: [{ day: 'tuesday', startTime: '09:00', endTime: '17:00' }],
      });

      const inactiveRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: inactiveDoc._id.toString(),
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '09:00',
          type: 'consultation',
        });
      expect(inactiveRes.status).toBe(400);

      // Doctor on leave
      const leaveDocUser = await User.create({
        firstName: 'Leave',
        lastName: 'Doc',
        email: 'leave_doc@test.com',
        password: 'DocPass1!',
        role: 'doctor',
      });
      const leaveDoc = await Doctor.create({
        userId: leaveDocUser._id,
        specialization: 'Surgery',
        isActive: true,
        leaves: [{ startDate: new Date('2026-12-08'), endDate: new Date('2026-12-08'), reason: 'Conference' }],
        availability: [{ day: 'tuesday', startTime: '09:00', endTime: '17:00' }],
      });

      const leaveRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: leaveDoc._id.toString(),
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '09:00',
          type: 'consultation',
        });
      expect(leaveRes.status).toBe(400);

      // Slot outside doctor availability
      const slotOutsideRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: doctorProfileId,
          patientId: patientProfileId,
          date: '2026-12-08',
          timeSlot: '23:00',
          type: 'consultation',
        });
      expect(slotOutsideRes.status).toBe(400);
    });

    it('handles getAvailableSlots for doctor on leave and non-existent doctor', async () => {
      // Non-existent doctor -> 404
      const notFoundRes = await request(app)
        .get(`/api/v1/appointments/slots?doctorId=${new mongoose.Types.ObjectId()}&date=2026-12-08`)
        .set('Authorization', `Bearer ${patientToken}`);
      expect(notFoundRes.status).toBe(404);

      // Leave doctor -> empty slots
      const leaveDocUser = await User.create({
        firstName: 'Vacation',
        lastName: 'Doc',
        email: 'vacation_doc@test.com',
        password: 'DocPass1!',
        role: 'doctor',
      });
      const leaveDoc = await Doctor.create({
        userId: leaveDocUser._id,
        specialization: 'Radiology',
        isActive: true,
        leaves: [{ startDate: new Date('2026-12-08'), endDate: new Date('2026-12-08'), reason: 'Holiday' }],
        availability: [{ day: 'tuesday', startTime: '09:00', endTime: '17:00' }],
      });

      const leaveSlotsRes = await request(app)
        .get(`/api/v1/appointments/slots?doctorId=${leaveDoc._id}&date=2026-12-08`)
        .set('Authorization', `Bearer ${patientToken}`);
      expect(leaveSlotsRes.status).toBe(200);
      expect(leaveSlotsRes.body.data).toEqual([]);
    });

    it('returns own appointments when requested by patient, and empty array if patient profile missing', async () => {
      // Patient with profile lists appointments
      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Patient without profile lists appointments
      const noProfileUser = await User.create({
        firstName: 'NoProfile',
        lastName: 'Patient',
        email: 'noprofile_pat@test.com',
        password: 'Password1!',
        role: 'patient',
      });
      const noProfileLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'noprofile_pat@test.com', password: 'Password1!' });
      const noProfileToken = noProfileLogin.body?.data?.accessToken;

      const noProfileRes = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${noProfileToken}`);
      expect(noProfileRes.status).toBe(200);
      expect(noProfileRes.body.data).toEqual([]);
    });

    it('returns 400 validation error for invalid booking or status update payloads', async () => {
      const invalidBookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ doctorId: 'not-an-id' });
      expect(invalidBookRes.status).toBe(400);

      const invalidStatusRes = await request(app)
        .patch(`/api/v1/appointments/${new mongoose.Types.ObjectId()}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'invalid_status_enum' });
      expect(invalidStatusRes.status).toBe(400);
    });

    it('retrieves upcoming appointments via AppointmentService', async () => {
      const { getUpcomingAppointments } = await import('../service');
      const upcoming = await getUpcomingAppointments(patientProfileId);
      expect(Array.isArray(upcoming)).toBe(true);
    });
  });
});

// Suppress unused variable warning for setup variable
void futureDayName;
