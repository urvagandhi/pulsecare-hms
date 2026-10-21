import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../../../app';
import { User } from '../../../models/User';

describe('Notifications Module Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUserToken: string;
  let userId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const user = await User.create({
      email: 'notif.test@pulsecare.local',
      password: 'Password@123',
      role: 'doctor',
      firstName: 'Notif',
      lastName: 'User',
      isActive: true,
    });
    userId = (user._id as any).toString();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'notif.test@pulsecare.local', password: 'Password@123' });
    testUserToken = loginRes.body?.data?.accessToken ?? '';
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('GET /api/v1/notifications — initializes demo notifications if empty', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].read).toBe(false);
  });

  it('PATCH /api/v1/notifications/:id/read — marks notification as read', async () => {
    const listRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${testUserToken}`);

    const notifId = listRes.body.data[0]._id;

    const readRes = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.success).toBe(true);
    expect(readRes.body.data.read).toBe(true);
  });

  it('PATCH /api/v1/notifications/read-all — marks all as read', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/v1/notifications/:id — deletes notification', async () => {
    const listRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${testUserToken}`);

    const notifId = listRes.body.data[0]._id;

    const delRes = await request(app)
      .delete(`/api/v1/notifications/${notifId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });

  it('DELETE /api/v1/notifications — clears all notifications', async () => {
    const clearRes = await request(app)
      .delete('/api/v1/notifications')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.success).toBe(true);

    const checkRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${testUserToken}`);

    // Re-seeds demo items if empty
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.length).toBeGreaterThan(0);
  });
});
