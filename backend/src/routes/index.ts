import { Router } from 'express';
import { authRouter } from '../modules/auth/router';
import { staffRouter } from '../modules/staff/router';
import { patientRouter } from '../modules/patients/router';
import { appointmentRouter } from '../modules/appointments/router';
import { billingRouter } from '../modules/billing/router';
import { analyticsRouter } from '../modules/analytics/router';

// Surplus modules unmounted for Task 2.1 scope trimming (retained 4 core modules only):
// import { labRouter } from '../modules/lab/router';
// import { pharmacyRouter } from '../modules/pharmacy/router';
// import { inventoryRouter } from '../modules/inventory/router';
// import { documentsRouter } from '../modules/documents/router';
// import { settingsRouter } from '../modules/settings/router';

const router = Router();
router.use('/auth', authRouter);
router.use('/', staffRouter);
router.use('/', patientRouter);
router.use('/appointments', appointmentRouter);
router.use('/billing', billingRouter);
router.use('/analytics', analyticsRouter);

// Unmounted in Task 2.1:
// router.use('/lab', labRouter);
// router.use('/pharmacy', pharmacyRouter);
// router.use('/inventory', inventoryRouter);
// router.use('/documents', documentsRouter);
// router.use('/settings', settingsRouter);

export { router };
