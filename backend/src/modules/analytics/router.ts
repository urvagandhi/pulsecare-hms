import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as AnalyticsController from './controller';

const router = Router();

router.get('/appointments', authenticate, authorize('analytics', 'read'), AnalyticsController.getAppointmentAnalytics);
router.get('/revenue', authenticate, authorize('analytics', 'read'), AnalyticsController.getRevenueAnalytics);

// Unmounted in Task 2.1 scope trimming:
// router.get('/lab', authenticate, authorize('analytics', 'read'), AnalyticsController.getLabAnalytics);
// router.get('/prescriptions', authenticate, authorize('analytics', 'read'), AnalyticsController.getPrescriptionAnalytics);

export { router as analyticsRouter };
