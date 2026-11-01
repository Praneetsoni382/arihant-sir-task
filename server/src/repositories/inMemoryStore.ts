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
  Device,
  PushPreferences,
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
  devices: Device[];
  pushPreferences: Record<string, PushPreferences>;
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
  devices: [],
  pushPreferences: {},
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
    console.error(`❌ Firestore write error (${collection}/${docId}):`, err instanceof Error ? err.message : err);
    throw err;
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
    store.devices = [];
    store.taskCounter = 1000;
  }

  // Authoritative Administrator definition
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
    initialPassword: 'Admin@2024!',
    currentPasswordPlain: 'Admin@2024!',
    createdAt: now,
    updatedAt: now,
  };

  // 1. Try to load authoritative records from Firestore if available
  if (!forceReset) {
    try {
      const usersData = await firestoreDb.collectionGetAll('users');
      if (usersData && usersData.length > 0) {
        console.log(`🔥 Synchronizing authoritative collections from Cloud Firestore...`);
        // Filter out corrupted test objects without email or role
        const validUsers = (usersData as User[]).filter((u) => u && u.email && u.role);
        store.users = validUsers;

        const tasksData = await firestoreDb.collectionGetAll('tasks');
        store.tasks = (tasksData as Task[]).filter((t) => t && t.id);

        const membersData = await firestoreDb.collectionGetAll('taskMembers');
        store.taskMembers = (membersData as TaskMember[]).filter((m) => m && m.id);

        const srData = await firestoreDb.collectionGetAll('statusRequests');
        store.statusRequests = (srData as StatusRequest[]).filter((s) => s && s.id);

        const srespData = await firestoreDb.collectionGetAll('statusResponses');
        store.statusResponses = (srespData as StatusResponse[]).filter((s) => s && s.id);

        const queriesData = await firestoreDb.collectionGetAll('queries');
        store.queries = (queriesData as Query[]).filter((q) => q && q.id);

        const qmsgData = await firestoreDb.collectionGetAll('queryMessages');
        store.queryMessages = (qmsgData as QueryMessage[]).filter((m) => m && m.id);

        const chatData = await firestoreDb.collectionGetAll('chatMessages');
        store.chatMessages = (chatData as ChatMessage[]).filter((c) => c && c.id);

        const notifData = await firestoreDb.collectionGetAll('notifications');
        store.notifications = (notifData as Notification[]).filter((n) => n && n.id);

        const auditData = await firestoreDb.collectionGetAll('auditEvents');
        if (auditData.length > 0) {
          store.auditEvents = (auditData as AuditEvent[]).filter((a) => a && a.id);
        }

        const remData = await firestoreDb.collectionGetAll('reminderOccurrences');
        store.reminderOccurrences = (remData as ReminderOccurrence[]).filter((r) => r && r.id);

        const devData = await firestoreDb.collectionGetAll('devices');
        store.devices = (devData as Device[]).filter((d) => d && ((d as any).id || d.deviceId));

        // Derive highest task counter so reference numbers never collide
        let maxRef = 1000;
        for (const t of store.tasks) {
          if (t.referenceNumber) {
            const num = parseInt(t.referenceNumber.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > maxRef) {
              maxRef = num;
            }
          }
        }
        store.taskCounter = maxRef;

        // Ensure single admin exists in store
        const adminIdx = store.users.findIndex((u) => u.email.toLowerCase() === 'admin@company.com');
        if (adminIdx === -1) {
          store.users.unshift(admin);
          await syncToFirestore('users', admin.id, admin);
        }

        // Credential alignment: Ensure all employees have valid passwordHash matching their credentials
        for (const u of store.users) {
          if (u.role === 'employee') {
            const cleanEmpId = (u.employeeId || '001').replace(/[^a-zA-Z0-9]/g, '');
            const fallbackPass = `Emp@${cleanEmpId}`;
            if (!u.initialPassword) {
              u.initialPassword = u.currentPasswordPlain || fallbackPass;
            }
            if (!u.currentPasswordPlain) {
              u.currentPasswordPlain = u.initialPassword;
            }
            // Check if passwordHash matches
            let matches = false;
            if (u.passwordHash && u.initialPassword) {
              try {
                matches = await bcrypt.compare(u.initialPassword, u.passwordHash);
              } catch {
                matches = false;
              }
            }
            if (!matches && u.initialPassword) {
              u.passwordHash = await bcrypt.hash(u.initialPassword, 10);
              await syncToFirestore('users', u.id, u);
            }
          }
        }

        persistSnapshot();
        console.log(`✅ Loaded ${store.users.length} active users and ${store.tasks.length} tasks from Cloud Firestore (taskCounter: ${store.taskCounter}).`);
        return;
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
        Object.assign(store, snapshot);
        
        const hasAdmin = store.users.some((u) => u.role === 'admin' && u.email === 'admin@company.com');
        if (!hasAdmin) {
          store.users.unshift(admin);
          await syncToFirestore('users', admin.id, admin);
        }
        console.log(`📦 Restored ${store.users.length} users and ${store.tasks.length} tasks from local persistence.`);
        return;
      }
    } catch (e) {
      console.warn('Could not read snapshot file, falling back to seed');
    }
  }

  // 3. Initial Seed: Single Authoritative Administrator Account Only
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
  store.devices = [];
  store.taskCounter = 1000;

  // Persist snapshot to disk
  persistSnapshot();

  // Sync the single authoritative administrator to Firestore
  await syncToFirestore('users', admin.id, admin);

  console.log('[Seed] Database initialized with single Administrator account (admin@company.com). All dummy data purged.');
}

