// ============================================================
// GOOGLE MEET & OAUTH API ROUTES
// File: server/src/routes/meetings.ts
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import {
  meetingRepo,
  statusRequestRepo,
  taskRepo,
  userRepo,
  googleAuthRepo,
  taskMemberRepo,
} from '../repositories/inMemoryStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createNotification,
  createAuditEvent,
  notifTemplates,
} from '../services/notificationService.js';
import {
  getGoogleOAuthUrl,
  exchangeCodeForTokens,
  createGoogleMeetSpace,
} from '../services/googleMeetService.js';
import type { Meeting } from '../types/index.js';

const router = Router();

// ============================================================
// 1. ADMIN GOOGLE OAUTH MANAGEMENT ENDPOINTS
// ============================================================

// GET /api/admin/google/status
router.get(
  '/google/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tokens = googleAuthRepo.getTokens(req.session.userId!);
    const hasClientId = !!process.env.GOOGLE_CLIENT_ID;

    res.json({
      success: true,
      data: {
        isConnected: !!tokens && !!tokens.accessToken,
        connectedEmail: tokens?.email || 'admin@company.com',
        hasClientId,
        updatedAt: tokens?.updatedAt || null,
      },
    });
  })
);

// GET /api/admin/google/auth-url
router.get(
  '/google/auth-url',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const state = `state_${req.session.userId}_${Date.now()}`;
    const authUrl = getGoogleOAuthUrl(state);
    res.json({ success: true, data: { authUrl } });
  })
);

