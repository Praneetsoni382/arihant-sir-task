// ============================================================
// CHAT ROUTES
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import {
  chatMessageRepo,
  taskRepo,
  taskMemberRepo,
  userRepo,
} from '../repositories/inMemoryStore.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuditEvent } from '../services/notificationService.js';

const router = Router();

// GET /api/tasks/:taskId/messages
router.get(
  '/:taskId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Authorization: must be a task member or admin
    if (req.session.role !== 'admin') {
      const member = taskMemberRepo.findByTaskAndUser(task.id, req.session.userId!);
      if (!member) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
    }

    const messages = chatMessageRepo.findByTask(task.id).map((m) => {
      const sender = userRepo.findById(m.senderUserId);
      return {
        ...m,
        senderName: sender?.fullName ?? 'Unknown',
        senderRole: sender?.role ?? 'employee',
      };
    });

    res.json({ success: true, data: messages });
  })
);

// POST /api/tasks/:taskId/messages
router.post(
  '/:taskId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    if (task.status === 'cancelled') {
      res.status(400).json({ success: false, error: 'Cannot post to cancelled task chat' });
      return;
    }

    // Authorization: must be a task member or admin
    if (req.session.role !== 'admin') {
      const member = taskMemberRepo.findByTaskAndUser(task.id, req.session.userId!);
      if (!member) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
    }

    const schema = z.object({ message: z.string().min(1, 'Message cannot be empty') });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const cm = chatMessageRepo.create({
      taskId: task.id,
      senderUserId: req.session.userId!,
      message: parse.data.message,
      createdAt: new Date().toISOString(),
    });

    const sender = userRepo.findById(req.session.userId!);

    createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'chat',
      entityId: task.id,
      eventType: 'CHAT_MESSAGE_SENT',
      message: `${sender?.fullName ?? 'Unknown'} sent a message in task chat`,
    });

    res.status(201).json({
      success: true,
      data: {
        ...cm,
        senderName: sender?.fullName ?? 'Unknown',
        senderRole: sender?.role ?? 'employee',
      },
    });
  })
);

export default router;

