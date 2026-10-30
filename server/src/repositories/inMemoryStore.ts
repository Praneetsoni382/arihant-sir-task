// ============================================================
// IN-MEMORY DEVELOPMENT REPOSITORY
// File: server/src/repositories/inMemoryStore.ts
//
// This is a prototype data store. It maintains data in memory
// during server runtime. Data resets on server restart.
// Replace with Firebase Firestore by swapping this module.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import type {
  User,
  Task,
  TaskMember,
  StatusRequest,
  StatusResponse,
  Query,
  QueryMessage,
  ChatMessage,
  Notification,
  AuditEvent,
  ReminderOccurrence,
} from '../types/index.js';

// ============================================================
// STORE STRUCTURE
// ============================================================

interface Store {
  users: User[];
  tasks: Task[];
  taskMembers: TaskMember[];
  statusRequests: StatusRequest[];
  statusResponses: StatusResponse[];
  queries: Query[];
  queryMessages: QueryMessage[];
  chatMessages: ChatMessage[];
  notifications: Notification[];
  auditEvents: AuditEvent[];
  reminderOccurrences: ReminderOccurrence[];
  taskCounter: number;
}

const store: Store = {
  users: [],
  tasks: [],
  taskMembers: [],
  statusRequests: [],
  statusResponses: [],
  queries: [],
  queryMessages: [],
  chatMessages: [],
  notifications: [],
  auditEvents: [],
  reminderOccurrences: [],
  taskCounter: 1000,
};

// ============================================================
// HELPER: Generate task reference number
// ============================================================
export function nextTaskRef(): string {
  store.taskCounter += 1;
  return `TK-${store.taskCounter}`;
}

export function newId(): string {
  return uuidv4();
}

// ============================================================
// SEED DATA
// ============================================================

