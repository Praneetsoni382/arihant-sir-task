# Firebase Cloud Messaging (FCM) Web Push Notification Setup & Architecture Guide

This document describes the end-to-end setup, configuration, and verification for Firebase Cloud Messaging (FCM) Web Push Notifications in the Organizational Task Management Platform.

---

## 1. Architectural Overview & Spark Plan Compatibility

- **Authoritative Persistence Layer**: Cloud Firestore (`notifications/{notificationId}`). Push notifications never supersede or replace in-app notification records.
- **Delivery Mechanism**: Firebase Cloud Messaging (Web Push) targeting registered user devices (`users/{uid}/devices/{deviceId}`).
- **Spark Plan Compatible**: Outbound push notifications are dispatched by the Node.js/Express server using `firebase-admin/messaging` (`getMessaging(adminApp).sendEachForMulticast()`). This eliminates the need for paid Firebase Blaze Cloud Functions or external third-party push services.
- **Strict User Privacy & Isolation**: Recipient resolution is calculated strictly on the backend using authoritative task membership data. Clients can never supply arbitrary recipient IDs or trigger broadcast blasts.
- **Multi-Device Support**: Each user can register multiple devices (e.g. office desktop, mobile browser, laptop).
- **Safe Account Switching**: Logging out deactivates the device association. Logging in with a new account updates the device ownership, preventing cross-user notification leakage.

---

## 2. Firebase Console Configuration (Manual Steps)

To generate and connect your Web Push (VAPID) credentials:

### Step 1: Open the Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **`gen-lang-client-0565045974`** (or your target production project ID).

### Step 2: Navigate to Project Settings & Cloud Messaging
1. Click the **Gear (Settings)** icon next to **Project Overview** in the left sidebar.
2. Select **Project settings**.
3. Click the **Cloud Messaging** tab along the top.

### Step 3: Generate Web Push Certificate (VAPID Key Pair)
1. Scroll down to the **Web configuration** section.
2. Under **Web Push certificates**, click **Generate key pair**.
3. A public key will appear in the table (e.g., `BKagO_x...`).
4. Copy this public key.

### Step 4: Configure Environment Variables
Add the public key to your environment:
```bash
# Frontend (.env or client/.env)
VITE_FIREBASE_VAPID_KEY=BKagO_x...your_generated_public_key...

# Backend (.env or server environment)
FIREBASE_VAPID_KEY=BKagO_x...your_generated_public_key...
```

