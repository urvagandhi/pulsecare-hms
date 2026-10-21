import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as BillingController from './controller';

const router = Router();

// Create invoice
router.post('/', authenticate, authorize('billing', 'write'), BillingController.createInvoice);

// List invoices
router.get('/', authenticate, authorize('billing', 'read'), BillingController.listInvoices);

// Download invoice PDF
router.get('/:id/pdf', authenticate, authorize('billing', 'read'), BillingController.getInvoicePdf);

// Get single invoice
router.get('/:id', authenticate, authorize('billing', 'read'), BillingController.getInvoice);

// Issue invoice
router.patch('/:id/issue', authenticate, authorize('billing', 'issue'), BillingController.issueInvoice);

// Record payment (offline/staff)
router.post('/:id/payments', authenticate, authorize('billing', 'write'), BillingController.recordPayment);
router.post('/:id/pay', authenticate, authorize('billing', 'write'), BillingController.recordPayment);

// Online payment checkout (patients/staff online gateway)
router.post('/:id/pay-online', authenticate, BillingController.payOnline);
router.post('/:id/checkout', authenticate, BillingController.payOnline);

// Remove item from draft invoice
router.delete('/:id/items/:itemIndex', authenticate, authorize('billing', 'write'), BillingController.removeLineItem);

// Void invoice
router.patch('/:id/void', authenticate, authorize('billing', 'void'), BillingController.voidInvoice);

export { router as billingRouter };