export async function seedStore(): Promise<void> {
  const now = new Date().toISOString();

  const adminHash = await bcrypt.hash('Admin@2024!', 10);
  const emp1Hash = await bcrypt.hash('Emp@56789', 10);
  const emp2Hash = await bcrypt.hash('Emp@34512', 10);
  const emp3Hash = await bcrypt.hash('Emp@78234', 10);
  const emp4Hash = await bcrypt.hash('Emp@91823', 10);

  const admin: User = {
    id: 'usr-admin-001',
    employeeId: 'ADM-001',
    fullName: 'Arihant Sharma',
    email: 'admin@company.com',
    department: 'Administration',
    designation: 'System Administrator',
    role: 'admin',
    active: true,
    passwordHash: adminHash,
    createdAt: now,
    updatedAt: now,
  };

  const emp1: User = {
    id: 'usr-emp-001',
    employeeId: 'EMP-001',
    fullName: 'Priya Mehta',
    email: 'priya.mehta@company.com',
    department: 'Engineering',
    designation: 'Software Engineer',
    role: 'employee',
    active: true,
    passwordHash: emp1Hash,
    createdAt: now,
    updatedAt: now,
  };

  const emp2: User = {
    id: 'usr-emp-002',
    employeeId: 'EMP-002',
    fullName: 'Rahul Gupta',
    email: 'rahul.gupta@company.com',
    department: 'Engineering',
    designation: 'Senior Developer',
    role: 'employee',
    active: true,
    passwordHash: emp2Hash,
    createdAt: now,
    updatedAt: now,
  };

  const emp3: User = {
    id: 'usr-emp-003',
    employeeId: 'EMP-003',
    fullName: 'Sneha Patel',
    email: 'sneha.patel@company.com',
    department: 'Sales',
    designation: 'Sales Executive',
    role: 'employee',
    active: true,
    passwordHash: emp3Hash,
    createdAt: now,
    updatedAt: now,
  };

  const emp4: User = {
    id: 'usr-emp-004',
    employeeId: 'EMP-004',
    fullName: 'Vikram Nair',
    email: 'vikram.nair@company.com',
    department: 'Operations',
    designation: 'Operations Manager',
    role: 'employee',
    active: true,
    passwordHash: emp4Hash,
    createdAt: now,
    updatedAt: now,
  };

  store.users.push(admin, emp1, emp2, emp3, emp4);

  // Seed a few demo tasks
  const task1Id = 'task-demo-001';
  const task2Id = 'task-demo-002';
  const task3Id = 'task-demo-003';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const task1: Task = {
    id: task1Id,
    referenceNumber: 'TK-1001',
    title: 'Implement User Authentication Module',
    description:
      'Design and implement secure JWT-based authentication with role-based access control for the main application.',
    assignmentType: 'solo',
    priority: 'high',
    status: 'in_progress',
    category: 'Development',
    department: 'Engineering',
    deadline: nextWeek.toISOString(),
    startDate: now,
    timezone: 'Asia/Kolkata',
    reminderEnabled: true,
    reminderTimes: ['12:00', '15:00'],
    managerNote: 'Follow the security guidelines in the internal wiki.',
    createdBy: 'usr-admin-001',
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
  };
  store.taskCounter = 1001;

  const task2: Task = {
    id: task2Id,
    referenceNumber: 'TK-1002',
    title: 'Q4 Sales Target Report',
    description:
      'Compile and analyze Q4 sales data, prepare presentation for board meeting.',
    assignmentType: 'solo',
    priority: 'critical',
    status: 'pending',
    category: 'Reporting',
    department: 'Sales',
    deadline: tomorrow.toISOString(),
    startDate: null,
    timezone: 'Asia/Kolkata',
    reminderEnabled: true,
    reminderTimes: ['09:00', '14:00'],
    managerNote: '',
    createdBy: 'usr-admin-001',
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
  };
  store.taskCounter = 1002;

  const task3: Task = {
    id: task3Id,
    referenceNumber: 'TK-1003',
    title: 'Platform Feature Roadmap Planning',
    description:
      'Collaborate on defining the next quarter feature roadmap based on customer feedback and strategic priorities.',
    assignmentType: 'group',
    priority: 'medium',
    status: 'in_progress',
    category: 'Planning',
    department: 'Engineering',
    deadline: nextWeek.toISOString(),
    startDate: now,
    timezone: 'Asia/Kolkata',
    reminderEnabled: true,
    reminderTimes: ['12:00', '15:00'],
    managerNote: 'Coordinate with product team.',
    createdBy: 'usr-admin-001',
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
  };
  store.taskCounter = 1003;

  store.tasks.push(task1, task2, task3);

  // Task members
  const member1: TaskMember = {
    id: 'tm-001',
    taskId: task1Id,
    userId: 'usr-emp-001',
    memberStatus: 'in_progress',
    submissionNote: '',
    submittedAt: null,
    approvedAt: null,
    revisionRequestedAt: null,
    revisionReason: '',
    lastStatusUpdateAt: now,
    reminderEligible: true,
  };

  const member2: TaskMember = {
    id: 'tm-002',
    taskId: task2Id,
    userId: 'usr-emp-003',
    memberStatus: 'pending',
    submissionNote: '',
    submittedAt: null,
    approvedAt: null,
    revisionRequestedAt: null,
    revisionReason: '',
    lastStatusUpdateAt: now,
    reminderEligible: true,
  };

  const member3: TaskMember = {
    id: 'tm-003',
    taskId: task3Id,
    userId: 'usr-emp-001',
    memberStatus: 'in_progress',
    submissionNote: '',
    submittedAt: null,
    approvedAt: null,
    revisionRequestedAt: null,
    revisionReason: '',
    lastStatusUpdateAt: now,
    reminderEligible: true,
  };

  const member4: TaskMember = {
    id: 'tm-004',
    taskId: task3Id,
    userId: 'usr-emp-002',
    memberStatus: 'pending',
    submissionNote: '',
    submittedAt: null,
    approvedAt: null,
    revisionRequestedAt: null,
    revisionReason: '',
    lastStatusUpdateAt: now,
    reminderEligible: true,
  };

  store.taskMembers.push(member1, member2, member3, member4);

  // Seed audit events
  store.auditEvents.push(
    {
      id: newId(),
      actorUserId: 'usr-admin-001',
      entityType: 'task',
      entityId: task1Id,
      eventType: 'TASK_CREATED',
      previousState: null,
      newState: 'pending',
      message: 'Task created and assigned to Priya Mehta',
      createdAt: now,
    },
    {
      id: newId(),
      actorUserId: 'usr-admin-001',
      entityType: 'task',
      entityId: task2Id,
      eventType: 'TASK_CREATED',
      previousState: null,
      newState: 'pending',
      message: 'Task created and assigned to Sneha Patel',
      createdAt: now,
    },
    {
      id: newId(),
      actorUserId: 'usr-admin-001',
      entityType: 'task',
      entityId: task3Id,
      eventType: 'TASK_CREATED',
      previousState: null,
      newState: 'pending',
      message: 'Group task created and assigned to Priya Mehta, Rahul Gupta',
      createdAt: now,
    }
  );

  console.log('[Seed] In-memory store populated with demo data.');
}

