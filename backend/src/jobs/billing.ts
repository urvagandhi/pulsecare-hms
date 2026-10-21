import cron from 'node-cron';
import { Invoice } from '../models/Invoice';
import { logger } from '../middleware/requestLogger';

export async function promoteOverdueInvoices(): Promise<number> {
  const now = new Date();
  const result = await Invoice.updateMany(
    { status: 'issued', dueDate: { $lt: now } },
    { $set: { status: 'overdue' } }
  );
  return result.modifiedCount;
}

export function startBillingJobs() {
  // Run daily at midnight — promote past-due issued invoices to overdue
  cron.schedule('0 0 * * *', async () => {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const count = await promoteOverdueInvoices();
      if (count > 0) {
        logger.info(`Auto-promoted ${count} past-due invoices to overdue status`);
      }
    } catch (err) {
      logger.error('Error promoting overdue invoices:', err);
    }
  });
}
