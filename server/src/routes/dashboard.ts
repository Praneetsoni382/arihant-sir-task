// ============================================================
// DASHBOARD ROUTES
// ============================================================

import { Router } from 'express';
import {
  taskRepo,
  taskMemberRepo,
  userRepo,
  queryRepo,
  statusRequestRepo,
  notificationRepo,
} from '../repositories/inMemoryStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

function enrichTask(taskId: string) {
  const task = taskRepo.findById(taskId);
  if (!task) return null;
  const members = taskMemberRepo.findByTask(taskId).map((tm) => {
    const user = userRepo.findById(tm.userId);
    const { passwordHash: _, ...safeUser } = user!;
    return { ...tm, user: safeUser };
  });
  return { ...task, members };
}

// GET /api/dashboard/admin
router.get(
  '/admin',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const allTasks = taskRepo.findAll().filter((t) => t.status !== 'cancelled');
    const now = new Date();

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === 'approved').length;
    const pendingTasks = allTasks.filter(
      (t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked'
    ).length;
    const submittedForReview = allTasks.filter(
      (t) => t.status === 'submitted_for_review' || t.status === 'revision_requested'
    ).length;

    const activeQueries = queryRepo
      .findAll()
      .filter((q) => q.status === 'open' || q.status === 'answered').length;

    // Recent tasks (last 5)
    const recentTasks = allTasks
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((t) => enrichTask(t.id))
      .filter(Boolean);

    // Approaching deadlines (next 3 days)
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const approachingDeadlines = allTasks
      .filter((t) => {
        const dl = new Date(t.deadline);
        return dl >= now && dl <= in3Days && t.status !== 'approved';
      })
      .map((t) => enrichTask(t.id))
      .filter(Boolean);

    // Overdue tasks
    const overdueTasks = allTasks
      .filter((t) => {
        const dl = new Date(t.deadline);
        return dl < now && t.status !== 'approved' && t.status !== 'submitted_for_review';
      })
      .map((t) => enrichTask(t.id))
      .filter(Boolean);

    // Open queries
    const openQueries = queryRepo
      .findAll()
      .filter((q) => q.status === 'open' || q.status === 'answered')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((q) => {
        const task = taskRepo.findById(q.taskId);
        const creator = userRepo.findById(q.createdBy);
        return {
          ...q,
          taskTitle: task?.title ?? '',
          creatorName: creator?.fullName ?? '',
        };
      });

    // Recent submissions awaiting review
    const allMembers = taskMemberRepo.findByTask('').filter(() => false); // placeholder
    const recentSubmissions = (() => {
      const allTaskIds = taskRepo.findAll().map((t) => t.id);
      const result: Array<Record<string, unknown>> = [];
      for (const taskId of allTaskIds) {
        const members = taskMemberRepo.findByTask(taskId);
        for (const m of members) {
          if (m.memberStatus === 'submitted_for_review') {
            const task = taskRepo.findById(m.taskId);
            const user = userRepo.findById(m.userId);
            if (task && user) {
              const { passwordHash: _, ...safeUser } = user;
              result.push({ ...m, task, user: safeUser });
            }
          }
        }
      }
      return result.slice(0, 5);
    })();

    res.json({
      success: true,
      data: {
        totalTasks,
        completedTasks,
        pendingTasks,
        submittedForReview,
        activeQueries,
        recentTasks,
        approachingDeadlines,
        overdueTasks,
        openQueries,
        recentSubmissions,
      },
    });
  })
);

// GET /api/dashboard/employee
router.get(
  '/employee',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const myMembers = taskMemberRepo.findByUser(userId);
    const myTasks = taskRepo
      .findByMember(userId)
      .filter((t) => t.status !== 'cancelled');

    const totalAssigned = myTasks.length;
    const inProgress = myMembers.filter(
      (m) => m.memberStatus === 'in_progress' || m.memberStatus === 'blocked'
    ).length;
    const submitted = myMembers.filter(
      (m) => m.memberStatus === 'submitted_for_review'
    ).length;
    const approved = myMembers.filter((m) => m.memberStatus === 'approved').length;

    const myTasksEnriched = myTasks
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => enrichTask(t.id))
      .filter(Boolean);

    // Pending status requests
    const pendingStatusRequests = statusRequestRepo
      .findByRecipient(userId)
      .filter((sr) => sr.status === 'pending')
      .map((sr) => {
        const task = taskRepo.findById(sr.taskId);
        return { ...sr, task };
      });

    // My open queries
    const openQueries = queryRepo
      .findByUser(userId)
      .filter((q) => q.status !== 'resolved')
      .slice(0, 5);

    // Recent notifications
    const recentNotifications = notificationRepo
      .findByRecipient(userId)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        totalAssigned,
        inProgress,
        submitted,
        approved,
        myTasks: myTasksEnriched,
        pendingStatusRequests,
        openQueries,
        recentNotifications,
      },
    });
  })
);

export default router;
