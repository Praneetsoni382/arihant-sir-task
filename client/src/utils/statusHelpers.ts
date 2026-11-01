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
    pending: { bg: '#FFF8E7', text: '#D97706', border: '#FDE4A8' },
    in_progress: { bg: '#EAF2FF', text: '#2458D3', border: '#CDE0FD' },
    blocked: { bg: '#FFF0F1', text: '#E34D59', border: '#F8C8CD' },
    submitted_for_review: { bg: '#F3F0FF', text: '#7464E8', border: '#E2D8FF' },
    revision_requested: { bg: '#FFF5EB', text: '#EA580C', border: '#FED7AA' },
    approved: { bg: '#EBF9F3', text: '#159B70', border: '#BBEBD6' },
    cancelled: { bg: '#F1F4FC', text: '#687894', border: '#E4EBF7' },
    open: { bg: '#EAF2FF', text: '#2458D3', border: '#CDE0FD' },
    answered: { bg: '#EBF9F3', text: '#159B70', border: '#BBEBD6' },
    resolved: { bg: '#F1F4FC', text: '#687894', border: '#E4EBF7' },
    reopened: { bg: '#FFF0F1', text: '#E34D59', border: '#F8C8CD' },
  };
  return map[status] ?? { bg: '#F1F4FC', text: '#687894', border: '#E4EBF7' };
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
    low: { bg: '#F1F4FC', text: '#687894', border: '#E4EBF7' },
    medium: { bg: '#EAF2FF', text: '#2458D3', border: '#CDE0FD' },
    high: { bg: '#FFF5EB', text: '#EA580C', border: '#FED7AA' },
    critical: { bg: '#FFF0F1', text: '#E34D59', border: '#F8C8CD' },
  };
  return map[priority] ?? { bg: '#F1F4FC', text: '#687894', border: '#E4EBF7' };
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

