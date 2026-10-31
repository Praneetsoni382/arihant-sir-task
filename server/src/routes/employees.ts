// ============================================================
// EMPLOYEE ROUTES
// ============================================================

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { userRepo, taskRepo, taskMemberRepo, auditRepo, newId } from '../repositories/inMemoryStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuditEvent } from '../services/notificationService.js';
import { adminAuth } from '../firebase.js';

const router = Router();

const createEmployeeSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  email: z.string().email('Valid email is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().optional().default(''),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const updateEmployeeSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  department: z.string().min(1).optional(),
  designation: z.string().optional(),
});

// GET /api/employees
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { search, department, active } = req.query;
    let employees = userRepo.findAll().filter((u) => u.role === 'employee');

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      employees = employees.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
      );
    }

    if (department && typeof department === 'string') {
      employees = employees.filter((e) => e.department === department);
    }

    if (active !== undefined) {
      const isActive = active === 'true';
      employees = employees.filter((e) => e.active === isActive);
    }

    const safe = employees.map(({ passwordHash: _, ...e }) => e);
    res.json({ success: true, data: safe });
  })
);

// POST /api/employees
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parse = createEmployeeSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const { fullName, employeeId, email, department, designation, password } = parse.data;

    // Check uniqueness
    if (userRepo.findByEmail(email)) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }
    if (userRepo.findByEmployeeId(employeeId)) {
      res.status(409).json({ success: false, error: 'Employee ID already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepo.create({
      employeeId,
      fullName,
      email,
      department,
      designation: designation ?? '',
      role: 'employee',
      active: true,
      passwordHash,
    });

    if (adminAuth) {
      try {
        await adminAuth.createUser({
          uid: user.id,
          email: user.email,
          password: password,
          displayName: user.fullName,
        });
      } catch (authErr) {
        console.warn('Firebase Auth user creation notice:', authErr instanceof Error ? authErr.message : authErr);
      }
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'user',
      entityId: user.id,
      eventType: 'EMPLOYEE_CREATED',
      newState: 'active',
      message: `Employee account created for ${fullName} (${employeeId})`,
    });

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({ success: true, data: safeUser });
  })
);

// GET /api/employees/:id
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = userRepo.findById(req.params.id);
    if (!user || user.role !== 'employee') {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Employees can only view their own profile
    if (req.session.role !== 'admin' && req.session.userId !== req.params.id) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const taskMembers = taskMemberRepo.findByUser(user.id);
    const tasks = taskRepo.findByMember(user.id);

    const { passwordHash: _, ...safeUser } = user;
    res.json({ success: true, data: { ...safeUser, tasks, taskCount: taskMembers.length } });
  })
);

// PATCH /api/employees/:id
router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = userRepo.findById(req.params.id);
    if (!user || user.role !== 'employee') {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const parse = updateEmployeeSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const updated = await userRepo.update(req.params.id, parse.data);
    if (!updated) {
      res.status(500).json({ success: false, error: 'Update failed' });
      return;
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'user',
      entityId: user.id,
      eventType: 'EMPLOYEE_UPDATED',
      message: `Employee profile updated for ${updated.fullName}`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, data: safeUser });
  })
);

// PATCH /api/employees/:id/status
router.patch(
  '/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = userRepo.findById(req.params.id);
    if (!user || user.role !== 'employee') {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const schema = z.object({ active: z.boolean() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid status value' });
      return;
    }

    const updated = await userRepo.update(req.params.id, { active: parse.data.active });
    if (!updated) {
      res.status(500).json({ success: false, error: 'Update failed' });
      return;
    }

    if (adminAuth) {
      try {
        await adminAuth.updateUser(user.id, {
          disabled: !parse.data.active,
        });
      } catch (authErr) {
        console.warn('Firebase Auth user update notice:', authErr instanceof Error ? authErr.message : authErr);
      }
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'user',
      entityId: user.id,
      eventType: 'EMPLOYEE_STATUS_CHANGED',
      previousState: user.active ? 'active' : 'inactive',
      newState: parse.data.active ? 'active' : 'inactive',
      message: `Employee ${updated.fullName} ${parse.data.active ? 'reactivated' : 'deactivated'}`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, data: safeUser });
  })
);

export default router;