// GET /api/admin/google/callback
router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`/#/admin/settings?oauth_error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).send('Missing authorization code');
      return;
    }

    try {
      const userId = req.session.userId || 'seed-admin-001';
      await exchangeCodeForTokens(code, userId);
      res.redirect('/#/admin/status-requests?google_connected=true');
    } catch (err) {
      console.error('OAuth Callback Error:', err);
      res.redirect(
        `/#/admin/settings?oauth_error=${encodeURIComponent(
          err instanceof Error ? err.message : 'Authentication failed'
        )}`
      );
    }
  })
);

// POST /api/admin/google/connect-manual (Allows direct account connection / token input for testing)
router.post(
  '/google/connect-manual',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { email, accessToken } = req.body;
    const tokens = await googleAuthRepo.saveTokens({
      userId: req.session.userId!,
      accessToken: accessToken || 'manual_oauth_token_' + Date.now(),
      email: email || (userRepo.findById(req.session.userId!)?.email) || 'admin@company.com',
      expiryDate: Date.now() + 86400 * 1000,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: {
        isConnected: true,
        connectedEmail: tokens.email,
      },
    });
  })
);

// POST /api/admin/google/disconnect
router.post(
  '/google/disconnect',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await googleAuthRepo.clearTokens(req.session.userId!);
    res.json({ success: true, message: 'Google account disconnected successfully' });
  })
);

// ============================================================
// 2. GOOGLE MEET FOR STATUS REQUESTS ENDPOINTS
// ============================================================

// POST /api/admin/status-requests/:requestId/meetings (Create Meet Link -> Draft)
router.post(
  '/status-requests/:requestId/meetings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const sr = statusRequestRepo.findById(requestId);
    if (!sr) {
      res.status(404).json({ success: false, error: 'Status Request not found' });
      return;
    }

    const task = taskRepo.findById(sr.taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Associated Task not found' });
      return;
    }

    // Check if meeting already exists
    let existingMeeting = meetingRepo.findByStatusRequest(requestId);
    if (!existingMeeting) {
      existingMeeting = await meetingRepo.fetchFromCloudByStatusRequest(requestId);
    }

    if (existingMeeting) {
      res.status(200).json({ success: true, data: existingMeeting });
      return;
    }

    // Create genuine Google Meet space via Google API (or fallback if token pending)
    const spaceResult = await createGoogleMeetSpace(req.session.userId!);

    const meetingTitle = `Google Meet Discussion: Status Request on ${task.title}`;

    const newMeeting = await meetingRepo.create({
      statusRequestId: sr.id,
      taskId: task.id,
      createdByAdminUid: req.session.userId!,
      googleSpaceName: spaceResult.googleSpaceName,
      meetingUri: spaceResult.meetingUri,
      meetingTitle,
      description: '',
      status: 'draft',
      timezone: 'Asia/Kolkata',
    });

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'status_request',
      entityId: sr.id,
      eventType: 'STATUS_REQUEST_SENT',
      message: `Google Meet link created (Draft) for status request: ${spaceResult.meetingUri}`,
    });

    res.status(201).json({ success: true, data: newMeeting });
  })
);

// POST /api/admin/status-requests/:requestId/meetings/schedule (Schedule & Publish -> Immediate Notifications)
router.post(
  '/status-requests/:requestId/meetings/schedule',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const sr = statusRequestRepo.findById(requestId);
    if (!sr) {
      res.status(404).json({ success: false, error: 'Status Request not found' });
      return;
    }

    let meeting = meetingRepo.findByStatusRequest(requestId);
    if (!meeting) {
      meeting = await meetingRepo.fetchFromCloudByStatusRequest(requestId);
    }
    if (!meeting) {
      res.status(400).json({ success: false, error: 'Please create a Google Meet link first before scheduling.' });
      return;
    }

    const schema = z.object({
      date: z.string().min(1, 'Meeting date is required'), // YYYY-MM-DD
      time: z.string().min(1, 'Meeting time is required'), // HH:MM
      description: z.string().optional().default(''),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const { date, time, description } = parse.data;

    // Validate that scheduled time is not in the past (IST time comparison)
    const scheduledDateTimeStr = `${date}T${time}:00`;
    const scheduledDateObj = new Date(scheduledDateTimeStr);
    const now = new Date();

    if (isNaN(scheduledDateObj.getTime())) {
      res.status(400).json({ success: false, error: 'Invalid date or time format provided.' });
      return;
    }

    if (scheduledDateObj.getTime() < now.getTime() - 60000) {
      res.status(400).json({ success: false, error: 'Cannot schedule a Google Meet discussion in the past.' });
      return;
    }

    const publishedAtStr = new Date().toISOString();
    const updatedMeeting = await meetingRepo.update(meeting.id, {
      status: 'scheduled',
      scheduledAt: scheduledDateObj.toISOString(),
      publishedAt: publishedAtStr,
      description: description || meeting.description,
      timezone: 'Asia/Kolkata',
    });

    // Format IST date and time strings for human notification
    const dateFormatted = new Date(scheduledDateTimeStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = new Date(scheduledDateTimeStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const task = taskRepo.findById(sr.taskId);
    const taskTitle = task ? task.title : 'Task Deliverable';

    // IMMEDIATE NOTIFICATION DELIVERY TO CONCERNED EMPLOYEE(S)
    const recipientUser = userRepo.findById(sr.recipientUserId) || (await userRepo.fetchFromCloudById(sr.recipientUserId));
    if (recipientUser) {
      const tmpl = notifTemplates.meetingScheduled(sr.question, dateFormatted, timeFormatted);
      await createNotification({
        recipientUserId: sr.recipientUserId,
        eventType: 'STATUS_REQUESTED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: sr.taskId,
        relatedStatusRequestId: sr.id,
        navigationUrl: `/employee/tasks/${sr.taskId}`,
      });
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'status_request',
      entityId: sr.id,
      eventType: 'STATUS_REQUEST_SENT',
      message: `Google Meet discussion scheduled for ${dateFormatted} at ${timeFormatted} IST and published to employee.`,
    });

    res.status(200).json({ success: true, data: updatedMeeting });
  })
);

// PATCH /api/admin/status-requests/:requestId/meetings (Reschedule)
router.patch(
  '/status-requests/:requestId/meetings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const sr = statusRequestRepo.findById(requestId);
    if (!sr) {
      res.status(404).json({ success: false, error: 'Status Request not found' });
      return;
    }

    const meeting = meetingRepo.findByStatusRequest(requestId);
    if (!meeting) {
      res.status(404).json({ success: false, error: 'Meeting record not found' });
      return;
    }

    const { date, time, description } = req.body;
    let scheduledAt = meeting.scheduledAt;

    if (date && time) {
      const scheduledDateTimeStr = `${date}T${time}:00`;
      const dateObj = new Date(scheduledDateTimeStr);
      if (!isNaN(dateObj.getTime())) {
        scheduledAt = dateObj.toISOString();
      }
    }

    const updatedMeeting = await meetingRepo.update(meeting.id, {
      scheduledAt,
      description: description !== undefined ? description : meeting.description,
      status: 'scheduled',
    });

    if (date && time) {
      const dateFormatted = new Date(`${date}T${time}:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timeFormatted = new Date(`${date}T${time}:00`).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const tmpl = notifTemplates.meetingScheduled(sr.question, dateFormatted, timeFormatted);
      await createNotification({
        recipientUserId: sr.recipientUserId,
        eventType: 'STATUS_REQUESTED',
        title: `Google Meet Rescheduled`,
        body: `Your administrator has rescheduled the Google Meet discussion for status request '${sr.question}' to ${dateFormatted} at ${timeFormatted} IST.`,
        relatedTaskId: sr.taskId,
        relatedStatusRequestId: sr.id,
        navigationUrl: `/employee/tasks/${sr.taskId}`,
      });
    }

    res.status(200).json({ success: true, data: updatedMeeting });
  })
);

