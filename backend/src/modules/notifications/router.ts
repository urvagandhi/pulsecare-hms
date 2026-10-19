import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as NotificationController from './controller';

const router = Router();

router.use(authenticate);

router.get('/', NotificationController.listNotifications);
router.patch('/read-all', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);
router.delete('/:id', NotificationController.deleteNotification);
router.delete('/', NotificationController.clearAll);

export { router as notificationRouter };
