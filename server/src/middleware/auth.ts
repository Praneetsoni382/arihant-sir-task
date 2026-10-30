// ============================================================
// AUTH MIDDLEWARE
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types/index.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!req.session.role || !roles.includes(req.session.role as UserRole)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.session.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
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

