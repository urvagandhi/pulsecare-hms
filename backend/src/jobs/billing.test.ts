import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

import { Invoice } from '../models/Invoice';
import { promoteOverdueInvoices } from './billing';

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
  await Invoice.deleteMany({});
});

describe('Billing Cron Job: promoteOverdueInvoices (Conflict 4 / FR-E1-5)', () => {
  it('promotes issued invoices past their dueDate to overdue status', async () => {
    const dummyPatient = new Types.ObjectId();
    const dummyUser = new Types.ObjectId();

    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

    // 1. Issued invoice that expired while in database
    const inv1 = await Invoice.create({
      patient: dummyPatient,
      issuedBy: dummyUser,
      status: 'issued',
      issuedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      dueDate: futureDate,
      lineItems: [{ description: 'Lab Test', quantity: 1, unitPrice: 200 }],
    });
    // Simulate time passing past dueDate without touching the document
    await Invoice.updateOne({ _id: inv1._id }, { $set: { dueDate: pastDate } });

    // 2. Future issued invoice -> should remain issued
    const inv2 = await Invoice.create({
      patient: dummyPatient,
      issuedBy: dummyUser,
      status: 'issued',
      issuedDate: new Date(),
      dueDate: futureDate,
      lineItems: [{ description: 'Medicine', quantity: 1, unitPrice: 150 }],
    });

    // 3. Paid invoice with past dueDate -> should remain paid
    const inv3 = await Invoice.create({
      patient: dummyPatient,
      issuedBy: dummyUser,
      status: 'paid',
      issuedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      dueDate: pastDate,
      lineItems: [{ description: 'Consultation', quantity: 1, unitPrice: 500 }],
      payments: [
        {
          amount: 500,
          method: 'cash',
          paidAt: new Date(),
          recordedBy: dummyUser,
        },
      ],
    });

    // 4. Draft invoice with past dueDate -> should remain draft
    const inv4 = await Invoice.create({
      patient: dummyPatient,
      issuedBy: dummyUser,
      status: 'draft',
      dueDate: pastDate,
      lineItems: [{ description: 'Bed Charge', quantity: 1, unitPrice: 1000 }],
    });

    const modified = await promoteOverdueInvoices();
    expect(modified).toBe(1);

    const updated1 = await Invoice.findById(inv1._id);
    expect(updated1?.status).toBe('overdue');

    const updated2 = await Invoice.findById(inv2._id);
    expect(updated2?.status).toBe('issued');

    const updated3 = await Invoice.findById(inv3._id);
    expect(updated3?.status).toBe('paid');

    const updated4 = await Invoice.findById(inv4._id);
    expect(updated4?.status).toBe('draft');
  });

  it('returns 0 when there are no past-due issued invoices', async () => {
    const dummyPatient = new Types.ObjectId();
    const dummyUser = new Types.ObjectId();

    await Invoice.create({
      patient: dummyPatient,
      issuedBy: dummyUser,
      status: 'issued',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      lineItems: [{ description: 'Consultation', quantity: 1, unitPrice: 300 }],
    });

    const modified = await promoteOverdueInvoices();
    expect(modified).toBe(0);
  });
});
