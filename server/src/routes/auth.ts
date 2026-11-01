// ============================================================
// AUTH ROUTES
// ============================================================

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { userRepo, deviceRepo } from '../repositories/inMemoryStore.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const { email, password } = parse.data;
    let user = userRepo.findByEmail(email);
    if (!user) {
      user = await userRepo.fetchFromCloudByEmail(email);
    }

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ success: false, error: 'Account is deactivated' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.fullName = user.fullName;

    const token = Buffer.from(
      JSON.stringify({
        uid: user.id,
        role: user.role,
        exp: Date.now() + 8 * 60 * 60 * 1000,
      })
    ).toString('base64');

    req.session.save((err) => {
      if (err) {
        res.status(500).json({ success: false, error: 'Failed to establish session' });
        return;
      }
      const { passwordHash: _, ...safeUser } = user;
      res.json({ success: true, data: safeUser, token });
    });
  })
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const currentUserId = req.session?.userId;
  const deviceId = req.body?.deviceId;

  if (deviceId) {
    if (currentUserId) {
      deviceRepo.deactivateDevice(currentUserId, deviceId);
    } else {
      const dev = deviceRepo.findByDeviceId(deviceId);
      if (dev) {
        deviceRepo.deactivateDevice(dev.userId, deviceId);
      }
    }
  }

  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, error: 'Logout failed' });
      return;
    }
    res.clearCookie('tid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

import { adminAuth } from '../firebase.js';
import { createAuditEvent } from '../services/notificationService.js';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = changePasswordSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const { currentPassword, newPassword } = parse.data;
    const user = userRepo.findById(req.session.userId!);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await userRepo.update(user.id, {
      passwordHash: newHash,
      currentPasswordPlain: newPassword,
    });

    if (adminAuth) {
      try {
        await adminAuth.updateUser(user.id, {
          password: newPassword,
        });
      } catch (authErr) {
        console.warn('Firebase Auth password update notice:', authErr instanceof Error ? authErr.message : authErr);
      }
    }

    await createAuditEvent({
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      eventType: 'EMPLOYEE_UPDATED',
      message: `Password changed for user ${user.fullName} (${user.email})`,
    });

    res.json({ success: true, message: 'Password updated successfully' });
  })
);

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    let user = userRepo.findById(req.session.userId!);
    if (!user) {
      user = await userRepo.fetchFromCloudById(req.session.userId!);
    }
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    if (!user.active) {
      req.session.destroy(() => {});
      res.status(403).json({ success: false, error: 'Account is deactivated' });
      return;
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json({ success: true, data: safeUser });
  })
);

export default router;

