// ============================================================
// SHARED TYPES — Enterprise Task Management Platform
// ============================================================

export type UserRole = 'admin' | 'employee';
export type TaskAssignmentType = 'solo' | 'group';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'submitted_for_review'
  | 'revision_requested'
  | 'approved'
  | 'cancelled';

export type MemberStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'submitted_for_review'
  | 'revision_requested'
  | 'approved';

export type QueryCategory =
  | 'clarification'
  | 'blocker'
  | 'dependency'
  | 'deadline_concern'
  | 'assignment_issue'
  | 'technical_issue'
  | 'other';

export type QueryPriority = 'low' | 'medium' | 'high';
export type QueryStatus = 'open' | 'answered' | 'resolved' | 'reopened';

export type StatusRequestStatus = 'pending' | 'answered';

export type NotificationEventType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'DEADLINE_CHANGED'
  | 'TASK_REASSIGNED'
  | 'TASK_CANCELLED'
  | 'STATUS_REQUESTED'
  | 'STATUS_RESPONSE_RECEIVED'
  | 'QUERY_CREATED'
  | 'QUERY_ANSWERED'
  | 'QUERY_RESOLVED'
  | 'BLOCKER_REPORTED'
  | 'BLOCKER_RESOLVED'
  | 'TASK_SUBMITTED'
  | 'TASK_APPROVED'
  | 'REVISION_REQUESTED'
  | 'REMINDER_DUE'
  | 'TASK_OVERDUE'
  | 'GROUP_MEMBER_SUBMITTED'
  | 'GROUP_READY_FOR_REVIEW'
  | 'CHAT_MESSAGE_RECEIVED';

export type AuditEventType =
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_CANCELLED'
  | 'STATUS_CHANGED'
  | 'MEMBER_SUBMITTED'
  | 'MEMBER_APPROVED'
  | 'REVISION_REQUESTED'
  | 'STATUS_REQUEST_SENT'
  | 'STATUS_RESPONSE_GIVEN'
  | 'QUERY_CREATED'
  | 'QUERY_ANSWERED'
  | 'QUERY_RESOLVED'
  | 'QUERY_REOPENED'
  | 'BLOCKER_REPORTED'
  | 'BLOCKER_RESOLVED'
  | 'DEADLINE_CHANGED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_STATUS_CHANGED'
  | 'CHAT_MESSAGE_SENT';

// ============================================================
// ENTITIES
// ============================================================

export interface User {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  role: UserRole;
  active: boolean;
  passwordHash: string;
  initialPassword?: string;
  currentPasswordPlain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  assignmentType: TaskAssignmentType;
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  department: string;
  deadline: string;
  startDate: string | null;
  timezone: string;
  reminderEnabled: boolean;
  reminderTimes: string[];
  managerNote: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  meetingId?: string | null;
}

export interface TaskMember {
  id: string;
  taskId: string;
  userId: string;
  memberStatus: MemberStatus;
  submissionNote: string;
  submittedAt: string | null;
  approvedAt: string | null;
  revisionRequestedAt: string | null;
  revisionReason: string;
  lastStatusUpdateAt: string;
  reminderEligible: boolean;
}

export interface StatusRequest {
  id: string;
  taskId: string;
  createdBy: string;
  recipientUserId: string;
  question: string;
  status: StatusRequestStatus;
  createdAt: string;
  responseDeadline: string | null;
  meetingId?: string | null;
}

export interface StatusResponse {
  id: string;
  statusRequestId: string;
  responderUserId: string;
  responseText: string;
  createdAt: string;
}

export interface Query {
  id: string;
  taskId: string;
  createdBy: string;
  title: string;
  description: string;
  category: QueryCategory;
  priority: QueryPriority;
  status: QueryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface QueryMessage {
  id: string;
  queryId: string;
  senderUserId: string;
  message: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  taskId: string;
  senderUserId: string;
  message: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  recipientUserId: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  relatedTaskId: string | null;
  relatedQueryId: string | null;
  relatedStatusRequestId: string | null;
  readAt: string | null;
  createdAt: string;
  deliveryState: 'pending' | 'delivered' | 'read';
  navigationUrl: string | null;
  pushStatus?: 'pending' | 'sent' | 'failed' | 'no_active_devices' | 'skipped';
  pushSentAt?: string | null;
  pushErrorCode?: string | null;
}

export interface Device {
  deviceId: string;
  userId: string;
  fcmToken: string;
  platform: 'WEB';
  browserName: string;
  userAgent: string;
  permissionStatus: 'default' | 'granted' | 'denied';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  lastSuccessfulSendAt: string | null;
  lastErrorAt: string | null;
  tokenVersion: string;
}

export interface PushPreferences {
  userId: string;
  enabled: boolean;
  categories: {
    taskAssignments: boolean;
    statusRequests: boolean;
    queries: boolean;
    reminders: boolean;
    messages: boolean;
    approvals: boolean;
  };
  updatedAt: string;
}

export interface ReminderOccurrence {
  id: string;
  taskId: string;
  recipientUserId: string;
  scheduledFor: string;
  timezone: string;
  reminderType: 'submission' | 'deadline' | 'overdue';
  status: 'pending' | 'delivered' | 'skipped';
  skippedReason: string | null;
}

export interface AuditEvent {
  id: string;
  actorUserId: string;
  entityType: 'task' | 'user' | 'query' | 'status_request' | 'chat';
  entityId: string;
  eventType: AuditEventType;
  previousState: string | null;
  newState: string | null;
  message: string;
  createdAt: string;
}

export type MeetingStatus = 'draft' | 'scheduled' | 'cancelled';

export interface Meeting {
  id: string;
  statusRequestId: string;
  taskId: string;
  createdByAdminUid: string;
  googleSpaceName?: string;
  meetingUri: string;
  meetingTitle: string;
  description?: string;
  status: MeetingStatus;
  createdAt: string;
  scheduledAt?: string | null;
  timezone: string; // 'Asia/Kolkata' (IST)
  publishedAt?: string | null;
  updatedAt: string;
  cancelledAt?: string | null;
}

export interface GoogleAuthTokens {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  email?: string;
  updatedAt: string;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Safe user (no password hash)
export type SafeUser = Omit<User, 'passwordHash'>;

// Task with members populated
export interface TaskWithMembers extends Task {
  members: Array<TaskMember & { user: SafeUser }>;
}

// Dashboard data
export interface AdminDashboardData {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  submittedForReview: number;
  activeQueries: number;
  recentTasks: TaskWithMembers[];
  approachingDeadlines: TaskWithMembers[];
  overdueTasks: TaskWithMembers[];
  openQueries: Query[];
  recentSubmissions: Array<TaskMember & { task: Task; user: SafeUser }>;
}

export interface EmployeeDashboardData {
  totalAssigned: number;
  inProgress: number;
  submitted: number;
  approved: number;
  myTasks: TaskWithMembers[];
  pendingStatusRequests: Array<StatusRequest & { task: Task }>;
  openQueries: Query[];
  recentNotifications: Notification[];
}