// ============================================================
// HELPER: Sanitize User Credentials
// ============================================================
export function sanitizeUser(u: User): User {
  if (u.role === 'employee') {
    const cleanEmpId = (u.employeeId || '001').replace(/[^a-zA-Z0-9]/g, '');
    const fallbackPass = `Emp@${cleanEmpId}`;
    if (!u.initialPassword) {
      u.initialPassword = u.currentPasswordPlain || fallbackPass;
    }
    if (!u.currentPasswordPlain) {
      u.currentPasswordPlain = u.initialPassword;
    }
  }
  return u;
}

// ============================================================
// USER REPOSITORY
// ============================================================

export const userRepo = {
  findAll(): User[] {
    return store.users.map(sanitizeUser);
  },
  findById(id: string): User | undefined {
    const u = store.users.find((u) => u.id === id);
    return u ? sanitizeUser(u) : undefined;
  },
  findByEmail(email: string): User | undefined {
    const u = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return u ? sanitizeUser(u) : undefined;
  },
  async fetchFromCloudByEmail(email: string): Promise<User | undefined> {
    try {
      const results = await firestoreDb.queryByField('users', 'email', email);
      if (results.length > 0) {
        const cloudUser = sanitizeUser(results[0] as User);
        const existingIdx = store.users.findIndex((u) => u.id === cloudUser.id);
        if (existingIdx !== -1) {
          store.users[existingIdx] = cloudUser;
        } else {
          store.users.push(cloudUser);
        }
        persistSnapshot();
        return cloudUser;
      }
    } catch (err) {
      console.warn('Could not fetch user by email from cloud:', err);
    }
    return undefined;
  },
  async fetchFromCloudById(id: string): Promise<User | undefined> {
    try {
      const data = await firestoreDb.docGet('users', id);
      if (data && data.email) {
        const cloudUser = sanitizeUser(data as User);
        const existingIdx = store.users.findIndex((u) => u.id === cloudUser.id);
        if (existingIdx !== -1) {
          store.users[existingIdx] = cloudUser;
        } else {
          store.users.push(cloudUser);
        }
        persistSnapshot();
        return cloudUser;
      }
    } catch (err) {
      console.warn('Could not fetch user by ID from cloud:', err);
    }
    return undefined;
  },
  findByEmployeeId(employeeId: string): User | undefined {
    const u = store.users.find((u) => u.employeeId === employeeId);
    return u ? sanitizeUser(u) : undefined;
  },
  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date().toISOString();
    let user: User = { ...data, id: newId(), createdAt: now, updatedAt: now };
    user = sanitizeUser(user);
    store.users.push(user);
    persistSnapshot();
    await syncToFirestore('users', user.id, user);
    return user;
  },
  async update(id: string, data: Partial<User>): Promise<User | undefined> {
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    const existing = store.users[idx];
    const initialPassToKeep = existing.initialPassword || existing.currentPasswordPlain || `Emp@${(existing.employeeId || '001').replace(/[^a-zA-Z0-9]/g, '')}`;

    const updatedUser = sanitizeUser({
      ...existing,
      ...data,
      initialPassword: initialPassToKeep,
      updatedAt: new Date().toISOString(),
    });

    store.users[idx] = updatedUser;
    persistSnapshot();
    await syncToFirestore('users', id, store.users[idx]);
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
  async fetchFromCloudById(id: string): Promise<Task | undefined> {
    try {
      const data = await firestoreDb.docGet('tasks', id);
      if (data && data.id) {
        const existingIdx = store.tasks.findIndex((t) => t.id === data.id);
        if (existingIdx !== -1) {
          store.tasks[existingIdx] = data as Task;
        } else {
          store.tasks.push(data as Task);
        }
        persistSnapshot();
        return data as Task;
      }
    } catch (err) {
      console.warn('Could not fetch task by ID from cloud:', err);
    }
    return undefined;
  },
  findByMember(userId: string): Task[] {
    const memberTaskIds = store.taskMembers
      .filter((tm) => tm.userId === userId)
      .map((tm) => tm.taskId);
    return store.tasks.filter((t) => memberTaskIds.includes(t.id));
  },
  async create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const now = new Date().toISOString();
    const referenceNumber = (data as any).referenceNumber || nextTaskRef();
    const task: Task = { ...data, referenceNumber, id: newId(), createdAt: now, updatedAt: now };
    store.tasks.push(task);
    persistSnapshot();
    await syncToFirestore('tasks', task.id, task);
    return task;
  },
  async update(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    store.tasks[idx] = { ...store.tasks[idx], ...data, updatedAt: new Date().toISOString() };
    persistSnapshot();
    await syncToFirestore('tasks', id, store.tasks[idx]);
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
  async create(data: Omit<TaskMember, 'id'>): Promise<TaskMember> {
    const member: TaskMember = { ...data, id: newId() };
    store.taskMembers.push(member);
    persistSnapshot();
    await syncToFirestore('taskMembers', member.id, member);
    await syncToFirestore(`tasks/${member.taskId}/members`, member.id, member);
    return member;
  },
  async update(id: string, data: Partial<TaskMember>): Promise<TaskMember | undefined> {
    const idx = store.taskMembers.findIndex((tm) => tm.id === id);
    if (idx === -1) return undefined;
    store.taskMembers[idx] = { ...store.taskMembers[idx], ...data };
    persistSnapshot();
    await syncToFirestore('taskMembers', id, store.taskMembers[idx]);
    await syncToFirestore(`tasks/${store.taskMembers[idx].taskId}/members`, id, store.taskMembers[idx]);
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
  async create(data: Omit<StatusRequest, 'id'>): Promise<StatusRequest> {
    const sr: StatusRequest = { ...data, id: newId() };
    store.statusRequests.push(sr);
    persistSnapshot();
    await syncToFirestore('statusRequests', sr.id, sr);
    return sr;
  },
  async update(id: string, data: Partial<StatusRequest>): Promise<StatusRequest | undefined> {
    const idx = store.statusRequests.findIndex((sr) => sr.id === id);
    if (idx === -1) return undefined;
    store.statusRequests[idx] = { ...store.statusRequests[idx], ...data };
    persistSnapshot();
    await syncToFirestore('statusRequests', id, store.statusRequests[idx]);
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
  async create(data: Omit<StatusResponse, 'id'>): Promise<StatusResponse> {
    const sr: StatusResponse = { ...data, id: newId() };
    store.statusResponses.push(sr);
    persistSnapshot();
    await syncToFirestore('statusResponses', sr.id, sr);
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
  async create(data: Omit<Query, 'id' | 'createdAt' | 'updatedAt'>): Promise<Query> {
    const now = new Date().toISOString();
    const query: Query = { ...data, id: newId(), createdAt: now, updatedAt: now };
    store.queries.push(query);
    persistSnapshot();
    await syncToFirestore('queries', query.id, query);
    return query;
  },
  async update(id: string, data: Partial<Query>): Promise<Query | undefined> {
    const idx = store.queries.findIndex((q) => q.id === id);
    if (idx === -1) return undefined;
    store.queries[idx] = { ...store.queries[idx], ...data, updatedAt: new Date().toISOString() };
    persistSnapshot();
    await syncToFirestore('queries', id, store.queries[idx]);
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
  async create(data: Omit<QueryMessage, 'id'>): Promise<QueryMessage> {
    const qm: QueryMessage = { ...data, id: newId() };
    store.queryMessages.push(qm);
    persistSnapshot();
    await syncToFirestore('queryMessages', qm.id, qm);
    await syncToFirestore(`queries/${qm.queryId}/messages`, qm.id, qm);
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
  async create(data: Omit<ChatMessage, 'id'>): Promise<ChatMessage> {
    const cm: ChatMessage = { ...data, id: newId() };
    store.chatMessages.push(cm);
    persistSnapshot();
    await syncToFirestore('chatMessages', cm.id, cm);
    await syncToFirestore(`tasks/${cm.taskId}/messages`, cm.id, cm);
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
  async create(data: Omit<Notification, 'id'>): Promise<Notification> {
    const n: Notification = { ...data, id: newId() };
    store.notifications.push(n);
    persistSnapshot();
    await syncToFirestore('notifications', n.id, n);
    return n;
  },
  async update(id: string, data: Partial<Notification>): Promise<Notification | undefined> {
    const idx = store.notifications.findIndex((n) => n.id === id);
    if (idx === -1) return undefined;
    store.notifications[idx] = { ...store.notifications[idx], ...data };
    persistSnapshot();
    await syncToFirestore('notifications', id, store.notifications[idx]);
    return store.notifications[idx];
  },
  async markAllRead(userId: string): Promise<void> {
    const now = new Date().toISOString();
    const targets = store.notifications.filter((n) => n.recipientUserId === userId && !n.readAt);
    for (const n of targets) {
      n.readAt = now;
      n.deliveryState = 'read';
      await syncToFirestore('notifications', n.id, n);
    }
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
  async create(data: Omit<AuditEvent, 'id'>): Promise<AuditEvent> {
    const event: AuditEvent = { ...data, id: newId() };
    store.auditEvents.push(event);
    persistSnapshot();
    await syncToFirestore('auditEvents', event.id, event);
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
  async create(data: Omit<ReminderOccurrence, 'id'>): Promise<ReminderOccurrence> {
    const r: ReminderOccurrence = { ...data, id: newId() };
    store.reminderOccurrences.push(r);
    persistSnapshot();
    await syncToFirestore('reminderOccurrences', r.id, r);
    return r;
  },
  async update(id: string, data: Partial<ReminderOccurrence>): Promise<ReminderOccurrence | undefined> {
    const idx = store.reminderOccurrences.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    store.reminderOccurrences[idx] = { ...store.reminderOccurrences[idx], ...data };
    persistSnapshot();
    await syncToFirestore('reminderOccurrences', id, store.reminderOccurrences[idx]);
    return store.reminderOccurrences[idx];
  },
};

// ============================================================
// DEVICE REPOSITORY (Web Push FCM Tokens)
// ============================================================

export const deviceRepo = {
  findByUser(userId: string): Device[] {
    return (store.devices || []).filter((d) => d.userId === userId);
  },

  findActiveByUser(userId: string): Device[] {
    return (store.devices || []).filter(
      (d) => d.userId === userId && d.isActive && d.fcmToken && d.fcmToken.length > 0
    );
  },

  findByDeviceId(deviceId: string, userId?: string): Device | undefined {
    return (store.devices || []).find(
      (d) => (userId ? d.userId === userId : true) && d.deviceId === deviceId
    );
  },

  async registerDevice(deviceData: {
    deviceId: string;
    userId: string;
    fcmToken: string;
    platform?: 'WEB';
    browserName?: string;
    userAgent?: string;
    permissionStatus?: 'default' | 'granted' | 'denied';
  }): Promise<Device> {
    if (!store.devices) store.devices = [];
    const now = new Date().toISOString();

    // Account switching protection: if token or deviceId was associated with another user,
    // deactivate the previous association so previous user does not receive notifications
    for (const existing of store.devices) {
      if (
        (existing.deviceId === deviceData.deviceId || existing.fcmToken === deviceData.fcmToken) &&
        existing.userId !== deviceData.userId
      ) {
        existing.isActive = false;
        existing.updatedAt = now;
        await syncToFirestore(`users/${existing.userId}/devices`, existing.deviceId, existing);
      }
    }

    const existingIdx = store.devices.findIndex(
      (d) => d.userId === deviceData.userId && d.deviceId === deviceData.deviceId
    );

    let device: Device;
    if (existingIdx !== -1) {
      // Update existing device
      device = {
        ...store.devices[existingIdx],
        fcmToken: deviceData.fcmToken,
        browserName: deviceData.browserName || store.devices[existingIdx].browserName || 'Browser',
        userAgent: deviceData.userAgent || store.devices[existingIdx].userAgent || '',
        permissionStatus: deviceData.permissionStatus || 'granted',
        isActive: true,
        updatedAt: now,
        lastSeenAt: now,
        tokenVersion: 'v1',
      };
      store.devices[existingIdx] = device;
    } else {
      // Register new device
      device = {
        deviceId: deviceData.deviceId,
        userId: deviceData.userId,
        fcmToken: deviceData.fcmToken,
        platform: 'WEB',
        browserName: deviceData.browserName || 'Browser',
        userAgent: deviceData.userAgent || '',
        permissionStatus: deviceData.permissionStatus || 'granted',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        lastSuccessfulSendAt: null,
        lastErrorAt: null,
        tokenVersion: 'v1',
      };
      store.devices.push(device);
    }

    persistSnapshot();
    await syncToFirestore(`users/${device.userId}/devices`, device.deviceId, device);
    return device;
  },

  async updateDevice(
    userId: string,
    deviceId: string,
    data: Partial<Device>
  ): Promise<Device | undefined> {
    if (!store.devices) store.devices = [];
    const idx = store.devices.findIndex(
      (d) => d.userId === userId && d.deviceId === deviceId
    );
    if (idx === -1) return undefined;

    store.devices[idx] = {
      ...store.devices[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    persistSnapshot();
    await syncToFirestore(`users/${userId}/devices`, deviceId, store.devices[idx]);
    return store.devices[idx];
  },

  async deactivateDevice(userId: string, deviceId: string): Promise<boolean> {
    if (!store.devices) return false;
    const device = store.devices.find((d) => (userId ? d.userId === userId : true) && d.deviceId === deviceId);
    if (!device) return false;
    device.isActive = false;
    device.updatedAt = new Date().toISOString();
    persistSnapshot();
    await syncToFirestore(`users/${device.userId}/devices`, deviceId, device);
    return true;
  },

  async deactivateByToken(fcmToken: string): Promise<void> {
    if (!store.devices) return;
    const now = new Date().toISOString();
    for (const d of store.devices) {
      if (d.fcmToken === fcmToken) {
        d.isActive = false;
        d.lastErrorAt = now;
        d.updatedAt = now;
        await syncToFirestore(`users/${d.userId}/devices`, d.deviceId, d);
      }
    }
    persistSnapshot();
  },

  async removeDevice(userId: string, deviceId: string): Promise<boolean> {
    if (!store.devices) return false;
    const idx = store.devices.findIndex((d) => d.userId === userId && d.deviceId === deviceId);
    if (idx === -1) return false;
    store.devices.splice(idx, 1);
    persistSnapshot();
    return true;
  },
};

// ============================================================
// PUSH PREFERENCES REPOSITORY
// ============================================================

export const pushPrefRepo = {
  getPreferences(userId: string): PushPreferences {
    if (!store.pushPreferences) store.pushPreferences = {};
    if (!store.pushPreferences[userId]) {
      store.pushPreferences[userId] = {
        userId,
        enabled: true,
        categories: {
          taskAssignments: true,
          statusRequests: true,
          queries: true,
          reminders: true,
          messages: true,
          approvals: true,
        },
        updatedAt: new Date().toISOString(),
      };
    }
    return store.pushPreferences[userId];
  },

  async updatePreferences(
    userId: string,
    data: { enabled?: boolean; categories?: Partial<PushPreferences['categories']> }
  ): Promise<PushPreferences> {
    const current = this.getPreferences(userId);
    const updated: PushPreferences = {
      ...current,
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      categories: {
        ...current.categories,
        ...(data.categories || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    store.pushPreferences[userId] = updated;
    persistSnapshot();
    await syncToFirestore(`users/${userId}/preferences`, 'push', updated);
    return updated;
  },
};