### Step 5: Verify Google Cloud APIs
In the [Google Cloud Console](https://console.cloud.google.com/apis/library) for project `gen-lang-client-0565045974`, ensure the following APIs are **Enabled**:
- **Firebase Cloud Messaging API** (`fcm.googleapis.com`)
- **Firebase Installations API** (`firebaseinstallations.googleapis.com`)
- **Cloud Firestore API** (`firestore.googleapis.com`)

### Step 6: Verify Backend Admin SDK Credentials
Ensure your backend environment includes Firebase Admin SDK credentials:
- `FIREBASE_PROJECT_ID=gen-lang-client-0565045974`
- `FIREBASE_CLIENT_EMAIL=...`
- `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`
- `FIRESTORE_DATABASE_ID=ai-studio-arihantsirtask-0161e0d5-b616-4889-bd87-da1065b72003`

---

## 3. Service Worker & Scope Configuration

The service worker is located at:
- **Source**: `client/public/firebase-messaging-sw.js`
- **Served Root URL**: `https://<your-domain>/firebase-messaging-sw.js` (Scope: `/`)

During Vite build (`npm run build`), Vite automatically copies all files in `client/public/` directly into `client/dist/`, ensuring the service worker is available at the root origin with maximum scope.

### Service Worker Highlights:
- Initializes Firebase Web SDK (compat mode) using the project configuration.
- Handles background notifications via `messaging.onBackgroundMessage()`.
- Implements fallback raw `push` event listener in case payload formats differ.
- Implements `notificationclick` handler:
  - Focuses an already open window matching the origin.
  - Navigates directly to the target URL (e.g. `/employee/tasks/task-001` or `/admin/queries/query-001`).
  - Closes the notification banner after click.

---

## 4. Frontend Notification Workflow

1. **Introduction Banner**: Users on first login see an in-app prompt ("Enable push notifications to stay updated on task assignments and deadlines") rather than a sudden raw browser prompt.
2. **Permission Request**: Clicking "Enable Notifications" invokes native `Notification.requestPermission()`.
3. **FCM Token Retrieval**: On `'granted'`, `getToken(messaging, { vapidKey, serviceWorkerRegistration })` retrieves the client registration token.
4. **Backend Registration**: Sent to `POST /api/push/register` with device details (platform, browser, user agent).
5. **Foreground Messages**: When the app tab is open and focused, incoming notifications are caught by `onMessage()` and rendered via `ForegroundNotificationToast` with real-time React Query invalidation so unread badges update immediately.
6. **Background Messages**: When the app tab is closed or in background, the service worker renders a system notification tray item.

---

## 5. Backend REST API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/push/config` | Returns public VAPID key and messaging sender ID | Authenticated |
| `POST` | `/api/push/register` | Registers or refreshes a device token | Authenticated |
| `GET` | `/api/push/devices` | Lists user's active registered devices | Authenticated |
| `PATCH` | `/api/push/devices/:deviceId` | Updates device metadata or preferences | Authenticated |
| `DELETE` | `/api/push/devices/:deviceId` | Deactivates device on logout | Authenticated |
| `GET` | `/api/push/preferences` | Fetches notification category preferences | Authenticated |
| `PATCH` | `/api/push/preferences` | Updates category preferences | Authenticated |
| `POST` | `/api/push/test` | Sends a rate-limited (max 5/min) test notification | Authenticated |

---

## 6. Firestore Data Structure

### Devices Collection (`users/{uid}/devices/{deviceId}`)
```json
{
  "deviceId": "dev_1730370000000_abc123",
  "userId": "emp-001",
  "token": "fcm_token_...",
  "platform": "desktop",
  "browser": "Chrome 125.0.0.0",
  "userAgent": "Mozilla/5.0 ...",
  "isActive": true,
  "createdAt": "2026-10-31T03:00:00.000Z",
  "lastActiveAt": "2026-10-31T03:00:00.000Z"
}
```

### Push Preferences (`users/{uid}/preferences/push`)
```json
{
  "enabled": true,
  "categories": {
    "taskAssignments": true,
    "statusRequests": true,
    "queries": true,
    "reminders": true,
    "messages": true,
    "approvals": true
  }
}
```

### In-App Notification Record (`notifications/{notificationId}`)
```json
{
  "id": "notif-001",
  "userId": "emp-001",
  "type": "task_assigned",
  "title": "New Task Assigned: Prepare Q4 Strategy",
  "message": "Admin has assigned you a new task.",
  "taskId": "task-001",
  "isRead": false,
  "pushStatus": "delivered",
  "pushSentAt": "2026-10-31T03:00:01.000Z",
  "createdAt": "2026-10-31T03:00:00.000Z"
}
```

---

## 7. Testing & Verification Guide

### Automated E2E Verification
Run the automated FCM test suite:
```bash
node test-fcm-e2e.js
```
This tests:
1. Public FCM configuration endpoint.
2. Device registration with multi-device support.
3. Push category preference updates.
4. Rate-limited test push endpoint (5/min).
5. Device token deactivation on logout.
6. Safe account switching without token leakage.
7. Event-driven push delivery alongside persistent Firestore in-app notifications.

### Manual Browser Verification
1. Log in as an Employee (`employee1@company.com` / `Emp@2024!`).
2. Click **Enable Notifications** on the top banner and click **Allow** in the browser prompt.
3. Open the notification bell in the top navigation bar. Verify **Push: Active** is shown.
4. Click **Send Test Push**. A foreground notification toast should appear immediately.
5. In another tab or window, log in as Admin (`admin@company.com` / `Admin@2024!`) and assign a task to Employee 1.
6. Observe that Employee 1 receives both an in-app notification and a push notification with direct link to `/employee/tasks/:taskId`.
