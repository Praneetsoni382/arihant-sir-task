// ============================================================
// INDIAN STANDARD TIME (IST) CLOCK & AUTOMATED SCHEDULER
// File: server/src/services/istSchedulerService.ts
// Handles Asia/Kolkata (UTC+5:30) timing, background clock loop,
// and automated notification dispatch for pending tasks according
// to admin-prescribed time slots.
// ============================================================

import {
  taskRepo,
  taskMemberRepo,
  userRepo,
  reminderRepo,
} from '../repositories/inMemoryStore.js';
import { createNotification } from './notificationService.js';
import { format } from 'date-fns';

export interface ISTClockState {
  iso: string;
  time24: string; // e.g. "14:30"
  time12: string; // e.g. "02:30 PM"
  timeWithSeconds: string; // e.g. "02:30:15 PM"
  date: string; // e.g. "2026-10-31"
  dateFormatted: string; // e.g. "Saturday, 31 October 2026"
  timezone: string; // "Asia/Kolkata"
  offset: string; // "+05:30"
  epoch: number;
  hour: number;
  minute: number;
  second: number;
}

export interface ISTSchedulerStats {
  active: boolean;
  intervalSeconds: number;
  lastCheckAt: string | null;
  totalDispatchesToday: number;
  lastDispatchedSummary: string | null;
  activePendingTasksCount: number;
}

// Track dispatches to prevent duplicate sends within the same time slot minute
// Key format: `${taskId}::${slot}::${istDate}`
const dispatchedCache = new Set<string>();
let lastCleanedDate = '';

let totalDispatchesToday = 0;
let lastCheckAt: string | null = null;
let lastDispatchedSummary: string | null = null;
let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Returns the current time formatted accurately in Indian Standard Time (Asia/Kolkata)
 */
export function getISTClock(): ISTClockState {
  const now = new Date();

  // Format explicitly in Asia/Kolkata (IST = UTC+5:30)
  const time24Formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const time12Formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const fullDateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const parts = time24Formatter.formatToParts(now);
  const hourStr = parts.find((p) => p.type === 'hour')?.value || '00';
  const minStr = parts.find((p) => p.type === 'minute')?.value || '00';
  const secStr = parts.find((p) => p.type === 'second')?.value || '00';

  const time24 = `${hourStr}:${minStr}`;
  const timeWithSeconds = time12Formatter.format(now);
  const time12 = timeWithSeconds.replace(/:\d{2}(\s|$)/, '$1');

  // Date format
  const dateParts = dateFormatter.formatToParts(now);
  const dYear = dateParts.find((p) => p.type === 'year')?.value || '';
  const dMonth = dateParts.find((p) => p.type === 'month')?.value || '';
  const dDay = dateParts.find((p) => p.type === 'day')?.value || '';
  const date = `${dYear}-${dMonth}-${dDay}`;
  const dateFormatted = fullDateFormatter.format(now);

  return {
    iso: now.toISOString(),
    time24,
    time12,
    timeWithSeconds,
    date,
    dateFormatted,
    timezone: 'Asia/Kolkata',
    offset: '+05:30',
    epoch: now.getTime(),
    hour: parseInt(hourStr, 10),
    minute: parseInt(minStr, 10),
    second: parseInt(secStr, 10),
  };
}

export function getISTSchedulerStats(): ISTSchedulerStats {
  const allTasks = taskRepo.findAll();
  const activePendingTasks = allTasks.filter(
    (t) => t.status !== 'cancelled' && t.status !== 'approved' && t.reminderEnabled
  );

  return {
    active: schedulerTimer !== null,
    intervalSeconds: 30,
    lastCheckAt,
    totalDispatchesToday,
    lastDispatchedSummary,
    activePendingTasksCount: activePendingTasks.length,
  };
}

export interface DispatchResult {
  dispatchedCount: number;
  tasksChecked: number;
  matchedTasks: number;
  details: Array<{
    taskId: string;
    taskTitle: string;
    recipientUserId: string;
    recipientName: string;
    memberStatus: string;
    slot: string;
    type: string;
  }>;
}

/**
 * Evaluates pending tasks against current IST time slot or given target slot,
 * and automatically dispatches notifications to concerned employees with pending work.
 */
