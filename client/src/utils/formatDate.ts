import { format, parseISO } from 'date-fns';

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = parseISO(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export function isOverdue(deadlineStr: string | null | undefined): boolean {
  if (!deadlineStr) return false;
  try {
    return parseISO(deadlineStr) < new Date();
  } catch {
    return false;
  }
}

