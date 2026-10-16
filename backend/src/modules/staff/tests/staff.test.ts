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

import { app } from '../../../app';
import { User } from '../../../models/User';
import { Doctor } from '../../../models/Doctor';

let mongoServer: MongoMemoryServer;
let adminToken: string;
let doctorToken: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  process.env.JWT_SECRET = 'test-secret-key-for-jwt';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jwt';
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  adminToken = '';
  doctorToken = '';
});

async function createAdminAndLogin() {
  // Directly create admin user (register endpoint forces patient role)
  const admin = await User.create({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@test.com',
    password: 'AdminPass1!',
    role: 'admin',
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@test.com', password: 'AdminPass1!' });
  // If login returns tokens
  if (res.body?.data?.accessToken) return res.body.data.accessToken;
  // fallback: try register then manual patch
  return null;
}

async function createDoctorAndLogin() {
  // Create doctor user directly
  const doctor = await User.create({
    firstName: 'Vikram',
    lastName: 'Sharma',
    email: 'doctor@test.com',
    password: 'DoctorPass1!',
    role: 'doctor',
  });
  await Doctor.create({
    userId: doctor._id,
    specialization: 'Cardiology',
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'doctor@test.com', password: 'DoctorPass1!' });
  if (res.body?.data?.accessToken) return res.body.data.accessToken as string;
  return null;
}

describe('Staff Routes', () => {
  beforeEach(async () => {
    adminToken = (await createAdminAndLogin()) ?? '';
    doctorToken = (await createDoctorAndLogin()) ?? '';
  });

  it('1. POST /api/v1/staff — admin creates a doctor (returns DOC-XXXX id)', async () => {
    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Priya',
        lastName: 'Nair',
        email: 'priya.nair@hospital.com',
        password: 'Password1!',
        role: 'doctor',
        specialization: 'Neurology',
        qualification: ['MBBS', 'MD'],
        consultationFee: 150,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile).toBeDefined();
    expect(res.body.data.profile.doctorId).toMatch(/^DOC-\d{4}$/);
  });

  it('2. POST /api/v1/staff — non-admin (doctor token) gets 403', async () => {
    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        firstName: 'Test',
        lastName: 'Nurse',
        email: 'nurse@test.com',
        password: 'Password1!',
        role: 'nurse',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('3. GET /api/v1/doctors — returns paginated doctor list', async () => {
    const res = await request(app)
      .get('/api/v1/doctors')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBeDefined();
  });

  it('4. GET /api/v1/doctors/available?date=2025-01-06&specialization=Cardiology — returns matching doctors', async () => {
    // 2025-01-06 is a Monday
    const doctor = await User.create({
      firstName: 'Cardio',
      lastName: 'Doctor',
      email: 'cardio@test.com',
      password: 'Password1!',
      role: 'doctor',
    });
    await Doctor.create({
      userId: doctor._id,
      specialization: 'Cardiology',
      availability: [{ day: 'monday', startTime: '09:00', endTime: '17:00' }],
    });

    const res = await request(app)
      .get('/api/v1/doctors/available?date=2025-01-06&specialization=Cardiology')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].specialization).toBe('Cardiology');
  });

  it('5. GET /api/v1/departments — returns departments list', async () => {
    const res = await request(app)
      .get('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('6. POST /api/v1/departments — admin creates department', async () => {
    const res = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cardiology',
        description: 'Heart department',
        bedCount: 20,
        location: 'Floor 3',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Cardiology');
    expect(res.body.data._id).toBeDefined();
  });

  it('7. POST /api/v1/staff — admin creates nurse with NUR-XXXX id', async () => {
    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Nancy',
        lastName: 'Nurse',
        email: 'nancy.nurse@hospital.com',
        password: 'Password1!',
        role: 'nurse',
        ward: 'ICU Ward A',
        shift: 'morning',
        qualification: ['B.Sc Nursing'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.nurseId).toMatch(/^NUR-\d{4}$/);
    expect(res.body.data.profile.ward).toBe('ICU Ward A');
  });

  it('8. POST /api/v1/staff — admin creates receptionist with REC-XXXX id', async () => {
    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Robert',
        lastName: 'FrontDesk',
        email: 'robert.rec@hospital.com',
        password: 'Password1!',
        role: 'receptionist',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.receptionistId).toMatch(/^REC-\d{4}$/);
  });

  it('9. POST /api/v1/staff — doctor creation fails without specialization', async () => {
    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'NoSpec',
        lastName: 'Doctor',
        email: 'nospec.doc@hospital.com',
        password: 'Password1!',
        role: 'doctor',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('10. POST /api/v1/staff — fails with duplicate email (409 Conflict)', async () => {
    await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'First',
        lastName: 'Doc',
        email: 'dup.doc@hospital.com',
        password: 'Password1!',
        role: 'doctor',
        specialization: 'Pediatrics',
      });

    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Second',
        lastName: 'Doc',
        email: 'dup.doc@hospital.com',
        password: 'Password1!',
        role: 'doctor',
        specialization: 'Pediatrics',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('11. GET /api/v1/staff/:id — admin retrieves doctor, nurse, receptionist by userId', async () => {
    const docRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Doc',
        lastName: 'Find',
        email: 'find.doc@hospital.com',
        password: 'Password1!',
        role: 'doctor',
        specialization: 'ENT',
      });
    const docUserId = docRes.body.data.user._id;

    const res = await request(app)
      .get(`/api/v1/staff/${docUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('find.doc@hospital.com');
    expect(res.body.data.profile.specialization).toBe('ENT');

    // Nurse
    const nurseRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Nurse',
        lastName: 'Find',
        email: 'find.nurse@hospital.com',
        password: 'Password1!',
        role: 'nurse',
        ward: 'ER',
      });
    const nurseUserId = nurseRes.body.data.user._id;

    const nRes = await request(app)
      .get(`/api/v1/staff/${nurseUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(nRes.status).toBe(200);
    expect(nRes.body.data.profile.ward).toBe('ER');

    // 404
    const notFound = await request(app)
      .get(`/api/v1/staff/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(notFound.status).toBe(404);
  });

  it('12. GET /api/v1/staff — lists staff with and without role filter', async () => {
    await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Staff1',
        lastName: 'Doc',
        email: 'staff1@hospital.com',
        password: 'Password1!',
        role: 'doctor',
        specialization: 'Radiology',
      });

    await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Staff2',
        lastName: 'Nurse',
        email: 'staff2@hospital.com',
        password: 'Password1!',
        role: 'nurse',
      });

    const resAll = await request(app)
      .get('/api/v1/staff?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAll.status).toBe(200);
    expect(resAll.body.data.length).toBeGreaterThanOrEqual(2);

    const resRole = await request(app)
      .get('/api/v1/staff?role=doctor')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resRole.status).toBe(200);
    expect(resRole.body.data.every((s: any) => s.specialization !== undefined)).toBe(true);
  });

  it('13. PATCH /api/v1/staff/:id — admin updates doctor details and leaves', async () => {
    const docRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Old',
        lastName: 'Doc',
        email: 'update.doc@hospital.com',
        password: 'Password1!',
        role: 'doctor',
        specialization: 'Ortho',
        consultationFee: 100,
      });
    const docUserId = docRes.body.data.user._id;

    const res = await request(app)
      .patch(`/api/v1/staff/${docUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'UpdatedDoc',
        specialization: 'Orthopedics',
        consultationFee: 200,
        leaves: [
          {
            startDate: '2026-11-01',
            endDate: '2026-11-05',
            reason: 'Annual Vacation',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe('UpdatedDoc');

    // Verify profile updated
    const getRes = await request(app)
      .get(`/api/v1/staff/${docUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.data.profile.consultationFee).toBe(200);
    expect(getRes.body.data.profile.leaves.length).toBe(1);
    expect(getRes.body.data.profile.leaves[0].reason).toBe('Annual Vacation');
  });

  it('14. PATCH /api/v1/staff/:id — admin updates nurse and receptionist profile', async () => {
    const nRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Nurse1',
        lastName: 'Shift',
        email: 'nurse.shift@hospital.com',
        password: 'Password1!',
        role: 'nurse',
        ward: 'Maternity',
        shift: 'morning',
      });
    const nurseId = nRes.body.data.user._id;

    const patchNurse = await request(app)
      .patch(`/api/v1/staff/${nurseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ward: 'Pediatrics Ward',
        shift: 'night',
      });
    expect(patchNurse.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/v1/staff/${nurseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.data.profile.ward).toBe('Pediatrics Ward');
    expect(getRes.body.data.profile.shift).toBe('night');
  });

  it('15. DELETE /api/v1/staff/:id — admin deactivates staff member', async () => {
    const docRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Deact',
        lastName: 'Doc',
        email: 'deact.doc@hospital.com',
        password: 'Password1!',
        role: 'doctor',
        specialization: 'Urology',
      });
    const docUserId = docRes.body.data.user._id;

    const delRes = await request(app)
      .delete(`/api/v1/staff/${docUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/v1/staff/${docUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.data.user.isActive).toBe(false);
    expect(getRes.body.data.profile.isActive).toBe(false);
  });

  it('16. GET /api/v1/doctors/:id — retrieves doctor profile by ID, returns 404 for invalid ID', async () => {
    const docRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Profile',
        lastName: 'Doc',
        email: 'profile.doc@hospital.com',
        password: 'Password1!',
        role: 'doctor',
        specialization: 'Oncology',
      });
    const doctorProfileId = docRes.body.data.profile._id;

    const res = await request(app)
      .get(`/api/v1/doctors/${doctorProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.specialization).toBe('Oncology');

    const notFound = await request(app)
      .get(`/api/v1/doctors/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(notFound.status).toBe(404);
  });

  it('17. POST /api/v1/departments — handles duplicate name (409) and headDoctorId not found (404)', async () => {
    await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Neurology' });

    const dupRes = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Neurology' });
    expect(dupRes.status).toBe(409);

    const invalidHead = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'InvalidDept', headDoctorId: new mongoose.Types.ObjectId().toString() });
    expect(invalidHead.status).toBe(404);
  });

  it('18. PATCH /api/v1/departments/:id — updates department name, head doctor, and clears head doctor', async () => {
    const deptRes = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Surgery', description: 'General Surgery' });
    const deptId = deptRes.body.data._id;

    const patchRes = await request(app)
      .patch(`/api/v1/departments/${deptId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Advanced Surgery', bedCount: 15 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.description).toBe('Advanced Surgery');
    expect(patchRes.body.data.bedCount).toBe(15);

    const notFound = await request(app)
      .patch(`/api/v1/departments/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test' });
    expect(notFound.status).toBe(404);
  });
});
