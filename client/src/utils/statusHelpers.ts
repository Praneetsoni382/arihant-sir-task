import type { TaskStatus, MemberStatus, TaskPriority, QueryStatus } from '../types';

export function getStatusLabel(status: TaskStatus | MemberStatus | string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    submitted_for_review: 'Submitted for Review',
    revision_requested: 'Revision Requested',
    approved: 'Approved',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status;
}

export function getStatusColors(status: string): { bg: string; text: string; border: string } {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: '#FFF8E7', text: '#C58A20', border: '#F5D87E' },
    in_progress: { bg: '#EBF3FF', text: '#3157A4', border: '#B8D0F5' },
    blocked: { bg: '#FFF0F0', text: '#D64545', border: '#F5B8B8' },
    submitted_for_review: { bg: '#F0F9FF', text: '#3977C3', border: '#B8DDFB' },
    revision_requested: { bg: '#FFF4EC', text: '#C07020', border: '#F5CCA0' },
    approved: { bg: '#EDFAF4', text: '#16865B', border: '#A8DFC5' },
    cancelled: { bg: '#F5F7FA', text: '#667085', border: '#E4E8EF' },
    open: { bg: '#EBF3FF', text: '#3157A4', border: '#B8D0F5' },
    answered: { bg: '#EDFAF4', text: '#16865B', border: '#A8DFC5' },
    resolved: { bg: '#F5F7FA', text: '#667085', border: '#E4E8EF' },
    reopened: { bg: '#FFF0F0', text: '#D64545', border: '#F5B8B8' },
  };
  return map[status] ?? { bg: '#F5F7FA', text: '#667085', border: '#E4E8EF' };
}

export function getPriorityLabel(priority: TaskPriority | string): string {
  const labels: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return labels[priority] ?? priority;
}

export function getPriorityColors(priority: TaskPriority | string): { bg: string; text: string; border: string } {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    low: { bg: '#F5F7FA', text: '#667085', border: '#E4E8EF' },
    medium: { bg: '#EBF3FF', text: '#3157A4', border: '#B8D0F5' },
    high: { bg: '#FFF4EC', text: '#C07020', border: '#F5CCA0' },
    critical: { bg: '#FFF0F0', text: '#D64545', border: '#F5B8B8' },
  };
  return map[priority] ?? { bg: '#F5F7FA', text: '#667085', border: '#E4E8EF' };
}

export function getQueryStatusLabel(status: QueryStatus | string): string {
  const labels: Record<string, string> = {
    open: 'Open',
    answered: 'Answered',
    resolved: 'Resolved',
    reopened: 'Reopened',
  };
  return labels[status] ?? status;
}

