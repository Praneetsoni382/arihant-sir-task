// ============================================================
// IN-MEMORY DEVELOPMENT REPOSITORY
// File: server/src/repositories/inMemoryStore.ts
//
// This is a prototype data store. It maintains data in memory
// during server runtime. Data resets on server restart.
// Replace with Firebase Firestore by swapping this module.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { firestoreDb } from '../firebase.js';
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

// Persistence path
const dataDir = path.resolve(process.cwd(), '.data');
const snapshotPath = path.resolve(dataDir, 'app-store.json');

function persistSnapshot(): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(snapshotPath, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ Could not save local store snapshot:', err);
  }
}

async function syncToFirestore(collection: string, docId: string, data: any): Promise<void> {
  try {
    await firestoreDb.docSet(collection, docId, data);
  } catch (err) {
    console.warn(`Firestore sync notice (${collection}/${docId}):`, err instanceof Error ? err.message : err);
  }
}

// ============================================================
// HELPER: Generate task reference number
// ============================================================
export function nextTaskRef(): string {
  store.taskCounter += 1;
  persistSnapshot();
  return `TK-${store.taskCounter}`;
}

export function newId(): string {
  return uuidv4();
}

// ============================================================
// SEED DATA
// ============================================================

export async function seedStore(forceReset = false): Promise<void> {
  if (forceReset) {
    store.users = [];
    store.tasks = [];
    store.taskMembers = [];
    store.statusRequests = [];
    store.statusResponses = [];
    store.queries = [];
    store.queryMessages = [];
    store.chatMessages = [];
    store.notifications = [];
    store.auditEvents = [];
    store.reminderOccurrences = [];
    store.taskCounter = 1000;
  }

  // 1. Try to load authoritative records from Firestore if available
  if (!forceReset) {
    try {
      const usersData = await firestoreDb.collectionGetAll('users');
      if (usersData && usersData.length > 0) {
        console.log(`🔥 Synchronizing authoritative users from Cloud Firestore...`);
        // Purge dummy demo users from Firestore load
        const demoEmails = ['priya.mehta@company.com', 'rahul.gupta@company.com', 'sneha.patel@company.com', 'vikram.nair@company.com'];
        store.users = (usersData as User[])
          .filter((u) => u && u.email && u.id && !demoEmails.includes(u.email) && !u.id.startsWith('usr-emp-'));

        const tasksData = await firestoreDb.collectionGetAll('tasks');
        store.tasks = (tasksData as Task[])
          .filter((t) => t && t.id && !t.id.startsWith('task-demo-'));

        const membersData = await firestoreDb.collectionGetAll('taskMembers');
        store.taskMembers = (membersData as TaskMember[])
          .filter((m) => m && m.id && !m.id.startsWith('tm-'));

        const srData = await firestoreDb.collectionGetAll('statusRequests');
        store.statusRequests = srData as StatusRequest[];

        const queriesData = await firestoreDb.collectionGetAll('queries');
        store.queries = queriesData as Query[];

        const notifData = await firestoreDb.collectionGetAll('notifications');
        store.notifications = notifData as Notification[];

        const auditData = await firestoreDb.collectionGetAll('auditEvents');
        if (auditData.length > 0) {
          store.auditEvents = auditData as AuditEvent[];
        }

        // Ensure single admin exists
        const hasAdmin = store.users.some((u) => u.role === 'admin' && u.email === 'admin@company.com');
        if (hasAdmin) {
          persistSnapshot();
          console.log(`✅ Loaded ${store.users.length} active users and ${store.tasks.length} tasks from Cloud Firestore.`);
          return;
        }
      }
    } catch (fsErr) {
      console.warn('ℹ️ Firestore read notice:', fsErr instanceof Error ? fsErr.message : fsErr);
    }
  }

  // 2. Try to restore from persistent disk snapshot
  if (!forceReset && fs.existsSync(snapshotPath)) {
    try {
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      if (snapshot.users && snapshot.users.length > 0) {
        const demoEmails = ['priya.mehta@company.com', 'rahul.gupta@company.com', 'sneha.patel@company.com', 'vikram.nair@company.com'];
        snapshot.users = snapshot.users.filter((u: User) => !demoEmails.includes(u.email) && !u.id.startsWith('usr-emp-'));
        snapshot.tasks = (snapshot.tasks || []).filter((t: Task) => !t.id.startsWith('task-demo-'));
        snapshot.taskMembers = (snapshot.taskMembers || []).filter((m: TaskMember) => !m.id.startsWith('tm-'));
        Object.assign(store, snapshot);
        
        const hasAdmin = store.users.some((u) => u.role === 'admin' && u.email === 'admin@company.com');
        if (hasAdmin) {
          console.log(`📦 Restored ${store.users.length} users and ${store.tasks.length} tasks from local persistence.`);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read snapshot file, falling back to seed');
    }
  }

  // 3. Initial Seed: Single Authoritative Administrator Account Only
  const now = new Date().toISOString();
  const adminHash = await bcrypt.hash('Admin@2024!', 10);

  const admin: User = {
    id: 'usr-admin-001',
    employeeId: 'ADM-001',
    fullName: 'System Administrator',
    email: 'admin@company.com',
    department: 'Administration',
    designation: 'Administrator',
    role: 'admin',
    active: true,
    passwordHash: adminHash,
    createdAt: now,
    updatedAt: now,
  };

  store.users = [admin];
  store.tasks = [];
  store.taskMembers = [];
  store.statusRequests = [];
  store.statusResponses = [];
  store.queries = [];
  store.queryMessages = [];
  store.chatMessages = [];
  store.notifications = [];
  store.auditEvents = [];
  store.reminderOccurrences = [];
  store.taskCounter = 1000;

  // Persist snapshot to disk
  persistSnapshot();

  // Sync the single authoritative administrator to Firestore
  syncToFirestore('users', admin.id, admin);

  console.log('[Seed] Database initialized with single Administrator account (admin@company.com). All dummy data purged.');
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
    persistSnapshot();
    syncToFirestore('users', user.id, user);
    return user;
  },
  update(id: string, data: Partial<User>): User | undefined {
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    store.users[idx] = { ...store.users[idx], ...data, updatedAt: new Date().toISOString() };
    persistSnapshot();
    syncToFirestore('users', id, store.users[idx]);
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
    persistSnapshot();
    syncToFirestore('tasks', task.id, task);
    return task;
  },
  update(id: string, data: Partial<Task>): Task | undefined {
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    store.tasks[idx] = { ...store.tasks[idx], ...data, updatedAt: new Date().toISOString() };
    persistSnapshot();
    syncToFirestore('tasks', id, store.tasks[idx]);
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
    persistSnapshot();
    syncToFirestore('taskMembers', member.id, member);
    syncToFirestore(`tasks/${member.taskId}/members`, member.id, member);
    return member;
  },
  update(id: string, data: Partial<TaskMember>): TaskMember | undefined {
    const idx = store.taskMembers.findIndex((tm) => tm.id === id);
    if (idx === -1) return undefined;
    store.taskMembers[idx] = { ...store.taskMembers[idx], ...data };
    persistSnapshot();
    syncToFirestore('taskMembers', id, store.taskMembers[idx]);
    syncToFirestore(`tasks/${store.taskMembers[idx].taskId}/members`, id, store.taskMembers[idx]);
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
    persistSnapshot();
    syncToFirestore('statusRequests', sr.id, sr);
    return sr;
  },
  update(id: string, data: Partial<StatusRequest>): StatusRequest | undefined {
    const idx = store.statusRequests.findIndex((sr) => sr.id === id);
    if (idx === -1) return undefined;
    store.statusRequests[idx] = { ...store.statusRequests[idx], ...data };
    persistSnapshot();
    syncToFirestore('statusRequests', id, store.statusRequests[idx]);
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
    persistSnapshot();
    syncToFirestore('statusResponses', sr.id, sr);
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
    persistSnapshot();
    syncToFirestore('queries', query.id, query);
    return query;
  },
  update(id: string, data: Partial<Query>): Query | undefined {
    const idx = store.queries.findIndex((q) => q.id === id);
    if (idx === -1) return undefined;
    store.queries[idx] = { ...store.queries[idx], ...data, updatedAt: new Date().toISOString() };
    persistSnapshot();
    syncToFirestore('queries', id, store.queries[idx]);
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
    persistSnapshot();
    syncToFirestore('queryMessages', qm.id, qm);
    syncToFirestore(`queries/${qm.queryId}/messages`, qm.id, qm);
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
    persistSnapshot();
    syncToFirestore('chatMessages', cm.id, cm);
    syncToFirestore(`tasks/${cm.taskId}/messages`, cm.id, cm);
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
    persistSnapshot();
    syncToFirestore('notifications', n.id, n);
    return n;
  },
  update(id: string, data: Partial<Notification>): Notification | undefined {
    const idx = store.notifications.findIndex((n) => n.id === id);
    if (idx === -1) return undefined;
    store.notifications[idx] = { ...store.notifications[idx], ...data };
    persistSnapshot();
    syncToFirestore('notifications', id, store.notifications[idx]);
    return store.notifications[idx];
  },
  markAllRead(userId: string): void {
    const now = new Date().toISOString();
    store.notifications
      .filter((n) => n.recipientUserId === userId && !n.readAt)
      .forEach((n) => {
        n.readAt = now;
        n.deliveryState = 'read';
        syncToFirestore('notifications', n.id, n);
      });
    persistSnapshot();
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
    persistSnapshot();
    syncToFirestore('auditEvents', event.id, event);
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
    persistSnapshot();
    syncToFirestore('reminderOccurrences', r.id, r);
    return r;
  },
  update(id: string, data: Partial<ReminderOccurrence>): ReminderOccurrence | undefined {
    const idx = store.reminderOccurrences.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    store.reminderOccurrences[idx] = { ...store.reminderOccurrences[idx], ...data };
    persistSnapshot();
    syncToFirestore('reminderOccurrences', id, store.reminderOccurrences[idx]);
    return store.reminderOccurrences[idx];
  },
};

