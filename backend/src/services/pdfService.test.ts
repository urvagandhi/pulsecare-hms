import { generateDocumentPdf, generatePatientIdCardPdf, generateAppointmentSlipPdf, generateInvoicePdf } from './pdfService';
import { sendDocumentEmail } from './emailService';
import nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('PDF and Email Services Unit Tests', () => {
  describe('generateDocumentPdf', () => {
    it('generates a valid PDF buffer for a medical certificate', async () => {
      const mockDoc = {
        type: 'medical_certificate',
        documentId: 'DOC-0001',
        patientId: 'PAT-0001',
        issuedBy: 'DOC-0001',
        templateData: { diagnosis: 'Viral Fever', duration: '3 days' },
        createdAt: new Date('2026-10-10'),
        notes: 'Patient requires 3 days bed rest due to viral fever.',
        fileUrl: '',
      } as any;

      const buffer = await generateDocumentPdf(mockDoc);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('generates a valid PDF buffer without optional notes', async () => {
      const mockDoc = {
        type: 'discharge_summary',
        documentId: 'DOC-0002',
        patientId: 'PAT-0002',
        issuedBy: 'DOC-0002',
        createdAt: new Date('2026-10-11'),
      } as any;

      const buffer = await generateDocumentPdf(mockDoc);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('generatePatientIdCardPdf', () => {
    it('generates a printable patient ID card PDF', async () => {
      const patient = {
        patientId: 'PAT-0001',
        bloodGroup: 'B+',
        userId: {
          firstName: 'Aarav',
          lastName: 'Sharma',
          email: 'aarav.sharma@test.com',
          phone: '+91 9876543210',
          dob: new Date('1990-05-15'),
          gender: 'male',
        },
        emergencyContact: {
          name: 'Sunita Sharma',
          relationship: 'Spouse',
          phone: '+91 9876543211',
        },
      } as any;

      const buffer = await generatePatientIdCardPdf(patient);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('generates patient ID card with minimal details', async () => {
      const patient = {
        patientId: 'PAT-0002',
        userId: {
          firstName: 'Ananya',
          lastName: 'Iyer',
        },
      } as any;

      const buffer = await generatePatientIdCardPdf(patient);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('generateAppointmentSlipPdf', () => {
    it('generates appointment slip with token and full details', async () => {
      const appointment = {
        appointmentId: 'APT-0001',
        tokenNumber: 4,
        date: new Date('2026-10-25T00:00:00.000Z'),
        timeSlot: '10:30',
        type: 'consultation',
        status: 'confirmed',
        reason: 'Regular BP follow-up',
        patient: {
          patientId: 'PAT-0001',
          userId: {
            firstName: 'Aarav',
            lastName: 'Sharma',
            phone: '9876543210',
          },
        },
        doctor: {
          doctorId: 'DOC-0001',
          specialization: 'Cardiology',
          userId: {
            firstName: 'Vikram',
            lastName: 'Sharma',
          },
        },
        department: {
          name: 'Cardiology Department',
          location: 'Building A, Floor 2',
        },
      } as any;

      const buffer = await generateAppointmentSlipPdf(appointment);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('generates appointment slip with minimal details and fallback fields', async () => {
      const appointment = {
        appointmentId: 'APT-0002',
        date: '2026-10-25',
        timeSlot: '11:00',
        patient: {},
        doctor: {},
      } as any;

      const buffer = await generateAppointmentSlipPdf(appointment);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('generateInvoicePdf', () => {
    it('generates tax invoice PDF with line items and payments', async () => {
      const invoice = {
        invoiceId: 'INV-0001',
        status: 'partial',
        createdAt: new Date('2026-10-15'),
        dueDate: new Date('2026-10-30'),
        subtotal: 1000,
        taxRate: 5,
        taxAmount: 50,
        discount: 50,
        totalAmount: 1000,
        paidAmount: 500,
        balance: 500,
        lineItems: [
          { description: 'General Consultation', category: 'consultation', quantity: 1, unitPrice: 500, total: 500 },
          { description: 'ECG Procedure', category: 'procedure', quantity: 1, unitPrice: 500, total: 500 },
        ],
        payments: [
          { amount: 500, method: 'cash', paidAt: new Date('2026-10-16'), transactionId: 'TXN-123' },
        ],
        patient: {
          patientId: 'PAT-0001',
          userId: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            phone: '9876543210',
          },
        },
      } as any;

      const buffer = await generateInvoicePdf(invoice);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('generates invoice PDF with minimal / empty payments', async () => {
      const invoice = {
        invoiceId: 'INV-0002',
        status: 'draft',
        totalAmount: 300,
        paidAmount: 0,
        balance: 300,
        lineItems: [
          { description: 'Consultation', quantity: 1, unitPrice: 300, total: 300 },
        ],
        patient: {
          userId: { firstName: 'Alice' },
        },
      } as any;

      const buffer = await generateInvoicePdf(invoice);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('sendDocumentEmail', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('returns gracefully without sending when email env vars are missing', async () => {
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;

      await expect(
        sendDocumentEmail('test@patient.com', 'medical_certificate', 'Jane Doe', Buffer.from('pdf'))
      ).resolves.not.toThrow();
    });

    it('sends email when env vars are provided', async () => {
      process.env.EMAIL_HOST = 'smtp.test.com';
      process.env.EMAIL_PORT = '587';
      process.env.EMAIL_USER = 'sender@test.com';
      process.env.EMAIL_PASS = 'secretpass';

      const sendMailMock = jest.fn().mockResolvedValue({ messageId: '123' });
      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        sendMail: sendMailMock,
      });

      await sendDocumentEmail('test@patient.com', 'medical_certificate', 'Jane Doe', Buffer.from('pdf'));
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@patient.com',
          from: 'sender@test.com',
        })
      );
    });
  });
});
