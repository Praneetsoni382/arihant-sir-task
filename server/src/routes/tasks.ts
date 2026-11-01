// ============================================================
// TASK ROUTES
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import {
  taskRepo,
  taskMemberRepo,
  userRepo,
  auditRepo,
  nextTaskRef,
  newId,
} from '../repositories/inMemoryStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createAuditEvent,
  createNotification,
  notifTemplates,
} from '../services/notificationService.js';
import type { TaskStatus, MemberStatus } from '../types/index.js';
import { format } from 'date-fns';

const router = Router();

// ============================================================
// HELPERS
// ============================================================

function formatDeadline(deadline: string): string {
  try {
    return format(new Date(deadline), 'dd/MM/yyyy');
  } catch {
    return deadline;
  }
}

function enrichTask(taskId: string) {
  const task = taskRepo.findById(taskId);
  if (!task) return null;
  const members = taskMemberRepo.findByTask(taskId).map((tm) => {
    const user = userRepo.findById(tm.userId);
    const { passwordHash: _, ...safeUser } = user ?? {
      id: tm.userId,
      fullName: 'Unknown',
      passwordHash: '',
      employeeId: '',
      email: '',
      department: '',
      designation: '',
      role: 'employee' as const,
      active: false,
      createdAt: '',
      updatedAt: '',
    };
    return { ...tm, user: safeUser };
  });
  return { ...task, members };
}

// Validate task status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['blocked', 'submitted_for_review', 'cancelled'],
  blocked: ['in_progress', 'submitted_for_review', 'cancelled'],
  submitted_for_review: ['approved', 'revision_requested', 'cancelled'],
  revision_requested: ['in_progress', 'blocked', 'cancelled'],
  approved: [],
  cancelled: [],
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================
// TASK CREATION SCHEMA
// ============================================================

const createTaskSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().min(5, 'Description is required'),
  assignmentType: z.enum(['solo', 'group']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.string().optional().default(''),
  department: z.string().optional().default(''),
  deadline: z.string().min(1, 'Deadline is required'),
  startDate: z.string().nullable().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  reminderEnabled: z.boolean().default(true),
  reminderTimes: z.array(z.string()).default(['12:00', '15:00']),
  managerNote: z.string().optional().default(''),
  assignedUserIds: z.array(z.string()).min(1, 'At least one employee must be assigned'),
});

// ============================================================
// GET /api/tasks
// ============================================================
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status, priority, assignmentType, search } = req.query;
    const isAdmin = req.session.role === 'admin';

    let tasks = isAdmin
      ? taskRepo.findAll()
      : taskRepo.findByMember(req.session.userId!);

    if (status && typeof status === 'string') {
      tasks = tasks.filter((t) => t.status === status);
    }
    if (priority && typeof priority === 'string') {
      tasks = tasks.filter((t) => t.priority === priority);
    }
    if (assignmentType && typeof assignmentType === 'string') {
      tasks = tasks.filter((t) => t.assignmentType === assignmentType);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.referenceNumber.toLowerCase().includes(q)
      );
    }

    const enriched = tasks
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => enrichTask(t.id))
      .filter(Boolean);

    res.json({ success: true, data: enriched });
  })
);

// ============================================================
// POST /api/tasks
// ============================================================
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parse = createTaskSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const data = parse.data;

    // Validate assignment type
    if (data.assignmentType === 'group' && data.assignedUserIds.length < 2) {
      res.status(400).json({
        success: false,
        error: 'Group tasks require at least 2 employees',
      });
      return;
    }
    if (data.assignmentType === 'solo' && data.assignedUserIds.length !== 1) {
      res.status(400).json({
        success: false,
        error: 'Solo tasks require exactly 1 employee',
      });
      return;
    }

    // Validate employees exist and are active
    const employees: { id: string; fullName: string }[] = [];
    for (const userId of data.assignedUserIds) {
      const user = userRepo.findById(userId);
      if (!user || user.role !== 'employee') {
        res.status(400).json({ success: false, error: `Employee ${userId} not found` });
        return;
      }
      if (!user.active) {
        res.status(400).json({
          success: false,
          error: `Employee ${user.fullName} is inactive`,
        });
        return;
      }
      employees.push({ id: user.id, fullName: user.fullName });
    }

    // Remove duplicates
    const uniqueUserIds = [...new Set(data.assignedUserIds)];

    // Create task
    const task = await taskRepo.create({
      referenceNumber: nextTaskRef(),
      title: data.title,
      description: data.description,
      assignmentType: data.assignmentType,
      priority: data.priority,
      status: 'pending',
      category: data.category ?? '',
      department: data.department ?? '',
      deadline: data.deadline,
      startDate: data.startDate ?? null,
      timezone: data.timezone,
      reminderEnabled: data.reminderEnabled,
      reminderTimes: data.reminderTimes,
      managerNote: data.managerNote ?? '',
      createdBy: req.session.userId!,
      cancelledAt: null,
    });

    const now = new Date().toISOString();

    // Create task members + notifications
    for (const userId of uniqueUserIds) {
      await taskMemberRepo.create({
        taskId: task.id,
        userId,
        memberStatus: 'pending',
        submissionNote: '',
        submittedAt: null,
        approvedAt: null,
        revisionRequestedAt: null,
        revisionReason: '',
        lastStatusUpdateAt: now,
        reminderEligible: true,
      });

      const tmpl = notifTemplates.taskAssigned(task.title, formatDeadline(task.deadline));
      await createNotification({
        recipientUserId: userId,
        eventType: 'TASK_ASSIGNED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: task.id,
        navigationUrl: `/tasks/${task.id}`,
      });
    }

    const memberNames = employees.map((e) => e.fullName).join(', ');
    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'task',
      entityId: task.id,
      eventType: 'TASK_CREATED',
      newState: 'pending',
      message: `Task created and assigned to ${memberNames}`,
    });

    const enriched = enrichTask(task.id);
    res.status(201).json({ success: true, data: enriched });
  })
);

