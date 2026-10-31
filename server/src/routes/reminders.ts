import { Router } from 'express';
import {
  taskRepo,
  taskMemberRepo,
  userRepo,
  reminderRepo,
} from '../repositories/inMemoryStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notificationService.js';
import {
  getISTClock,
  getISTSchedulerStats,
  checkAndDispatchPendingReminders,
} from '../services/istSchedulerService.js';
import { format } from 'date-fns';

const router = Router();

// ============================================================
// IST CLOCK & AUTOMATED SCHEDULER STATUS (Authenticated)
// ============================================================

// GET /api/reminders/ist-status
router.get(
  '/ist-status',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const istClock = getISTClock();
    const stats = getISTSchedulerStats();
    
    // Enrich with list of active pending tasks that have reminder slots configured
    const activeTasks = taskRepo.findAll()
      .filter((t) => t.status !== 'cancelled' && t.status !== 'approved' && t.reminderEnabled)
      .map((t) => {
        const members = taskMemberRepo.findByTask(t.id);
        const pendingMembers = members.filter(
          (m) => m.memberStatus !== 'approved' && m.memberStatus !== 'submitted_for_review'
        );
        return {
          id: t.id,
          referenceNumber: t.referenceNumber,
          title: t.title,
          deadline: t.deadline,
          reminderTimes: t.reminderTimes || [],
          pendingMembersCount: pendingMembers.length,
          pendingMembers: pendingMembers.map((pm) => {
            const u = userRepo.findById(pm.userId);
            return {
              userId: pm.userId,
              fullName: u?.fullName || 'Employee',
              memberStatus: pm.memberStatus,
            };
          }),
        };
      });

    res.json({
      success: true,
      data: {
        clock: istClock,
        stats,
        scheduledTasks: activeTasks,
      },
    });
  })
);

// POST /api/reminders/trigger-ist (Admin manual trigger to dispatch now)
router.post(
  '/trigger-ist',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { slot, forceAll, taskId } = req.body || {};
    const result = await checkAndDispatchPendingReminders({
      targetSlot: slot,
      forceAll: forceAll !== undefined ? Boolean(forceAll) : true,
      taskId,
    });

    res.json({
      success: true,
      message: `Triggered pending task notification dispatch (${result.dispatchedCount} notification(s) sent)`,
      data: result,
    });
  })
);

interface ReminderResult {
  taskId: string;
  taskTitle: string;
  userId: string;
  userName: string;
  reminderType: string;
  eligible: boolean;
  reason?: string;
}

function evaluateReminders(): ReminderResult[] {
  const now = new Date();
  const results: ReminderResult[] = [];

  const tasks = taskRepo.findAll().filter((t) => t.status !== 'cancelled' && t.reminderEnabled);

  for (const task of tasks) {
    const members = taskMemberRepo.findByTask(task.id);
    const deadline = new Date(task.deadline);

    for (const member of members) {
      const user = userRepo.findById(member.userId);
      if (!user) continue;

      // Skip approved/cancelled members
      if (member.memberStatus === 'approved') {
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          userId: member.userId,
          userName: user.fullName,
          reminderType: 'submission',
          eligible: false,
          reason: 'Task already approved',
        });
        continue;
      }

      if (!member.reminderEligible) {
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          userId: member.userId,
          userName: user.fullName,
          reminderType: 'submission',
          eligible: false,
          reason: 'Reminder eligibility disabled (submitted or inactive)',
        });
        continue;
      }

      // Check if submitted
      if (member.memberStatus === 'submitted_for_review') {
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          userId: member.userId,
          userName: user.fullName,
          reminderType: 'submission',
          eligible: false,
          reason: 'Already submitted for review',
        });
        continue;
      }

      // Overdue
      if (deadline < now) {
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          userId: member.userId,
          userName: user.fullName,
          reminderType: 'overdue',
          eligible: true,
        });
        continue;
      }

      // Approaching deadline (within 24 hours)
      const hoursToDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursToDeadline <= 24) {
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          userId: member.userId,
          userName: user.fullName,
          reminderType: 'deadline',
          eligible: true,
        });
        continue;
      }

      // Regular submission reminder
      results.push({
        taskId: task.id,
        taskTitle: task.title,
        userId: member.userId,
        userName: user.fullName,
        reminderType: 'submission',
        eligible: true,
      });
    }
  }

  return results;
}

// GET /api/reminders/preview
router.get(
  '/preview',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const results = evaluateReminders();
    res.json({ success: true, data: results });
  })
);

// POST /api/reminders/evaluate
router.post(
  '/evaluate',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const results = evaluateReminders();
    const eligible = results.filter((r) => r.eligible);

    // Create notification for each eligible reminder
    for (const reminder of eligible) {
      const task = taskRepo.findById(reminder.taskId);
      if (!task) continue;

      let title = '';
      let body = '';

      if (reminder.reminderType === 'overdue') {
        title = 'Task Overdue';
        body = `Your task "${task.title}" is overdue. Please submit or update your status.`;
      } else if (reminder.reminderType === 'deadline') {
        title = 'Deadline Approaching';
        body = `Your task "${task.title}" deadline is approaching (${format(new Date(task.deadline), 'dd/MM/yyyy')}).`;
      } else {
        title = 'Task Submission Reminder';
        body = `Please update your progress on "${task.title}".`;
      }

      createNotification({
        recipientUserId: reminder.userId,
        eventType: reminder.reminderType === 'overdue' ? 'TASK_OVERDUE' : 'REMINDER_DUE',
        title,
        body,
        relatedTaskId: reminder.taskId,
        navigationUrl: `/tasks/${reminder.taskId}`,
      });

      reminderRepo.create({
        taskId: reminder.taskId,
        recipientUserId: reminder.userId,
        scheduledFor: new Date().toISOString(),
        timezone: task.timezone,
        reminderType: reminder.reminderType as 'submission' | 'deadline' | 'overdue',
        status: 'delivered',
        skippedReason: null,
      });
    }

    res.json({
      success: true,
      data: {
        total: results.length,
        eligible: eligible.length,
        skipped: results.length - eligible.length,
        results,
      },
    });
  })
);

export default router;

