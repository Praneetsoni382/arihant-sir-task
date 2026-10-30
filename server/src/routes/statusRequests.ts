// ============================================================
// STATUS REQUESTS ROUTES
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import {
  statusRequestRepo,
  statusResponseRepo,
  taskRepo,
  taskMemberRepo,
  userRepo,
} from '../repositories/inMemoryStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuditEvent, createNotification, notifTemplates } from '../services/notificationService.js';

const PRESET_QUESTIONS = [
  'What is the current update?',
  'How much progress has been made?',
  'Are you facing any blockers?',
  'Is the task progressing according to the plan?',
  'What remains before completion?',
  'Has the issue been resolved?',
  'Will the task be completed before the deadline?',
];

// Router for /api/status-requests
const router = Router();

// GET /api/status-requests/presets
router.get('/presets', requireAdmin, (_req, res) => {
  res.json({ success: true, data: PRESET_QUESTIONS });
});

// GET /api/status-requests - Admin sees all; Employee sees their own
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.session.role === 'admin';
    let requests = isAdmin
      ? statusRequestRepo.findAll()
      : statusRequestRepo.findByRecipient(req.session.userId!);

    // Enrich with task info and responses
    const enriched = requests.map((sr) => {
      const task = taskRepo.findById(sr.taskId);
      const responses = statusResponseRepo.findByRequest(sr.id);
      const creator = userRepo.findById(sr.createdBy);
      const recipient = userRepo.findById(sr.recipientUserId);
      return {
        ...sr,
        task: task ? { id: task.id, title: task.title, referenceNumber: task.referenceNumber } : null,
        responses,
        creatorName: creator?.fullName ?? 'Unknown',
        recipientName: recipient?.fullName ?? 'Unknown',
      };
    });

    res.json({ success: true, data: enriched });
  })
);

// POST /api/status-requests/:id/respond - Employee responds
router.post(
  '/:id/respond',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sr = statusRequestRepo.findById(req.params.id);
    if (!sr) {
      res.status(404).json({ success: false, error: 'Status request not found' });
      return;
    }

    // Only the intended recipient can respond
    if (req.session.role !== 'admin' && sr.recipientUserId !== req.session.userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const schema = z.object({
      responseText: z.string().min(1, 'Response is required'),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const response = statusResponseRepo.create({
      statusRequestId: sr.id,
      responderUserId: req.session.userId!,
      responseText: parse.data.responseText,
      createdAt: new Date().toISOString(),
    });

    statusRequestRepo.update(sr.id, { status: 'answered' });

    const task = taskRepo.findById(sr.taskId);
    const responder = userRepo.findById(req.session.userId!);
    if (task && responder) {
      const tmpl = notifTemplates.statusResponseReceived(responder.fullName, task.title);
      createNotification({
        recipientUserId: sr.createdBy,
        eventType: 'STATUS_RESPONSE_RECEIVED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: sr.taskId,
        relatedStatusRequestId: sr.id,
      });
    }

    createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'status_request',
      entityId: sr.id,
      eventType: 'STATUS_RESPONSE_GIVEN',
      message: `Status response submitted`,
    });

    res.status(201).json({ success: true, data: response });
  })
);

// Router for task-nested status requests mounted at /api/tasks
export const taskStatusRequestRouter = Router();

// POST /api/tasks/:taskId/status-requests - Admin sends a status request
taskStatusRequestRouter.post(
  '/:taskId/status-requests',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const schema = z.object({
      question: z.string().min(5, 'Question is required'),
      recipientUserIds: z.array(z.string()).min(1, 'At least one recipient required'),
      isPreset: z.boolean().optional().default(false),
      responseDeadline: z.string().nullable().optional(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const { question, recipientUserIds, responseDeadline } = parse.data;
    const now = new Date().toISOString();
    const created = [];

    for (const userId of recipientUserIds) {
      // Verify the user is a task member
      const member = taskMemberRepo.findByTaskAndUser(task.id, userId);
      if (!member) continue;

      const sr = statusRequestRepo.create({
        taskId: task.id,
        createdBy: req.session.userId!,
        recipientUserId: userId,
        question,
        status: 'pending',
        createdAt: now,
        responseDeadline: responseDeadline ?? null,
      });

      const tmpl = notifTemplates.statusRequested(task.title);
      createNotification({
        recipientUserId: userId,
        eventType: 'STATUS_REQUESTED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: task.id,
        relatedStatusRequestId: sr.id,
        navigationUrl: `/tasks/${task.id}`,
      });

      created.push(sr);
    }

    createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'status_request',
      entityId: task.id,
      eventType: 'STATUS_REQUEST_SENT',
      message: `Status request sent to ${recipientUserIds.length} recipient(s)`,
    });

    res.status(201).json({ success: true, data: created });
  })
);

export default router;