// ============================================================
// GET /api/tasks/:id
// ============================================================
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    let task = taskRepo.findById(req.params.id);
    if (!task) {
      task = await taskRepo.fetchFromCloudById(req.params.id);
    }
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Authorization: employees can only see tasks they're assigned to
    if (req.session.role !== 'admin') {
      const member = taskMemberRepo.findByTaskAndUser(task.id, req.session.userId!);
      if (!member) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
    }

    const enriched = enrichTask(task.id);
    res.json({ success: true, data: enriched });
  })
);

// ============================================================
// PATCH /api/tasks/:id
// ============================================================
router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    let task = taskRepo.findById(req.params.id);
    if (!task) {
      task = await taskRepo.fetchFromCloudById(req.params.id);
    }
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }
    if (task.status === 'cancelled') {
      res.status(400).json({ success: false, error: 'Cannot edit cancelled task' });
      return;
    }

    const allowedFields = z.object({
      title: z.string().min(2).optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      category: z.string().optional(),
      department: z.string().optional(),
      deadline: z.string().optional(),
      managerNote: z.string().optional(),
      reminderEnabled: z.boolean().optional(),
      reminderTimes: z.array(z.string()).optional(),
    });

    const parse = allowedFields.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const deadlineChanged = parse.data.deadline && parse.data.deadline !== task.deadline;

    const updated = await taskRepo.update(task.id, parse.data);
    if (!updated) {
      res.status(500).json({ success: false, error: 'Update failed' });
      return;
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'task',
      entityId: task.id,
      eventType: 'TASK_UPDATED',
      message: `Task "${task.title}" updated`,
    });

    // Notify members if deadline changed
    if (deadlineChanged) {
      const members = taskMemberRepo.findByTask(task.id);
      for (const m of members) {
        const tmpl = notifTemplates.deadlineChanged(
          updated.title,
          formatDeadline(updated.deadline)
        );
        await createNotification({
          recipientUserId: m.userId,
          eventType: 'DEADLINE_CHANGED',
          title: tmpl.title,
          body: tmpl.body,
          relatedTaskId: task.id,
        });
      }
    }

    const enriched = enrichTask(task.id);
    res.json({ success: true, data: enriched });
  })
);

// ============================================================
// POST /api/tasks/:id/cancel
// ============================================================
router.post(
  '/:id/cancel',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }
    if (task.status === 'cancelled') {
      res.status(400).json({ success: false, error: 'Task already cancelled' });
      return;
    }

    const updated = await taskRepo.update(task.id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });

    // Disable reminders for all members
    const members = taskMemberRepo.findByTask(task.id);
    for (const m of members) {
      await taskMemberRepo.update(m.id, { reminderEligible: false });
      const tmpl = notifTemplates.taskCancelled(task.title);
      await createNotification({
        recipientUserId: m.userId,
        eventType: 'TASK_CANCELLED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: task.id,
      });
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'task',
      entityId: task.id,
      eventType: 'TASK_CANCELLED',
      previousState: task.status,
      newState: 'cancelled',
      message: `Task "${task.title}" cancelled by administrator`,
    });

    const enriched = enrichTask(task.id);
    res.json({ success: true, data: enriched });
  })
);

// ============================================================
// GET /api/tasks/:id/history
// ============================================================
router.get(
  '/:id/history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.id);
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

    const history = auditRepo.findByEntity(task.id);
    const enriched = history.map((e) => {
      const actor = userRepo.findById(e.actorUserId);
      return { ...e, actorName: actor?.fullName ?? 'System' };
    });

    res.json({ success: true, data: enriched });
  })
);

