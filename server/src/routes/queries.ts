// ============================================================
// QUERY ROUTES
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import {
  queryRepo,
  queryMessageRepo,
  taskRepo,
  taskMemberRepo,
  userRepo,
} from '../repositories/inMemoryStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuditEvent, createNotification, notifTemplates } from '../services/notificationService.js';

function enrichQuery(queryId: string) {
  const query = queryRepo.findById(queryId);
  if (!query) return null;
  const task = taskRepo.findById(query.taskId);
  const creator = userRepo.findById(query.createdBy);
  const messages = queryMessageRepo.findByQuery(queryId).map((m) => {
    const sender = userRepo.findById(m.senderUserId);
    return { ...m, senderName: sender?.fullName ?? 'Unknown', senderRole: sender?.role };
  });
  return {
    ...query,
    task: task ? { id: task.id, title: task.title, referenceNumber: task.referenceNumber } : null,
    creatorName: creator?.fullName ?? 'Unknown',
    messages,
  };
}

// Router for /api/queries
const router = Router();

// GET /api/queries
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status, category, search } = req.query;
    const isAdmin = req.session.role === 'admin';

    let queries = isAdmin
      ? queryRepo.findAll()
      : queryRepo.findByUser(req.session.userId!);

    if (status && typeof status === 'string') {
      queries = queries.filter((q) => q.status === status);
    }
    if (category && typeof category === 'string') {
      queries = queries.filter((q) => q.category === category);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      queries = queries.filter(
        (query) =>
          query.title.toLowerCase().includes(q) ||
          query.description.toLowerCase().includes(q)
      );
    }

    const enriched = queries
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((q) => enrichQuery(q.id))
      .filter(Boolean);

    res.json({ success: true, data: enriched });
  })
);

// GET /api/queries/:id
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = queryRepo.findById(req.params.id);
    if (!query) {
      res.status(404).json({ success: false, error: 'Query not found' });
      return;
    }

    if (req.session.role !== 'admin' && query.createdBy !== req.session.userId) {
      // Check if they're a task member
      const member = taskMemberRepo.findByTaskAndUser(query.taskId, req.session.userId!);
      if (!member) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
    }

    res.json({ success: true, data: enrichQuery(query.id) });
  })
);

// POST /api/queries/:id/messages - Add a message
router.post(
  '/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = queryRepo.findById(req.params.id);
    if (!query) {
      res.status(404).json({ success: false, error: 'Query not found' });
      return;
    }

    if (query.status === 'resolved') {
      res.status(400).json({ success: false, error: 'Cannot message on resolved query' });
      return;
    }

    // Authorization
    if (req.session.role !== 'admin' && query.createdBy !== req.session.userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const schema = z.object({ message: z.string().min(1, 'Message is required') });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const qm = await queryMessageRepo.create({
      queryId: query.id,
      senderUserId: req.session.userId!,
      message: parse.data.message,
      createdAt: new Date().toISOString(),
    });

    const task = taskRepo.findById(query.taskId);
    const sender = userRepo.findById(req.session.userId!);

    // If admin replies, notify the query creator
    if (req.session.role === 'admin' && query.createdBy !== req.session.userId) {
      const tmpl = notifTemplates.queryAnswered(task?.title ?? 'Unknown Task');
      await createNotification({
        recipientUserId: query.createdBy,
        eventType: 'QUERY_ANSWERED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: query.taskId,
        relatedQueryId: query.id,
      });

      if (query.status === 'open') {
        await queryRepo.update(query.id, { status: 'answered' });
      }
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'query',
      entityId: query.id,
      eventType: 'QUERY_ANSWERED',
      message: `${sender?.fullName ?? 'Unknown'} added a message to the query`,
    });

    res.status(201).json({ success: true, data: qm });
  })
);

// PATCH /api/queries/:id/status - Change query status
router.patch(
  '/:id/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = queryRepo.findById(req.params.id);
    if (!query) {
      res.status(404).json({ success: false, error: 'Query not found' });
      return;
    }

    const schema = z.object({
      status: z.enum(['open', 'answered', 'resolved', 'reopened']),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const newStatus = parse.data.status;

    // Only admin can resolve; employee can reopen
    if (newStatus === 'resolved' && req.session.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Only admin can resolve queries' });
      return;
    }
    if (newStatus === 'reopened' && query.createdBy !== req.session.userId && req.session.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const updated = await queryRepo.update(query.id, { status: newStatus });

    if (newStatus === 'resolved') {
      const task = taskRepo.findById(query.taskId);
      const tmpl = notifTemplates.queryResolved(task?.title ?? 'Unknown Task');
      await createNotification({
        recipientUserId: query.createdBy,
        eventType: 'QUERY_RESOLVED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: query.taskId,
        relatedQueryId: query.id,
      });

      await createAuditEvent({
        actorUserId: req.session.userId!,
        entityType: 'query',
        entityId: query.id,
        eventType: 'QUERY_RESOLVED',
        previousState: query.status,
        newState: 'resolved',
        message: `Query resolved`,
      });
    }

    res.json({ success: true, data: enrichQuery(query.id) });
  })
);

// Router for task-nested queries mounted at /api/tasks
export const taskQueryRouter = Router();

// GET /api/tasks/:taskId/queries
taskQueryRouter.get(
  '/:taskId/queries',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    if (req.session.role !== 'admin') {
      const member = taskMemberRepo.findByTaskAndUser(task.id, req.session.userId!);
      if (!member) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
    }

    const queries = queryRepo.findByTask(task.id);
    const enriched = queries.map((q) => enrichQuery(q.id)).filter(Boolean);
    res.json({ success: true, data: enriched });
  })
);

// POST /api/tasks/:taskId/queries - Employee creates a query
taskQueryRouter.post(
  '/:taskId/queries',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    if (task.status === 'cancelled') {
      res.status(400).json({ success: false, error: 'Cannot raise query on cancelled task' });
      return;
    }

    // Verify user is a task member or admin
    if (req.session.role !== 'admin') {
      const member = taskMemberRepo.findByTaskAndUser(task.id, req.session.userId!);
      if (!member) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
    }

    const schema = z.object({
      title: z.string().min(3, 'Query title is required'),
      description: z.string().min(10, 'Description is required'),
      category: z.enum([
        'clarification',
        'blocker',
        'dependency',
        'deadline_concern',
        'assignment_issue',
        'technical_issue',
        'other',
      ]),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const query = await queryRepo.create({
      taskId: task.id,
      createdBy: req.session.userId!,
      title: parse.data.title,
      description: parse.data.description,
      category: parse.data.category,
      priority: parse.data.priority,
      status: 'open',
    });

    // Add description as first message
    await queryMessageRepo.create({
      queryId: query.id,
      senderUserId: req.session.userId!,
      message: parse.data.description,
      createdAt: new Date().toISOString(),
    });

    const creator = userRepo.findById(req.session.userId!)!;
    const tmpl = notifTemplates.queryCreated(creator.fullName, task.title);
    await createNotification({
      recipientUserId: task.createdBy,
      eventType: 'QUERY_CREATED',
      title: tmpl.title,
      body: tmpl.body,
      relatedTaskId: task.id,
      relatedQueryId: query.id,
      navigationUrl: `/queries/${query.id}`,
    });

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'query',
      entityId: query.id,
      eventType: 'QUERY_CREATED',
      newState: 'open',
      message: `Query "${parse.data.title}" raised by ${creator.fullName}`,
    });

    res.status(201).json({ success: true, data: enrichQuery(query.id) });
  })
);

export default router;
