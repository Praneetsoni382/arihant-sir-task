// ============================================================
// REMINDERS ROUTES
// ============================================================

import { Router } from 'express';
import {
  taskRepo,
  taskMemberRepo,
  userRepo,
  reminderRepo,
} from '../repositories/inMemoryStore.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notificationService.js';
import { format } from 'date-fns';

const router = Router();

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

