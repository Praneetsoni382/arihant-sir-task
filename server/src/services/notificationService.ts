// ============================================================
// NOTIFICATION SERVICE
// ============================================================

import {
  notificationRepo,
  auditRepo,
  newId,
} from '../repositories/inMemoryStore.js';
import type { NotificationEventType, AuditEventType } from '../types/index.js';

interface NotifyOptions {
  recipientUserId: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  relatedTaskId?: string;
  relatedQueryId?: string;
  relatedStatusRequestId?: string;
  navigationUrl?: string;
}

export function createNotification(opts: NotifyOptions) {
  return notificationRepo.create({
    recipientUserId: opts.recipientUserId,
    eventType: opts.eventType,
    title: opts.title,
    body: opts.body,
    relatedTaskId: opts.relatedTaskId ?? null,
    relatedQueryId: opts.relatedQueryId ?? null,
    relatedStatusRequestId: opts.relatedStatusRequestId ?? null,
    readAt: null,
    createdAt: new Date().toISOString(),
    deliveryState: 'delivered',
    navigationUrl: opts.navigationUrl ?? null,
  });
}

interface AuditOptions {
  actorUserId: string;
  entityType: 'task' | 'user' | 'query' | 'status_request' | 'chat';
  entityId: string;
  eventType: AuditEventType;
  previousState?: string | null;
  newState?: string | null;
  message: string;
}

export function createAuditEvent(opts: AuditOptions) {
  return auditRepo.create({
    actorUserId: opts.actorUserId,
    entityType: opts.entityType,
    entityId: opts.entityId,
    eventType: opts.eventType,
    previousState: opts.previousState ?? null,
    newState: opts.newState ?? null,
    message: opts.message,
    createdAt: new Date().toISOString(),
  });
}

// Notification templates
export const notifTemplates = {
  taskAssigned(taskName: string, deadline: string): { title: string; body: string } {
    return {
      title: 'New Task Assigned',
      body: `You have been assigned "${taskName}". Deadline: ${deadline}.`,
    };
  },
  statusRequested(taskName: string): { title: string; body: string } {
    return {
      title: 'Status Update Requested',
      body: `Your manager has requested an update on "${taskName}".`,
    };
  },
  statusResponseReceived(employeeName: string, taskName: string): { title: string; body: string } {
    return {
      title: 'Status Response Received',
      body: `${employeeName} has responded to your status request on "${taskName}".`,
    };
  },
  queryCreated(employeeName: string, taskName: string): { title: string; body: string } {
    return {
      title: 'New Employee Query',
      body: `${employeeName} has raised a query regarding "${taskName}".`,
    };
  },
  queryAnswered(taskName: string): { title: string; body: string } {
    return {
      title: 'Your Query Has Been Answered',
      body: `Your manager has responded to your query on "${taskName}".`,
    };
  },
  queryResolved(taskName: string): { title: string; body: string } {
    return {
      title: 'Query Resolved',
      body: `Your query on "${taskName}" has been marked as resolved.`,
    };
  },
  taskSubmitted(employeeName: string, taskName: string): { title: string; body: string } {
    return {
      title: 'Task Submitted for Review',
      body: `${employeeName} has submitted "${taskName}" for review.`,
    };
  },
  taskApproved(taskName: string): { title: string; body: string } {
    return {
      title: 'Task Approved',
      body: `Your submission for "${taskName}" has been approved.`,
    };
  },
  revisionRequested(taskName: string): { title: string; body: string } {
    return {
      title: 'Revision Requested',
      body: `The manager has requested a revision for "${taskName}".`,
    };
  },
  deadlineChanged(taskName: string, deadline: string): { title: string; body: string } {
    return {
      title: 'Task Deadline Updated',
      body: `The deadline for "${taskName}" has changed to ${deadline}.`,
    };
  },
  blockerReported(employeeName: string, taskName: string): { title: string; body: string } {
    return {
      title: 'Blocker Reported',
      body: `${employeeName} has reported a blocker on "${taskName}".`,
    };
  },
  blockerResolved(employeeName: string, taskName: string): { title: string; body: string } {
    return {
      title: 'Blocker Resolved',
      body: `${employeeName} has resolved the blocker on "${taskName}".`,
    };
  },
  groupMemberSubmitted(
    employeeName: string,
    taskName: string
  ): { title: string; body: string } {
    return {
      title: 'Group Member Submitted',
      body: `${employeeName} has submitted their part of "${taskName}".`,
    };
  },
  groupReadyForReview(taskName: string): { title: string; body: string } {
    return {
      title: 'Group Task Ready for Review',
      body: `All members of "${taskName}" have submitted. Ready for review.`,
    };
  },
  taskCancelled(taskName: string): { title: string; body: string } {
    return {
      title: 'Task Cancelled',
      body: `The task "${taskName}" has been cancelled by the administrator.`,
    };
  },
  taskUpdated(taskName: string): { title: string; body: string } {
    return {
      title: 'Task Updated',
      body: `The task "${taskName}" has been updated.`,
    };
  },
};