// ============================================================
// GET /api/tasks/:id/members
// ============================================================
router.get(
  '/:id/members',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.id);
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

    const members = taskMemberRepo.findByTask(task.id).map((tm) => {
      const user = userRepo.findById(tm.userId);
      const { passwordHash: _, ...safeUser } = user!;
      return { ...tm, user: safeUser };
    });

    res.json({ success: true, data: members });
  })
);

// ============================================================
// PATCH /api/tasks/:id/members/:memberId/status
// Employee updates their own status
// ============================================================
router.patch(
  '/:id/members/:memberId/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const member = taskMemberRepo.findById(req.params.memberId);
    if (!member || member.taskId !== task.id) {
      res.status(404).json({ success: false, error: 'Member record not found' });
      return;
    }

    // Only the member themselves (or admin) can update the status
    if (req.session.role !== 'admin' && member.userId !== req.session.userId) {
      res.status(403).json({ success: false, error: 'Cannot modify another member\'s status' });
      return;
    }

    const schema = z.object({
      status: z.enum(['pending', 'in_progress', 'blocked', 'submitted_for_review', 'revision_requested']),
      explanation: z.string().optional().default(''),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const newStatus = parse.data.status as MemberStatus;
    const oldStatus = member.memberStatus;

    if (!isValidTransition(oldStatus, newStatus)) {
      res.status(400).json({
        success: false,
        error: `Invalid status transition from ${oldStatus} to ${newStatus}`,
      });
      return;
    }

    const updatedMember = await taskMemberRepo.update(member.id, {
      memberStatus: newStatus,
      lastStatusUpdateAt: new Date().toISOString(),
    });

    const actor = userRepo.findById(req.session.userId!)!;

    // Handle blocker notifications
    if (newStatus === 'blocked') {
      const tmpl = notifTemplates.blockerReported(actor.fullName, task.title);
      await createNotification({
        recipientUserId: task.createdBy,
        eventType: 'BLOCKER_REPORTED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: task.id,
      });
    }
    if (oldStatus === 'blocked' && newStatus === 'in_progress') {
      const tmpl = notifTemplates.blockerResolved(actor.fullName, task.title);
      await createNotification({
        recipientUserId: task.createdBy,
        eventType: 'BLOCKER_RESOLVED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: task.id,
      });
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'task',
      entityId: task.id,
      eventType: 'STATUS_CHANGED',
      previousState: oldStatus,
      newState: newStatus,
      message: `${actor.fullName} updated status from ${oldStatus} to ${newStatus}${parse.data.explanation ? ': ' + parse.data.explanation : ''}`,
    });

    // Recalculate overall task status
    await updateOverallTaskStatus(task.id, req.session.userId!);

    res.json({ success: true, data: updatedMember });
  })
);

// ============================================================
// POST /api/tasks/:id/members/:memberId/submit
// Employee submits their work
// ============================================================
router.post(
  '/:id/members/:memberId/submit',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const member = taskMemberRepo.findById(req.params.memberId);
    if (!member || member.taskId !== task.id) {
      res.status(404).json({ success: false, error: 'Member record not found' });
      return;
    }

    if (req.session.role !== 'admin' && member.userId !== req.session.userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (member.memberStatus === 'submitted_for_review' || member.memberStatus === 'approved') {
      res.status(400).json({ success: false, error: 'Already submitted' });
      return;
    }

    const schema = z.object({ submissionNote: z.string().optional().default('') });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const now = new Date().toISOString();
    const updatedMember = await taskMemberRepo.update(member.id, {
      memberStatus: 'submitted_for_review',
      submissionNote: parse.data.submissionNote,
      submittedAt: now,
      reminderEligible: false,
      lastStatusUpdateAt: now,
    });

    const actor = userRepo.findById(req.session.userId!)!;

    // Notify admin
    const tmpl = notifTemplates.taskSubmitted(actor.fullName, task.title);
    await createNotification({
      recipientUserId: task.createdBy,
      eventType: 'TASK_SUBMITTED',
      title: tmpl.title,
      body: tmpl.body,
      relatedTaskId: task.id,
    });

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'task',
      entityId: task.id,
      eventType: 'MEMBER_SUBMITTED',
      previousState: member.memberStatus,
      newState: 'submitted_for_review',
      message: `${actor.fullName} submitted task for review`,
    });

    // Check if group task is fully submitted
    if (task.assignmentType === 'group') {
      const allMembers = taskMemberRepo.findByTask(task.id);
      const allSubmitted = allMembers.every(
        (m) => m.memberStatus === 'submitted_for_review' || m.memberStatus === 'approved'
      );

      if (allSubmitted) {
        // Notify other group members
        for (const m of allMembers) {
          if (m.userId !== req.session.userId) {
            const grpTmpl = notifTemplates.groupMemberSubmitted(actor.fullName, task.title);
            await createNotification({
              recipientUserId: m.userId,
              eventType: 'GROUP_MEMBER_SUBMITTED',
              title: grpTmpl.title,
              body: grpTmpl.body,
              relatedTaskId: task.id,
            });
          }
        }

        // Notify admin about full group submission
        const readyTmpl = notifTemplates.groupReadyForReview(task.title);
        await createNotification({
          recipientUserId: task.createdBy,
          eventType: 'GROUP_READY_FOR_REVIEW',
          title: readyTmpl.title,
          body: readyTmpl.body,
          relatedTaskId: task.id,
        });
      }
    }

    await updateOverallTaskStatus(task.id, req.session.userId!);

    res.json({ success: true, data: updatedMember });
  })
);

