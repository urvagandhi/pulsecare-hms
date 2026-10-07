export type LineItemCategory = 'consultation' | 'doctor_charge' | 'medicine' | 'procedure' | 'other';

export interface LineItemInput {
  description?: string;
  quantity: number;
  unitPrice: number;
  category?: LineItemCategory;
  [key: string]: any;
}

export interface CalculatedLineItem extends LineItemInput {
  total: number;
}

export interface InvoiceTotalsResult {
  lineItems: CalculatedLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  balance: number;
  amountPaid: number;
}

/**
 * Pure function to calculate itemized invoice totals, tax, and balance.
 * Reproduces existing Invoice model calculation behavior exactly.
 *
 * @param lineItems - List of line items with quantity and unitPrice
 * @param taxRate - Tax percentage (e.g. 10 for 10%)
 * @param discount - Absolute discount amount
 * @param amountPaid - Sum of payments recorded on the invoice
 */
export function calculateInvoiceTotals(
  lineItems: LineItemInput[],
  taxRate: number = 0,
  discount: number = 0,
  amountPaid: number = 0
): InvoiceTotalsResult {
  if (discount < 0) {
    throw new Error('Discount cannot be negative');
  }

  // 1. Compute each lineItem.total
  const computedLineItems: CalculatedLineItem[] = (lineItems || []).map((item) => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }));

  // 2. Compute subtotal
  const subtotal = Math.round(computedLineItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;

  // 3. Compute tax rounded to 2 decimal places
  const tax = Math.round((subtotal * (taxRate || 0) / 100) * 100) / 100;

  // 4. Compute total
  const total = Math.round((subtotal + tax - (discount || 0)) * 100) / 100;
  if (total < 0) {
    throw new Error('Discount cannot exceed subtotal + tax');
  }

  // 5. Compute balance
  const balance = Math.round((total - (amountPaid || 0)) * 100) / 100;

  return {
    lineItems: computedLineItems,
    subtotal,
    tax,
    total,
    balance,
    amountPaid,
  };
}
