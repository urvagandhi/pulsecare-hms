import { Schema, model, Types } from 'mongoose';
import { nextSequence, getHighestSuffix } from './Counter';
import { calculateInvoiceTotals, LineItemCategory } from '../modules/billing/calculator';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'overdue' | 'void';
export type { LineItemCategory };

export interface ILineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  readonly total: number; // computed: quantity * unitPrice
  category?: LineItemCategory;
}

export interface IInsurance {
  provider: string;
  policyNumber: string;
  coverageAmount: number;
}

export interface IPayment {
  _id?: Types.ObjectId;
  amount: number;
  method: 'cash' | 'card' | 'insurance' | 'transfer';
  paidAt: Date;
  reference?: string;
  recordedBy: Types.ObjectId; // ref User
}

export interface IInvoice {
  _id: Types.ObjectId;
  invoiceId: string; // INV-XXXX
  patient: Types.ObjectId;       // ref Patient
  appointment?: Types.ObjectId;  // ref Appointment
  lineItems: ILineItem[];
  readonly subtotal: number;  // sum of lineItem.total (computed pre-save)
  taxRate: number;   // percentage, e.g. 10 = 10%, default 0
  readonly tax: number;       // taxRate% of subtotal (computed pre-save)
  discount: number;  // absolute amount, default 0
  readonly total: number;     // subtotal + tax - discount (computed pre-save)
  readonly amountPaid: number; // sum of payment amounts, default 0
  readonly balance: number;   // total - amountPaid (computed pre-save)
  status: InvoiceStatus;
  insurance?: IInsurance;
  payments: IPayment[];
  issuedDate?: Date;
  dueDate?: Date;
  paidDate?: Date;
  notes?: string;
  issuedBy: Types.ObjectId;  // ref User, required
  voidedBy?: Types.ObjectId; // ref User
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema<ILineItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: [0.001, 'Quantity must be positive'] },
    unitPrice: { type: Number, required: true, min: [0, 'Unit price cannot be negative'] },
    total: { type: Number, default: 0 },
    category: {
      type: String,
      enum: ['consultation', 'doctor_charge', 'medicine', 'procedure', 'other'],
      default: 'other',
    },
  },
  { _id: false }
);

const InsuranceSchema = new Schema<IInsurance>(
  {
    provider: { type: String, required: true },
    policyNumber: { type: String, required: true },
    coverageAmount: { type: Number, required: true, min: [0, 'Coverage amount cannot be negative'] },
  },
  { _id: false }
);

const PaymentSchema = new Schema<IPayment>(
  {
    amount: { type: Number, required: true, min: [0.01, 'Payment amount must be positive'] },
    method: { type: String, enum: ['cash', 'card', 'insurance', 'transfer'], required: true },
    paidAt: { type: Date, required: true },
    reference: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceId: { type: String, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    lineItems: {
      type: [LineItemSchema],
      required: true,
      validate: {
        validator: (v: ILineItem[]) => v && v.length >= 1,
        message: 'Invoice must have at least one line item',
      },
    },
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0, min: [0, 'Tax rate cannot be negative'], max: [100, 'Tax rate cannot exceed 100%'] },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'issued', 'paid', 'partial', 'overdue', 'void'],
      default: 'draft',
      index: true,
    },
    insurance: { type: InsuranceSchema },
    payments: { type: [PaymentSchema], default: [] },
    issuedDate: { type: Date },
    dueDate: { type: Date },
    paidDate: { type: Date },
    notes: { type: String },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String },
  },
  { timestamps: true }
);

// Compound index for common query pattern
InvoiceSchema.index({ patient: 1, status: 1 });

// Pre-save hook: compute all derived fields and auto-generate invoiceId
InvoiceSchema.pre('save', async function (next) {
  // Use a writable alias so readonly interface fields can be set by the model internals.
  // External callers still see them as readonly via the IInvoice interface.
  const doc = this as typeof this & {
    subtotal: number; tax: number; total: number; amountPaid: number; balance: number;
  };

  // Compute amountPaid from payments
  doc.amountPaid = this.payments.reduce((sum, p) => sum + p.amount, 0);

  // Recalculate totals via central calculateInvoiceTotals
  const totals = calculateInvoiceTotals(this.lineItems, this.taxRate, this.discount, doc.amountPaid);

  for (let i = 0; i < this.lineItems.length; i++) {
    (this.lineItems[i] as { total: number }).total = totals.lineItems[i].total;
  }
  doc.subtotal = totals.subtotal;
  doc.tax = totals.tax;
  doc.total = totals.total;
  doc.balance = totals.balance;

  // Auto-generate invoiceId if not set using atomic counter
  if (!this.invoiceId) {
    const seq = await nextSequence('invoice', () => getHighestSuffix(Invoice, 'invoiceId', 'INV-'));
    this.invoiceId = `INV-${String(seq).padStart(4, '0')}`;
  }

  // 8. Auto-update status (only if not 'draft' or 'void')
  if (this.status !== 'draft' && this.status !== 'void') {
    if (this.balance <= 0) {
      this.status = 'paid';
      if (!this.paidDate) {
        this.paidDate = new Date();
      }
    } else if (this.amountPaid > 0) {
      this.status = 'partial';
    } else if (this.issuedDate && this.dueDate && new Date() > this.dueDate) {
      // NOTE: overdue promotion only fires during an explicit .save(). A scheduled job must
      // periodically re-save issued invoices past their dueDate to promote them to 'overdue'.
      this.status = 'overdue';
    } else {
      this.status = 'issued';
    }
  }

  next();
});

InvoiceSchema.pre('validate', function (next) {
  if (this.status === 'void' && !this.voidReason) {
    return next(new Error('voidReason is required when voiding an invoice'));
  }
  next();
});

export const Invoice = model<IInvoice>('Invoice', InvoiceSchema);
