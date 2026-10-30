# TaskFlow — Enterprise Task Management & Employee Communication Platform

An enterprise-grade coordination, status tracking, and employee communication web application designed for organizations, departments, and corporate management teams.

---

## 1. Quick Start Guide

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+)

### Installation
From the root repository directory:
```bash
# Install root orchestration dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### Running in Development Mode
You can launch both the backend (Express API on port 5000) and frontend (Vite React app on port 5173) together:
```bash
npm run dev
```

Or run them individually in separate terminals:
```bash
# Terminal 1: Backend API
cd server
npm run dev

# Terminal 2: Frontend Client
cd client
npm run dev
```

Visit the application at: **`http://localhost:5173`**

### Running the Mandatory E2E Test Suite
To verify the 25-step mandatory scenario required by the project specification:
```bash
npm test
```

---

## 2. Seeded Test Accounts

The platform includes a development account selector on the login screen. You can click any card to auto-fill credentials:

| Role | Name | Department | Email | Password |
|---|---|---|---|---|
| **Administrator** | Arihant Sharma | System Admin | `admin@company.com` | `Admin@2024!` |
| **Employee** | Priya Mehta | Engineering | `priya.mehta@company.com` | `Emp@56789` |
| **Employee** | Rahul Gupta | Engineering | `rahul.gupta@company.com` | `Emp@34512` |
| **Employee** | Sneha Patel | Sales | `sneha.patel@company.com` | `Emp@78234` |
| **Employee** | Vikram Nair | Operations | `vikram.nair@company.com` | `Emp@91823` |

---

## 3. Implemented Capabilities & Architecture

### 3.1 Frontend Architecture
- **Framework**: React 19 + TypeScript + Vite 8
- **State Management**: TanStack Query (React Query) for server state caching and automatic invalidation
- **Routing**: React Router DOM v7 with role-based `ProtectedRoute` guards
- **Styling**: Tailwind CSS v4 with professional, restrained enterprise design tokens
- **Icons**: Lucide React
- **Date Handling**: `date-fns` with consistent Indian format (`DD/MM/YYYY`) and `Asia/Kolkata` timezone evaluation
- **Zero Charts Requirement**: STRICTLY compliant with Section 8.1; uses clean block-style numerical cards and structured tables

### 3.2 Backend Architecture
- **Runtime & Framework**: Node.js + Express + TypeScript
- **Security**: Helmet HTTP headers, CORS with credentials, bcrypt password hashing, express-session with secure cookies
- **Validation**: Server-side Zod validation on every input payload
- **Architecture**: Repository Pattern with centralized in-memory data store, ready for plug-and-play Firebase Firestore integration without modifying route or business logic

---

## 4. API Endpoints

### Authentication
- `POST /api/auth/login` — Authenticate and initialize session
- `POST /api/auth/logout` — Invalidate session
- `GET /api/auth/me` — Retrieve active session profile

### Employees
- `GET /api/employees` — List all employees (search, department, active filters)
- `POST /api/employees` — Create new employee account (Admin only)
- `GET /api/employees/:id` — Get employee profile and task count
- `PATCH /api/employees/:id` — Update employee profile (Admin only)
- `PATCH /api/employees/:id/status` — Deactivate / reactivate employee account (Admin only)

### Tasks & Workflows
- `GET /api/tasks` — List tasks (filtered by role, status, priority, type)
- `POST /api/tasks` — Create solo or group task (Admin only)
- `GET /api/tasks/:id` — Get task detail with all members populated
- `PATCH /api/tasks/:id` — Update task fields & recalculate deadlines
- `POST /api/tasks/:id/cancel` — Cancel task (Admin only)
- `GET /api/tasks/:id/history` — Get chronological audit event log
- `PATCH /api/tasks/:id/members/:memberId/status` — Update member status (In Progress, Blocked, etc.)
- `POST /api/tasks/:id/members/:memberId/submit` — Final task deliverable submission
- `POST /api/tasks/:id/members/:memberId/approve` — Approve deliverable (Admin only)
- `POST /api/tasks/:id/members/:memberId/request-revision` — Request revision with reason (Admin only)

### Interrogation / Status Requests
- `GET /api/status-requests` — Get all status requests (role-filtered)
- `GET /api/status-requests/presets` — Get predefined managerial inquiry templates
- `POST /api/tasks/:taskId/status-requests` — Send inquiry to selected assignees (Admin only)
- `POST /api/status-requests/:id/respond` — Employee responds to inquiry

### Employee Queries
- `GET /api/queries` — List queries
- `GET /api/queries/:id` — Get query conversation thread
- `GET /api/tasks/:taskId/queries` — Get queries associated with a specific task
- `POST /api/tasks/:taskId/queries` — Raise formal query (Employee)
- `POST /api/queries/:id/messages` — Post message / manager reply
- `PATCH /api/queries/:id/status` — Mark resolved or reopened

### Collaboration / Chat
- `GET /api/tasks/:taskId/messages` — Fetch task discussion messages
- `POST /api/tasks/:taskId/messages` — Post group chat message

### Notifications & Reminders
- `GET /api/notifications` — Fetch user in-app notifications & unread count
- `PATCH /api/notifications/:id/read` — Mark notification read
- `POST /api/notifications/read-all` — Mark all notifications read
- `GET /api/reminders/preview` — Preview reminder eligibility engine
- `POST /api/reminders/evaluate` — Dispatch reminder occurrences (Admin only)

### Dashboard & Reports
- `GET /api/dashboard/admin` — Executive overview metrics & quick lists
- `GET /api/dashboard/employee` — Personal workspace metrics & action items
- `GET /api/reports` — Structured report with CSV export

---

## 5. Phase 1 Restrictions & Future Firebase Integration
As instructed in the master prompt:
- **Database**: An in-memory development store with repository abstractions (`inMemoryStore.ts`) was implemented.
- **Migration Path**: Replacing this store with Firebase Firestore requires only implementing a `firestoreRepo.ts` with the matching repository signatures (`userRepo`, `taskRepo`, etc.). No frontend components or routes need modification.
- **Push Notifications**: Intentionally internal in-app notifications only (no external FCM or browser push workers in this phase).