// POST /api/admin/status-requests/:requestId/meetings/cancel (Cancel Meeting)
router.post(
  '/status-requests/:requestId/meetings/cancel',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const sr = statusRequestRepo.findById(requestId);
    if (!sr) {
      res.status(404).json({ success: false, error: 'Status Request not found' });
      return;
    }

    const meeting = meetingRepo.findByStatusRequest(requestId);
    if (!meeting) {
      res.status(404).json({ success: false, error: 'Meeting record not found' });
      return;
    }

    const cancelledMeeting = await meetingRepo.update(meeting.id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });

    const tmpl = notifTemplates.meetingCancelled(sr.question);
    await createNotification({
      recipientUserId: sr.recipientUserId,
      eventType: 'STATUS_REQUESTED',
      title: tmpl.title,
      body: tmpl.body,
      relatedTaskId: sr.taskId,
      relatedStatusRequestId: sr.id,
      navigationUrl: `/employee/tasks/${sr.taskId}`,
    });

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'status_request',
      entityId: sr.id,
      eventType: 'STATUS_REQUEST_SENT',
      message: `Google Meet discussion cancelled by administrator.`,
    });

    res.status(200).json({ success: true, data: cancelledMeeting });
  })
);

// GET /api/status-requests/:requestId/meeting (Get meeting for admin or authorized recipient)
router.get(
  '/status-requests/:requestId/meeting',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const sr = statusRequestRepo.findById(requestId);

    if (!sr) {
      res.status(404).json({ success: false, error: 'Status Request not found' });
      return;
    }

    // Authorization check: User must be admin or the recipient employee
    if (req.session.role !== 'admin' && sr.recipientUserId !== req.session.userId) {
      res.status(403).json({ success: false, error: 'Unauthorized to access meeting for this request' });
      return;
    }

    let meeting = meetingRepo.findByStatusRequest(requestId);
    if (!meeting) {
      meeting = await meetingRepo.fetchFromCloudByStatusRequest(requestId);
    }

    // Hide draft meetings from non-admin employees
    if (meeting && meeting.status === 'draft' && req.session.role !== 'admin') {
      res.json({ success: true, data: null });
      return;
    }

    res.json({ success: true, data: meeting || null });
  })
);

export default router;