export async function checkAndDispatchPendingReminders(options?: {
  targetSlot?: string;
  forceAll?: boolean;
  taskId?: string;
}): Promise<DispatchResult> {
  const ist = getISTClock();
  lastCheckAt = ist.timeWithSeconds + ' IST (' + ist.date + ')';

  // Clear cache if day changed
  if (lastCleanedDate !== ist.date) {
    dispatchedCache.clear();
    lastCleanedDate = ist.date;
    totalDispatchesToday = 0;
  }

  const currentSlot = options?.targetSlot || ist.time24; // e.g. "12:00"
  const forceAll = Boolean(options?.forceAll);

  const allTasks = taskRepo.findAll();
  const eligibleTasks = allTasks.filter((t) => {
    if (t.status === 'cancelled' || t.status === 'approved') return false;
    if (!t.reminderEnabled && !forceAll) return false;
    if (options?.taskId && t.id !== options.taskId) return false;
    return true;
  });

  const details: DispatchResult['details'] = [];
  let dispatchedCount = 0;
  let matchedTasks = 0;

  for (const task of eligibleTasks) {
    const reminderSlots = task.reminderTimes || [];

    // Check if task is scheduled for the current IST slot
    const slotMatches = forceAll || reminderSlots.includes(currentSlot);

    if (!slotMatches) {
      continue;
    }

    matchedTasks++;

    const members = taskMemberRepo.findByTask(task.id);
    const deadline = new Date(task.deadline);
    const isOverdue = deadline < new Date();

    for (const member of members) {
      // Concerned employees: only those whose work is still pending, in progress, blocked, or revision requested
      // (Skip approved and submitted_for_review unless revision requested)
      if (member.memberStatus === 'approved' || member.memberStatus === 'submitted_for_review') {
        continue;
      }

      const user = userRepo.findById(member.userId);
      if (!user || !user.active) continue;

      // Duplicate prevention for automatic scheduled runs
      const cacheKey = `${task.id}::${member.userId}::${currentSlot}::${ist.date}`;
      if (!forceAll && dispatchedCache.has(cacheKey)) {
        continue;
      }

      // Compose high-priority reminder message with IST timing stamp
      let title = '';
      let body = '';
      const eventType = isOverdue ? 'TASK_OVERDUE' : 'REMINDER_DUE';

      const deadlineStr = format(deadline, 'dd MMM yyyy, hh:mm a');

      if (isOverdue) {
        title = `⚠️ Overdue Task Alert: ${task.title}`;
        body = `[IST ${ist.time12}] Your assigned task "${task.title}" is overdue (${member.memberStatus.replace('_', ' ')}). Deadline was ${deadlineStr}. Please submit your pending deliverables immediately.`;
      } else {
        title = `📋 Pending Task Reminder: ${task.title}`;
        body = `[IST ${ist.time12} Reminder] Pending work on "${task.title}" (${member.memberStatus.replace('_', ' ')}). Deadline: ${deadlineStr}. Please review and update your progress.`;
      }

      try {
        await createNotification({
          recipientUserId: member.userId,
          eventType,
          title,
          body,
          relatedTaskId: task.id,
          navigationUrl: `/employee/tasks/${task.id}`,
        });

        await reminderRepo.create({
          taskId: task.id,
          recipientUserId: member.userId,
          scheduledFor: new Date().toISOString(),
          timezone: 'Asia/Kolkata',
          reminderType: isOverdue ? 'overdue' : 'submission',
          status: 'delivered',
          skippedReason: null,
        });

        dispatchedCache.add(cacheKey);
        dispatchedCount++;
        totalDispatchesToday++;

        details.push({
          taskId: task.id,
          taskTitle: task.title,
          recipientUserId: member.userId,
          recipientName: user.fullName,
          memberStatus: member.memberStatus,
          slot: currentSlot,
          type: isOverdue ? 'overdue' : 'pending_reminder',
        });

        console.log(
          `[IST Scheduler] 🔔 Dispatched pending task alert at ${currentSlot} IST for "${task.title}" to ${user.fullName} (${user.email})`
        );
      } catch (sendErr) {
        console.error(`[IST Scheduler] Error dispatching to ${user.email}:`, sendErr);
      }
    }
  }

  if (dispatchedCount > 0) {
    lastDispatchedSummary = `Dispatched ${dispatchedCount} alerts for ${matchedTasks} task(s) at ${currentSlot} IST`;
  }

  return {
    dispatchedCount,
    tasksChecked: eligibleTasks.length,
    matchedTasks,
    details,
  };
}

/**
 * Starts the continuous Indian Standard Time background clock loop
 */
export function startISTClockAndScheduler(): void {
  if (schedulerTimer) {
    return;
  }

  console.log('🇮🇳 [IST Clock] Indian Standard Time Clock & Notification Scheduler initialized.');
  const initial = getISTClock();
  console.log(`   Current IST Time: ${initial.timeWithSeconds} | Date: ${initial.dateFormatted}`);
  console.log(`   Evaluation interval: 30 seconds (checking scheduled daily reminder slots)`);

  // Run initial check
  checkAndDispatchPendingReminders().catch((err) => {
    console.warn('[IST Clock Scheduler] Initial evaluation notice:', err);
  });

  // Evaluate every 30 seconds so no minute slot is missed
  schedulerTimer = setInterval(() => {
    checkAndDispatchPendingReminders().catch((err) => {
      console.warn('[IST Clock Scheduler] Periodic check notice:', err);
    });
  }, 30_000);
}

export function stopISTClockAndScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[IST Clock] Scheduler stopped.');
  }
}
