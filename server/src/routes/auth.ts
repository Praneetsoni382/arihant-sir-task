// ============================================================
// AUTH ROUTES
// ============================================================

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { userRepo } from '../repositories/inMemoryStore.js';
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
    const user = userRepo.findByEmail(email);

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
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, error: 'Logout failed' });
      return;
    }
    res.clearCookie('tid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = userRepo.findById(req.session.userId!);
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

