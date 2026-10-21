import { Types } from 'mongoose';
import { z } from 'zod';
import { Invoice } from '../../models/Invoice';
import { Patient } from '../../models/Patient';
import { Appointment } from '../../models/Appointment';
import { Doctor } from '../../models/Doctor';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { CreateInvoiceSchema, RecordPaymentSchema, VoidInvoiceSchema, ListInvoicesQuerySchema } from './schema';

export { calculateInvoiceTotals, LineItemCategory, InvoiceTotalsResult } from './calculator';

type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
type VoidInvoiceInput = z.infer<typeof VoidInvoiceSchema>;
type ListInvoicesQuery = z.infer<typeof ListInvoicesQuerySchema>;

export async function createInvoice(input: CreateInvoiceInput, issuedByUserId: string) {
  let patient = null;
  if (Types.ObjectId.isValid(input.patientId)) {
    patient = await Patient.findById(input.patientId);
    if (!patient) {
      patient = await Patient.findOne({ userId: new Types.ObjectId(input.patientId) });
    }
  }
  if (!patient) {
    patient = await Patient.findOne({ patientId: input.patientId });
  }
  if (!patient) throw new NotFoundError('Patient');

  let finalLineItems = input.lineItems && input.lineItems.length > 0 ? [...input.lineItems] : [];

  // Auto-populate doctor consultation fee if lineItems is empty and appointmentId is provided (FR-E1-2)
  if (finalLineItems.length === 0 && input.appointmentId) {
    const appointment = await Appointment.findById(input.appointmentId);
    if (appointment) {
      const doctor = await Doctor.findById(appointment.doctor);
      const fee = doctor?.consultationFee ?? 500;
      finalLineItems.push({
        description: `Consultation Fee - ${appointment.type || 'General Consultation'}`,
        quantity: 1,
        unitPrice: fee,
        category: 'consultation',
      });
    }
  }

  if (finalLineItems.length === 0) {
    throw new ValidationError('Invoice must have at least one line item');
  }

  const invoice = await Invoice.create({
    patient: patient._id,
    appointment: input.appointmentId && Types.ObjectId.isValid(input.appointmentId) ? new Types.ObjectId(input.appointmentId) : undefined,
    lineItems: finalLineItems,
    taxRate: input.taxRate,
    discount: input.discount,
    insurance: input.insurance,
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    notes: input.notes,
    status: 'draft',
    issuedBy: new Types.ObjectId(issuedByUserId),
  });

  return invoice;
}

