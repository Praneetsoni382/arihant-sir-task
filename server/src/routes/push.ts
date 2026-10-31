// ============================================================
// PUSH NOTIFICATION ROUTES (FCM)
// File: server/src/routes/push.ts
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { deviceRepo, pushPrefRepo, userRepo } from '../repositories/inMemoryStore.js';
import {
  checkTestPushRateLimit,
  sendTestPushToUser,
} from '../services/pushNotificationService.js';
import { firebaseConfig } from '../firebase.js';

const router = Router();

// Validation schema for device registration
const registerDeviceSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required').max(128),
  fcmToken: z.string().min(1, 'FCM registration token is required').max(1024),
  browserName: z.string().max(64).optional(),
  userAgent: z.string().max(512).optional(),
  permissionStatus: z.enum(['default', 'granted', 'denied']).optional(),
});

// Validation schema for device updates
const updateDeviceSchema = z.object({
  permissionStatus: z.enum(['default', 'granted', 'denied']).optional(),
  browserName: z.string().max(64).optional(),
  userAgent: z.string().max(512).optional(),
  isActive: z.boolean().optional(),
});

// Validation schema for push preferences
const updatePreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  categories: z
    .object({
      taskAssignments: z.boolean().optional(),
      statusRequests: z.boolean().optional(),
      queries: z.boolean().optional(),
      reminders: z.boolean().optional(),
      messages: z.boolean().optional(),
      approvals: z.boolean().optional(),
    })
    .optional(),
});

// ============================================================
// PUBLIC/AUTHENTICATED PUSH CONFIG
// ============================================================

// GET /api/push/config — returns public VAPID key and messaging sender ID
router.get('/config', (_req, res) => {
  const vapidKey =
    process.env.VITE_FIREBASE_VAPID_KEY ||
    process.env.FIREBASE_VAPID_KEY ||
    ''; // Can be provided in env or configured via Firebase Console

  res.json({
    success: true,
    data: {
      projectId: firebaseConfig.projectId,
      messagingSenderId: '1088662376372',
      vapidKey,
      isConfigured: Boolean(vapidKey && vapidKey.length > 10),
    },
  });
});

// ============================================================
// DEVICE REGISTRATION ENDPOINTS (PROTECTED)
// ============================================================

// POST /api/push/register — Register current browser device for push notifications
router.post(
  '/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = registerDeviceSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const userId = req.session.userId!;
    const user = userRepo.findById(userId);
    if (!user || !user.active) {
      res.status(403).json({ success: false, error: 'User account is inactive or not found' });
      return;
    }

    const { deviceId, fcmToken, browserName, userAgent, permissionStatus } = parse.data;

    const registeredDevice = deviceRepo.registerDevice({
      deviceId,
      userId,
      fcmToken,
      platform: 'WEB',
      browserName: browserName || 'Web Browser',
      userAgent: userAgent || req.headers['user-agent'] || '',
      permissionStatus: permissionStatus || 'granted',
    });

    console.log(`[FCM Device Registered] User: ${user.email} (${userId}) | Device: ${deviceId}`);

    res.status(201).json({
      success: true,
      data: registeredDevice,
      message: 'Device successfully registered for push notifications',
    });
  })
);

// GET /api/push/devices — List active devices for authenticated user
router.get(
  '/devices',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const devices = deviceRepo.findByUser(userId);
    res.json({
      success: true,
      data: devices,
    });
  })
);

// PATCH /api/push/devices/:deviceId — Update device registration metadata
router.patch(
  '/devices/:deviceId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = updateDeviceSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const userId = req.session.userId!;
    const { deviceId } = req.params;

    const updated = deviceRepo.updateDevice(userId, deviceId, parse.data);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Device registration not found' });
      return;
    }

    res.json({ success: true, data: updated });
  })
);

// DELETE /api/push/devices/:deviceId — Deactivate or unregister device
router.delete(
  '/devices/:deviceId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const { deviceId } = req.params;

    const deactivated = deviceRepo.deactivateDevice(userId, deviceId);
    if (!deactivated) {
      res.status(404).json({ success: false, error: 'Device registration not found' });
      return;
    }

    res.json({ success: true, message: 'Device unregistered successfully' });
  })
);

// ============================================================
// PUSH PREFERENCES
// ============================================================

// GET /api/push/preferences — Get current user's push preferences
router.get(
  '/preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const preferences = pushPrefRepo.getPreferences(userId);
    res.json({ success: true, data: preferences });
  })
);

// PATCH /api/push/preferences — Update user's push preferences
router.patch(
  '/preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = updatePreferencesSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const userId = req.session.userId!;
    const updated = pushPrefRepo.updatePreferences(userId, parse.data);
    res.json({ success: true, data: updated, message: 'Preferences updated successfully' });
  })
);

// ============================================================
// PUSH TEST ENDPOINT (RATE LIMITED)
// ============================================================

// POST /api/push/test — Send test push notification to caller's registered device(s)
router.post(
  '/test',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;

    // Enforce rate limiting to prevent spam
    const rateCheck = checkTestPushRateLimit(userId);
    if (!rateCheck.allowed) {
      res.status(429).json({
        success: false,
        error: `Rate limit reached. Please wait ${rateCheck.retryAfterSeconds} seconds before requesting another test push.`,
      });
      return;
    }

    const result = await sendTestPushToUser(userId);

    res.json({
      success: result.status === 'sent' || result.status === 'simulated',
      data: result,
      message:
        result.status === 'sent' || result.status === 'simulated'
          ? `Test push dispatched to ${result.deviceCount} registered device(s)!`
          : result.error || 'Test push delivery failed',
    });
  })
);

export default router;
