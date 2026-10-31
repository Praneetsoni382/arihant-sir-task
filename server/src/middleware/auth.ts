// ============================================================
// AUTH MIDDLEWARE
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types/index.js';
import { adminAuth } from '../firebase.js';
import { userRepo } from '../repositories/inMemoryStore.js';

async function resolveUserFromAuthHeader(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.split('Bearer ')[1].trim();
    if (!rawToken) return false;

    // 1. Check application token
    try {
      const parsed = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf8'));
      if (parsed && parsed.uid && (!parsed.exp || parsed.exp > Date.now())) {
        const user = userRepo.findById(parsed.uid);
        if (user && user.active) {
          req.session.userId = user.id;
          req.session.role = user.role;
          req.session.fullName = user.fullName;
          return true;
        }
      }
    } catch {
      // Not base64 json token, fall through to Firebase
    }

    // 2. Check Firebase Admin ID token
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(rawToken);
        const user = userRepo.findById(decoded.uid) || (decoded.email ? userRepo.findByEmail(decoded.email) : undefined);
        if (user && user.active) {
          req.session.userId = user.id;
          req.session.role = user.role;
          req.session.fullName = user.fullName;
          return true;
        }
      } catch (err) {
        // Fall back to session check
      }
    }
  }
  return false;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    const resolved = await resolveUserFromAuthHeader(req);
    if (!resolved && !req.session.userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
  }

  const user = userRepo.findById(req.session.userId!);
  if (!user || !user.active) {
    res.status(403).json({ success: false, error: 'Account is deactivated or not found' });
    return;
  }

  // Ensure authoritative role
  req.session.role = user.role;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session.userId) {
      await resolveUserFromAuthHeader(req);
    }
    if (!req.session.userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const user = userRepo.findById(req.session.userId!);
    if (!user || !user.active) {
      res.status(403).json({ success: false, error: 'Account is deactivated' });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    req.session.role = user.role;
    next();
  };
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    await resolveUserFromAuthHeader(req);
  }
  if (!req.session.userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  const user = userRepo.findById(req.session.userId!);
  if (!user || !user.active || user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  req.session.role = user.role;
  next();
}

// Extend Express session
declare module 'express-session' {
  interface SessionData {
    userId: string;
    role: string;
    fullName: string;
  }
}