// ============================================================
// USER REPOSITORY
// ============================================================

export const userRepo = {
  findAll(): User[] {
    return store.users;
  },
  findById(id: string): User | undefined {
    return store.users.find((u) => u.id === id);
  },
  findByEmail(email: string): User | undefined {
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  findByEmployeeId(employeeId: string): User | undefined {
    return store.users.find((u) => u.employeeId === employeeId);
  },
  create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const now = new Date().toISOString();
    const user: User = { ...data, id: newId(), createdAt: now, updatedAt: now };
    store.users.push(user);
    return user;
  },
  update(id: string, data: Partial<User>): User | undefined {
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    store.users[idx] = { ...store.users[idx], ...data, updatedAt: new Date().toISOString() };
    return store.users[idx];
  },
};

// ============================================================
// TASK REPOSITORY
// ============================================================

export const taskRepo = {
  findAll(): Task[] {
    return store.tasks;
  },
  findById(id: string): Task | undefined {
    return store.tasks.find((t) => t.id === id);
  },
  findByMember(userId: string): Task[] {
    const memberTaskIds = store.taskMembers
      .filter((tm) => tm.userId === userId)
      .map((tm) => tm.taskId);
    return store.tasks.filter((t) => memberTaskIds.includes(t.id));
  },
  create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const now = new Date().toISOString();
    const task: Task = { ...data, id: newId(), createdAt: now, updatedAt: now };
    store.tasks.push(task);
    return task;
  },
  update(id: string, data: Partial<Task>): Task | undefined {
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    store.tasks[idx] = { ...store.tasks[idx], ...data, updatedAt: new Date().toISOString() };
    return store.tasks[idx];
  },
};

// ============================================================
// TASK MEMBER REPOSITORY
// ============================================================

export const taskMemberRepo = {
  findByTask(taskId: string): TaskMember[] {
    return store.taskMembers.filter((tm) => tm.taskId === taskId);
  },
  findByUser(userId: string): TaskMember[] {
    return store.taskMembers.filter((tm) => tm.userId === userId);
  },
  findById(id: string): TaskMember | undefined {
    return store.taskMembers.find((tm) => tm.id === id);
  },
  findByTaskAndUser(taskId: string, userId: string): TaskMember | undefined {
    return store.taskMembers.find((tm) => tm.taskId === taskId && tm.userId === userId);
  },
  create(data: Omit<TaskMember, 'id'>): TaskMember {
    const member: TaskMember = { ...data, id: newId() };
    store.taskMembers.push(member);
    return member;
  },
  update(id: string, data: Partial<TaskMember>): TaskMember | undefined {
    const idx = store.taskMembers.findIndex((tm) => tm.id === id);
    if (idx === -1) return undefined;
    store.taskMembers[idx] = { ...store.taskMembers[idx], ...data };
    return store.taskMembers[idx];
  },
};

// ============================================================
// STATUS REQUEST REPOSITORY
// ============================================================

export const statusRequestRepo = {
  findAll(): StatusRequest[] {
    return store.statusRequests;
  },
  findById(id: string): StatusRequest | undefined {
    return store.statusRequests.find((sr) => sr.id === id);
  },
  findByTask(taskId: string): StatusRequest[] {
    return store.statusRequests.filter((sr) => sr.taskId === taskId);
  },
  findByRecipient(userId: string): StatusRequest[] {
    return store.statusRequests.filter((sr) => sr.recipientUserId === userId);
  },
  create(data: Omit<StatusRequest, 'id'>): StatusRequest {
    const sr: StatusRequest = { ...data, id: newId() };
    store.statusRequests.push(sr);
    return sr;
  },
  update(id: string, data: Partial<StatusRequest>): StatusRequest | undefined {
    const idx = store.statusRequests.findIndex((sr) => sr.id === id);
    if (idx === -1) return undefined;
    store.statusRequests[idx] = { ...store.statusRequests[idx], ...data };
    return store.statusRequests[idx];
  },
};

// ============================================================
// STATUS RESPONSE REPOSITORY
// ============================================================

export const statusResponseRepo = {
  findByRequest(requestId: string): StatusResponse[] {
    return store.statusResponses.filter((sr) => sr.statusRequestId === requestId);
  },
  findByRequests(requestIds: string[]): StatusResponse[] {
    return store.statusResponses.filter((sr) => requestIds.includes(sr.statusRequestId));
  },
  create(data: Omit<StatusResponse, 'id'>): StatusResponse {
    const sr: StatusResponse = { ...data, id: newId() };
    store.statusResponses.push(sr);
    return sr;
  },
};

