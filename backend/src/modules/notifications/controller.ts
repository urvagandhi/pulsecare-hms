import { Request, Response } from 'express';
import { Notification } from '../../models/Notification';
import { emitToUser } from '../../socket';

const INITIAL_DEMO_NOTIFICATIONS = [
  {
    title: 'Consultation Reserved',
    message: 'Patient Aarav Sharma confirmed appointment #07 for Cardiology.',
    type: 'appointment' as const,
    read: false,
  },
  {
    title: 'Low Pharmacy Stock Alert',
    message: 'Amoxicillin 500mg oral suspension is running below threshold (12 units).',
    type: 'inventory' as const,
    read: false,
  },
  {
    title: 'Invoice Settled',
    message: 'Invoice #INV-2026-003 for Liam Johnson ($242.00) settled via Card.',
    type: 'billing' as const,
    read: false,
  },
];

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;

  let items = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean();

  // If user has no notifications yet, initialize with sample alerts
  if (items.length === 0) {
    await Notification.insertMany(
      INITIAL_DEMO_NOTIFICATIONS.map((n) => ({
        ...n,
        user: userId as any,
      }))
    );
    items = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean();
  }

  res.json({
    success: true,
    data: items,
  });
}

export async function markAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const { id } = req.params;

  const item = await Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  );

  if (item) {
    emitToUser(userId, 'notification:updated', { id, read: true });
  }

  res.json({
    success: true,
    data: item,
  });
}

export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;

  await Notification.updateMany(
    { user: userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );

  emitToUser(userId, 'notification:all-read', {});

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
}

export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const { id } = req.params;

  await Notification.findOneAndDelete({ _id: id, user: userId });

  emitToUser(userId, 'notification:deleted', { id });

  res.json({
    success: true,
    message: 'Notification deleted',
  });
}

export async function clearAll(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;

  await Notification.deleteMany({ user: userId });

  emitToUser(userId, 'notification:cleared', {});

  res.json({
    success: true,
    message: 'All notifications cleared',
  });
}
