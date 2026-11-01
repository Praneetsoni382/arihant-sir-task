// ============================================================
// MAIN EXPRESS APPLICATION
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { SESSION_SECRET } from './config.js';

// Routes
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import taskRoutes from './routes/tasks.js';
import statusRequestRoutes, { taskStatusRequestRouter } from './routes/statusRequests.js';
import queryRoutes, { taskQueryRouter } from './routes/queries.js';
import chatRoutes from './routes/chat.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import reminderRoutes from './routes/reminders.js';
import reportRoutes from './routes/reports.js';
import pushRoutes from './routes/push.js';
import meetingRoutes from './routes/meetings.js';

import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// Enable trust proxy for reverse proxies in AI Studio environment
app.set('trust proxy', 1);

// ============================================================
// SECURITY & MIDDLEWARE
// ============================================================

app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'tid',
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  })
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Task Management Platform API',
    version: '1.0.0',
  });
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);

// Task-nested sub-routers
app.use('/api/tasks', taskStatusRequestRouter);
app.use('/api/tasks', taskQueryRouter);
app.use('/api/tasks', chatRoutes);
app.use('/api/tasks', taskRoutes);

// Standalone top-level resource routers
app.use('/api/status-requests', statusRequestRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/admin', meetingRoutes);
app.use('/api', meetingRoutes);

// ============================================================
// STATIC ASSETS & CLIENT SPA SERVING
// ============================================================

import path from 'path';
import fs from 'fs';

const clientDistPath = path.resolve(process.cwd(), 'client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.resolve(clientDistPath, 'index.html'));
  });
}

// ============================================================
// ERROR HANDLING FOR API ROUTES
// ============================================================

app.all('/api/*', notFound);
app.use(errorHandler);

export default app;