// ============================================================
// POST /api/tasks/:id/members/:memberId/approve
// Admin approves submission
// ============================================================
router.post(
  '/:id/members/:memberId/approve',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const member = taskMemberRepo.findById(req.params.memberId);
    if (!member || member.taskId !== task.id) {
      res.status(404).json({ success: false, error: 'Member record not found' });
      return;
    }

    if (member.memberStatus !== 'submitted_for_review') {
      res.status(400).json({
        success: false,
        error: 'Can only approve submitted work',
      });
      return;
    }

    const now = new Date().toISOString();
    const updatedMember = await taskMemberRepo.update(member.id, {
      memberStatus: 'approved',
      approvedAt: now,
      reminderEligible: false,
    });

    const tmpl = notifTemplates.taskApproved(task.title);
    await createNotification({
      recipientUserId: member.userId,
      eventType: 'TASK_APPROVED',
      title: tmpl.title,
      body: tmpl.body,
      relatedTaskId: task.id,
    });

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'task',
      entityId: task.id,
      eventType: 'MEMBER_APPROVED',
      previousState: 'submitted_for_review',
      newState: 'approved',
      message: `Submission approved`,
    });

    await updateOverallTaskStatus(task.id, req.session.userId!);

    res.json({ success: true, data: updatedMember });
  })
);

// ============================================================
// POST /api/tasks/:id/members/:memberId/request-revision
// Admin requests revision
// ============================================================
router.post(
  '/:id/members/:memberId/request-revision',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const member = taskMemberRepo.findById(req.params.memberId);
    if (!member || member.taskId !== task.id) {
      res.status(404).json({ success: false, error: 'Member record not found' });
      return;
    }

    const schema = z.object({
      reason: z.string().min(5, 'Revision reason is required (min 5 chars)'),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const now = new Date().toISOString();
    const updatedMember = await taskMemberRepo.update(member.id, {
      memberStatus: 'revision_requested',
      revisionRequestedAt: now,
      revisionReason: parse.data.reason,
      reminderEligible: true,
    });

    const tmpl = notifTemplates.revisionRequested(task.title);
    await createNotification({
      recipientUserId: member.userId,
      eventType: 'REVISION_REQUESTED',
      title: tmpl.title,
      body: tmpl.body,
      relatedTaskId: task.id,
    });

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'task',
      entityId: task.id,
      eventType: 'REVISION_REQUESTED',
      previousState: 'submitted_for_review',
      newState: 'revision_requested',
      message: `Revision requested: ${parse.data.reason}`,
    });

    await updateOverallTaskStatus(task.id, req.session.userId!);

    res.json({ success: true, data: updatedMember });
  })
);

// ============================================================
// HELPER: Recalculate overall task status based on members
// ============================================================
async function updateOverallTaskStatus(taskId: string, actorId: string) {
  const task = taskRepo.findById(taskId);
  if (!task || task.status === 'cancelled') return;

  const members = taskMemberRepo.findByTask(taskId);
  if (members.length === 0) return;

  const statuses = members.map((m) => m.memberStatus);

  let newStatus: TaskStatus = task.status;

  if (statuses.every((s) => s === 'approved')) {
    newStatus = 'approved';
  } else if (statuses.every((s) => s === 'submitted_for_review' || s === 'approved')) {
    newStatus = 'submitted_for_review';
  } else if (statuses.some((s) => s === 'in_progress')) {
    newStatus = 'in_progress';
  } else if (statuses.some((s) => s === 'blocked')) {
    newStatus = 'in_progress'; // still in progress if some blocked
  } else if (statuses.some((s) => s === 'revision_requested')) {
    newStatus = 'revision_requested';
  } else if (statuses.every((s) => s === 'pending')) {
    newStatus = 'pending';
  }

  if (newStatus !== task.status) {
    await taskRepo.update(taskId, { status: newStatus });
  }
}

export default router;