// ============================================================
// QUERY REPOSITORY
// ============================================================

export const queryRepo = {
  findAll(): Query[] {
    return store.queries;
  },
  findById(id: string): Query | undefined {
    return store.queries.find((q) => q.id === id);
  },
  findByTask(taskId: string): Query[] {
    return store.queries.filter((q) => q.taskId === taskId);
  },
  findByUser(userId: string): Query[] {
    return store.queries.filter((q) => q.createdBy === userId);
  },
  create(data: Omit<Query, 'id' | 'createdAt' | 'updatedAt'>): Query {
    const now = new Date().toISOString();
    const query: Query = { ...data, id: newId(), createdAt: now, updatedAt: now };
    store.queries.push(query);
    return query;
  },
  update(id: string, data: Partial<Query>): Query | undefined {
    const idx = store.queries.findIndex((q) => q.id === id);
    if (idx === -1) return undefined;
    store.queries[idx] = { ...store.queries[idx], ...data, updatedAt: new Date().toISOString() };
    return store.queries[idx];
  },
};

// ============================================================
// QUERY MESSAGE REPOSITORY
// ============================================================

export const queryMessageRepo = {
  findByQuery(queryId: string): QueryMessage[] {
    return store.queryMessages
      .filter((qm) => qm.queryId === queryId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  create(data: Omit<QueryMessage, 'id'>): QueryMessage {
    const qm: QueryMessage = { ...data, id: newId() };
    store.queryMessages.push(qm);
    return qm;
  },
};

// ============================================================
// CHAT MESSAGE REPOSITORY
// ============================================================

export const chatMessageRepo = {
  findByTask(taskId: string): ChatMessage[] {
    return store.chatMessages
      .filter((cm) => cm.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  create(data: Omit<ChatMessage, 'id'>): ChatMessage {
    const cm: ChatMessage = { ...data, id: newId() };
    store.chatMessages.push(cm);
    return cm;
  },
};

// ============================================================
// NOTIFICATION REPOSITORY
// ============================================================

export const notificationRepo = {
  findByRecipient(userId: string): Notification[] {
    return store.notifications
      .filter((n) => n.recipientUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  findById(id: string): Notification | undefined {
    return store.notifications.find((n) => n.id === id);
  },
  create(data: Omit<Notification, 'id'>): Notification {
    const n: Notification = { ...data, id: newId() };
    store.notifications.push(n);
    return n;
  },
  update(id: string, data: Partial<Notification>): Notification | undefined {
    const idx = store.notifications.findIndex((n) => n.id === id);
    if (idx === -1) return undefined;
    store.notifications[idx] = { ...store.notifications[idx], ...data };
    return store.notifications[idx];
  },
  markAllRead(userId: string): void {
    const now = new Date().toISOString();
    store.notifications
      .filter((n) => n.recipientUserId === userId && !n.readAt)
      .forEach((n) => {
        n.readAt = now;
        n.deliveryState = 'read';
      });
  },
};

// ============================================================
// AUDIT EVENT REPOSITORY
// ============================================================

export const auditRepo = {
  findByEntity(entityId: string): AuditEvent[] {
    return store.auditEvents
      .filter((e) => e.entityId === entityId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  findAll(): AuditEvent[] {
    return [...store.auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  create(data: Omit<AuditEvent, 'id'>): AuditEvent {
    const event: AuditEvent = { ...data, id: newId() };
    store.auditEvents.push(event);
    return event;
  },
};

// ============================================================
// REMINDER OCCURRENCE REPOSITORY
// ============================================================

export const reminderRepo = {
  findAll(): ReminderOccurrence[] {
    return store.reminderOccurrences;
  },
  findByTaskAndUser(taskId: string, userId: string): ReminderOccurrence[] {
    return store.reminderOccurrences.filter(
      (r) => r.taskId === taskId && r.recipientUserId === userId
    );
  },
  create(data: Omit<ReminderOccurrence, 'id'>): ReminderOccurrence {
    const r: ReminderOccurrence = { ...data, id: newId() };
    store.reminderOccurrences.push(r);
    return r;
  },
  update(id: string, data: Partial<ReminderOccurrence>): ReminderOccurrence | undefined {
    const idx = store.reminderOccurrences.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    store.reminderOccurrences[idx] = { ...store.reminderOccurrences[idx], ...data };
    return store.reminderOccurrences[idx];
  },
};