export async function processOnlinePayment(
  invoiceId: string,
  input: { amount?: number; method?: 'card' | 'transfer'; gateway?: string },
  requestingUserId: string,
  requestingRole: string
) {
  const invoice = await Invoice.findById(invoiceId).populate('patient');
  if (!invoice) throw new NotFoundError('Invoice');

  if (requestingRole === 'patient') {
    const patientUserId = (invoice.patient as any)?.userId?.toString() ?? invoice.patient?.toString();
    if (patientUserId !== requestingUserId) {
      throw new ForbiddenError('You can only pay your own invoices');
    }
  }

  if (invoice.status === 'draft' || invoice.status === 'void' || invoice.status === 'paid') {
    throw new ValidationError(`Cannot pay an invoice in '${invoice.status}' status`);
  }

  const payAmount = input.amount && input.amount > 0 ? Math.min(input.amount, invoice.balance) : invoice.balance;
  if (payAmount <= 0) {
    throw new ValidationError('Invoice has zero remaining balance');
  }

  const gatewayRef = `RAZORPAY_PAY_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  invoice.payments.push({
    amount: payAmount,
    method: input.method === 'transfer' ? 'transfer' : 'card',
    paidAt: new Date(),
    reference: gatewayRef,
    recordedBy: new Types.ObjectId(requestingUserId),
  });

  await invoice.save();
  return { invoice, paymentReference: gatewayRef, status: 'success' };
}

export async function issueInvoice(invoiceId: string) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  if (invoice.status !== 'draft') {
    throw new ValidationError('Invoice must be in draft status to be issued');
  }

  invoice.status = 'issued';
  invoice.issuedDate = new Date();

  await invoice.save();
  return invoice;
}

export async function recordPayment(
  invoiceId: string,
  input: RecordPaymentInput,
  recordedByUserId: string
) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  if (invoice.status === 'draft' || invoice.status === 'void') {
    throw new ValidationError(`Cannot record payment on a ${invoice.status} invoice`);
  }

  invoice.payments.push({
    amount: input.amount,
    method: input.method,
    paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
    reference: input.reference,
    recordedBy: new Types.ObjectId(recordedByUserId),
  });

  await invoice.save();
  return invoice;
}

export async function voidInvoice(
  invoiceId: string,
  input: VoidInvoiceInput,
  requestingUserId: string
) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  if (invoice.status === 'paid') {
    throw new ValidationError('Cannot void a paid invoice');
  }

  invoice.status = 'void';
  invoice.voidedBy = new Types.ObjectId(requestingUserId);
  invoice.voidReason = input.voidReason;

  await invoice.save();
  return invoice;
}

export async function listInvoices(
  filters: ListInvoicesQuery,
  requestingUserId: string,
  requestingRole: string,
  ownOnly?: boolean
) {
  const { page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;
  const query: Record<string, unknown> = {};

  if (ownOnly) {
    const patientProfile = await Patient.findOne({ userId: requestingUserId }).lean();
    if (!patientProfile) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }
    query.patient = (patientProfile._id as Types.ObjectId);
  } else if (filters.patientId) {
    if (Types.ObjectId.isValid(filters.patientId)) {
      query.patient = new Types.ObjectId(filters.patientId);
    } else {
      const p = await Patient.findOne({ patientId: filters.patientId }).lean();
      if (p) {
        query.patient = p._id;
      } else {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
    }
  }

  if (filters.status) {
    const rawStatuses = filters.status.split(',').map(s => s.trim()).filter(Boolean);
    const expandedStatuses: string[] = [];
    for (const s of rawStatuses) {
      if (s === 'unpaid') {
        expandedStatuses.push('draft', 'issued', 'partial', 'overdue');
      } else {
        expandedStatuses.push(s);
      }
    }
    const uniqueStatuses = Array.from(new Set(expandedStatuses));
    query.status = uniqueStatuses.length === 1 ? uniqueStatuses[0] : { $in: uniqueStatuses };
  }

  const [data, total] = await Promise.all([
    Invoice.find(query)
      .populate({ path: 'patient', populate: { path: 'userId', select: '-password' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(query),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getInvoiceById(
  invoiceId: string,
  requestingUserId: string,
  requestingRole: string,
  ownOnly?: boolean
) {
  const invoice = await Invoice.findById(invoiceId)
    .populate({ path: 'patient', populate: { path: 'userId', select: '-password' } })
    .populate('appointment');

  if (!invoice) throw new NotFoundError('Invoice');

  if (ownOnly) {
    const patientDoc = invoice.patient as any;
    const patientUserId = patientDoc?.userId?._id?.toString() || patientDoc?.userId?.toString();
    if (!patientUserId || patientUserId !== requestingUserId) {
      throw new ForbiddenError('You can only view your own invoices');
    }
  }

  return invoice;
}

export async function removeLineItem(
  invoiceId: string,
  itemIndex: number
) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  if (invoice.status !== 'draft') {
    throw new ConflictError('Only draft invoices can be modified');
  }

  if (invoice.lineItems.length <= 1) {
    throw new ValidationError('Cannot remove the last remaining line item from an invoice');
  }

  if (
    !Number.isInteger(itemIndex) ||
    itemIndex < 0 ||
    itemIndex >= invoice.lineItems.length
  ) {
    throw new ValidationError('Invalid item index');
  }

  invoice.lineItems.splice(itemIndex, 1);
  await invoice.save();
  return invoice;
}
