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

import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// ============================================================
// SECURITY & MIDDLEWARE
// ============================================================

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
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

// ============================================================
// ERROR HANDLING
// ============================================================

app.use(notFound);
app.use(errorHandler);

export default app;
