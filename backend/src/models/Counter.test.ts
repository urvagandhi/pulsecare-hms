import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Counter, nextSequence, clearCounterCache, getHighestSuffix } from './Counter';
import { Invoice } from './Invoice';
import { Appointment } from './Appointment';
import { Patient } from './Patient';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  clearCounterCache();
  await Counter.deleteMany({});
  await Invoice.deleteMany({});
  await Appointment.deleteMany({});
  await Patient.deleteMany({});
});

describe('Atomic Counter & ID Generation [Task 3.1]', () => {
  it('generates sequential numbers for a single key', async () => {
    const s1 = await nextSequence('test_key');
    const s2 = await nextSequence('test_key');
    const s3 = await nextSequence('test_key');

    expect(s1).toBe(1);
    expect(s2).toBe(2);
    expect(s3).toBe(3);
  });

  it('keeps independent sequences for different keys', async () => {
    const a1 = await nextSequence('alpha');
    const b1 = await nextSequence('beta');
    const a2 = await nextSequence('alpha');

    expect(a1).toBe(1);
    expect(b1).toBe(1);
    expect(a2).toBe(2);
  });

  it('initializes from highest existing suffix in existing collections', async () => {
    // Simulate pre-existing records with highest suffix 5
    const dummyUserId = new Types.ObjectId();
    await Patient.create({
      userId: dummyUserId,
      patientId: 'PAT-0005',
      allergies: [],
      medicalHistory: [],
    });

    const highest = await getHighestSuffix(Patient, 'patientId', 'PAT-');
    expect(highest).toBe(5);

    const nextSeq = await nextSequence('patient', () => getHighestSuffix(Patient, 'patientId', 'PAT-'));
    expect(nextSeq).toBe(6);
  });

  it('creates 10 invoices in parallel with Promise.all with unique IDs and no duplicate key errors', async () => {
    const patientId = new Types.ObjectId();
    const createdBy = new Types.ObjectId();

    const invoicePromises = Array.from({ length: 10 }, (_, i) =>
      Invoice.create({
        patient: patientId,
        issuedBy: createdBy,
        lineItems: [
          {
            description: `Consultation ${i + 1}`,
            quantity: 1,
            unitPrice: 100,
          },
        ],
        taxRate: 10,
        discount: 0,
      })
    );

    const invoices = await Promise.all(invoicePromises);
    expect(invoices).toHaveLength(10);

    const ids = invoices.map((inv) => inv.invoiceId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    // Verify all IDs match INV-00xx format
    ids.forEach((id) => {
      expect(id).toMatch(/^INV-\d{4}$/);
    });
  });

  it('creates 10 appointments in different slots in parallel with Promise.all with unique IDs', async () => {
    const doctorId = new Types.ObjectId();
    const patientId = new Types.ObjectId();
    const createdBy = new Types.ObjectId();
    const date = new Date('2026-10-15T00:00:00.000Z');

    const appointmentPromises = Array.from({ length: 10 }, (_, i) => {
      const hour = String(9 + i).padStart(2, '0');
      return Appointment.create({
        patient: patientId,
        doctor: doctorId,
        date,
        timeSlot: `${hour}:00`,
        type: 'consultation',
        status: 'scheduled',
        createdBy,
      });
    });

    const appointments = await Promise.all(appointmentPromises);
    expect(appointments).toHaveLength(10);

    const ids = appointments.map((apt) => apt.appointmentId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    ids.forEach((id) => {
      expect(id).toMatch(/^APT-\d{4}$/);
    });
  });
});
