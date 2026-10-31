# Firebase Setup & Deployment Guide

This document details the configuration, security, and deployment procedures for the **Enterprise Task Management & Status Tracking Platform** powered by **Firebase Authentication** and **Cloud Firestore**.

---

## 1. Firebase Project Selection & Configuration

The application is provisioned to use Cloud Firestore and Firebase Authentication.
The active configuration is located in `firebase-applet-config.json` and mirrored in `client/src/firebase-applet-config.json`:

- **Project ID**: `gen-lang-client-0565045974`
- **Firestore Database ID**: `ai-studio-arihantsirtask-0161e0d5-b616-4889-bd87-da1065b72003`
- **Auth Domain**: `gen-lang-client-0565045974.firebaseapp.com`
- **Storage Bucket**: `gen-lang-client-0565045974.firebasestorage.app`

---

## 2. Enabling Authentication Providers

1. Open the [Firebase Console](https://console.firebase.google.com/project/gen-lang-client-0565045974/authentication).
2. Go to **Build > Authentication > Sign-in method**.
3. Enable **Email/Password** provider (Email link is optional).
4. Save the configuration.

---

## 3. Configuring Firebase Admin SDK Credentials (Server)

For cloud production environments running outside Google Cloud Run:
1. In the Firebase Console, navigate to **Project settings > Service accounts**.
2. Click **Generate new private key** and download the JSON file.
3. Populate the server environment variables in your deployment environment or `.env`:
   ```bash
   FIREBASE_PROJECT_ID=gen-lang-client-0565045974
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gen-lang-client-0565045974.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...-----END PRIVATE KEY-----\n"
   FIRESTORE_DATABASE_ID=ai-studio-arihantsirtask-0161e0d5-b616-4889-bd87-da1065b72003
   ```
*(Note: Within Google Cloud environments, Application Default Credentials automatically provide authorization.)*

---

## 4. Cloud Firestore Collections & Architecture

The database adheres to the following collections and subcollections:

| Collection Path | Description | Access Rules |
| :--- | :--- | :--- |
| `/users/{uid}` | User accounts, organizational roles, and statuses | Admin full; Employees read own profile |
| `/tasks/{taskId}` | Task definitions, deadlines, priorities, categories | Admin full; Assigned employees read/write via server |
| `/tasks/{taskId}/members/{uid}` | Member progress, blocker reports, submission notes | Admin full; Member updates own status |
| `/tasks/{taskId}/messages/{msgId}` | Collaborative team chat for assigned tasks | Admin & assigned task members |
| `/statusRequests/{requestId}` | Manager-to-employee status interrogation records | Admin & recipient employee |
| `/queries/{queryId}` | Employee questions, blocker inquiries, clarifications | Admin & creator employee |
| `/queries/{queryId}/messages/{msgId}` | Query conversation message thread | Admin & query author |
| `/notifications/{notificationId}` | User-specific operational notifications | Recipient user only |
| `/reminderSettings/{uid}` | User and organizational reminder preferences | User own & Admin |
| `/reminderOccurrences/{id}` | Evaluated task deadline reminders | Recipient user & Admin |
| `/auditEvents/{eventId}` | Immutable operational audit trail | Admin read-only; writes restricted to server |

---

## 5. Security Rules & Deployment

Security rules are managed in `firestore.rules` and enforced by Firebase:
- All writes are default-denied to prevent client tampering.
- Privileged operations and state mutations run through the authenticated Express API server.
- The rule set incorporates path parameter hardening (`isValidId`), relational checks, and immutable audit logs.

To re-deploy rules at any time, execute the `DeployRules` RPC or run via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 6. Composite Indexes

When running queries combining multiple equality and range conditions, Firestore requires composite indexes:

1. **Tasks by Department & Status**:
   - Collection: `tasks`
   - Fields: `department` (ASC), `status` (ASC), `createdAt` (DESC)

2. **Task Members by User & Status**:
   - Collection group: `members`
   - Fields: `userId` (ASC), `memberStatus` (ASC), `lastStatusUpdateAt` (DESC)

3. **Notifications by Recipient & Read state**:
   - Collection: `notifications`
   - Fields: `recipientUserId` (ASC), `readAt` (ASC), `createdAt` (DESC)

4. **Status Requests by Recipient & Status**:
   - Collection: `statusRequests`
   - Fields: `recipientUserId` (ASC), `status` (ASC), `createdAt` (DESC)

---

## 7. Development & Production Bootstrap Accounts

On server startup, if the database is newly initialized, the following bootstrap accounts are available:

- **Admin Account**:
  - Email: `admin@company.com`
  - Password: `Admin@2024!`
  - Role: `admin` (Executive administrator)
- **Employee Accounts**:
  - `priya.mehta@company.com` / `Emp@56789` (Engineering)
  - `rahul.gupta@company.com` / `Emp@34512` (Engineering)
  - `sneha.patel@company.com` / `Emp@78234` (Sales)
  - `vikram.nair@company.com` / `Emp@91823` (Operations)

---

## 8. Running the Application

To run the development environment with both Vite client (port 3000) and Express server (port 5000):
```bash
npm run dev
```

To build for production:
```bash
npm run build
npm start
```
