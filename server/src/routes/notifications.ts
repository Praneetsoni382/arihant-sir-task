// ============================================================
// NOTIFICATION ROUTES
// ============================================================

import { Router } from 'express';
import { notificationRepo } from '../repositories/inMemoryStore.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/notifications
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notifications = notificationRepo.findByRecipient(req.session.userId!);
    const unreadCount = notifications.filter((n) => !n.readAt).length;
    res.json({ success: true, data: { notifications, unreadCount } });
  })
);

// PATCH /api/notifications/:id/read
router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notif = notificationRepo.findById(req.params.id);
    if (!notif) {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }

    if (notif.recipientUserId !== req.session.userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const updated = await notificationRepo.update(req.params.id, {
      readAt: new Date().toISOString(),
      deliveryState: 'read',
    });

    res.json({ success: true, data: updated });
  })
);

// POST /api/notifications/read-all
router.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await notificationRepo.markAllRead(req.session.userId!);
    res.json({ success: true, message: 'All notifications marked as read' });
  })
);

export default router;

