// ============================================================
// STATUS REQUESTS ROUTES
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import {
  statusRequestRepo,
  statusResponseRepo,
  taskRepo,
  taskMemberRepo,
  userRepo,
  meetingRepo,
} from '../repositories/inMemoryStore.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuditEvent, createNotification, notifTemplates } from '../services/notificationService.js';
import { createGoogleMeetSpace } from '../services/googleMeetService.js';

const PRESET_QUESTIONS = [
  'What is the current update?',
  'How much progress has been made?',
  'Are you facing any blockers?',
  'Is the task progressing according to the plan?',
  'What remains before completion?',
  'Has the issue been resolved?',
  'Will the task be completed before the deadline?',
];

// Router for /api/status-requests
const router = Router();

// GET /api/status-requests/presets
router.get('/presets', requireAdmin, (_req, res) => {
  res.json({ success: true, data: PRESET_QUESTIONS });
});

// GET /api/status-requests - Admin sees all; Employee sees their own
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.session.role === 'admin';
    let requests = isAdmin
      ? statusRequestRepo.findAll()
      : statusRequestRepo.findByRecipient(req.session.userId!);

    // Enrich with task info, responses, and meetings
    const enriched = requests.map((sr) => {
      const task = taskRepo.findById(sr.taskId);
      const responses = statusResponseRepo.findByRequest(sr.id);
      const creator = userRepo.findById(sr.createdBy);
      const recipient = userRepo.findById(sr.recipientUserId);
      let meeting = sr.meetingId
        ? meetingRepo.findById(sr.meetingId)
        : meetingRepo.findByStatusRequest(sr.id);
      if (!meeting && task && task.meetingId) {
        meeting = meetingRepo.findById(task.meetingId);
      }
      if (meeting && meeting.status === 'draft' && !isAdmin) {
        meeting = undefined;
      }
      return {
        ...sr,
        task: task ? { id: task.id, title: task.title, referenceNumber: task.referenceNumber } : null,
        responses,
        creatorName: creator?.fullName ?? 'Unknown',
        recipientName: recipient?.fullName ?? 'Unknown',
        meeting: meeting || null,
      };
    });

    res.json({ success: true, data: enriched });
  })
);

// POST /api/status-requests/:id/respond - Employee responds
router.post(
  '/:id/respond',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sr = statusRequestRepo.findById(req.params.id);
    if (!sr) {
      res.status(404).json({ success: false, error: 'Status request not found' });
      return;
    }

    // Only the intended recipient can respond
    if (req.session.role !== 'admin' && sr.recipientUserId !== req.session.userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const schema = z.object({
      responseText: z.string().min(1, 'Response is required'),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const response = await statusResponseRepo.create({
      statusRequestId: sr.id,
      responderUserId: req.session.userId!,
      responseText: parse.data.responseText,
      createdAt: new Date().toISOString(),
    });

    await statusRequestRepo.update(sr.id, { status: 'answered' });

    const task = taskRepo.findById(sr.taskId);
    const responder = userRepo.findById(req.session.userId!);
    if (task && responder) {
      const tmpl = notifTemplates.statusResponseReceived(responder.fullName, task.title);
      await createNotification({
        recipientUserId: sr.createdBy,
        eventType: 'STATUS_RESPONSE_RECEIVED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: sr.taskId,
        relatedStatusRequestId: sr.id,
      });
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'status_request',
      entityId: sr.id,
      eventType: 'STATUS_RESPONSE_GIVEN',
      message: `Status response submitted`,
    });

    res.status(201).json({ success: true, data: response });
  })
);

// Router for task-nested status requests mounted at /api/tasks
export const taskStatusRequestRouter = Router();

// POST /api/tasks/:taskId/status-requests - Admin sends a status request
taskStatusRequestRouter.post(
  '/:taskId/status-requests',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const task = taskRepo.findById(req.params.taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const schema = z.object({
      question: z.string().min(5, 'Question is required'),
      recipientUserIds: z.array(z.string()).min(1, 'At least one recipient required'),
      isPreset: z.boolean().optional().default(false),
      responseDeadline: z.string().nullable().optional(),
      includeMeet: z.boolean().optional().default(false),
      meetDate: z.string().optional().default(''),
      meetTime: z.string().optional().default(''),
      meetDescription: z.string().optional().default(''),
      accessToken: z.string().optional(),
      meetingUri: z.string().optional(),
      googleSpaceName: z.string().optional(),
      meetingCode: z.string().optional(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.errors[0].message });
      return;
    }

    const {
      question,
      recipientUserIds,
      responseDeadline,
      includeMeet,
      meetDate,
      meetTime,
      meetDescription,
      accessToken,
      meetingUri,
      googleSpaceName,
    } = parse.data;

    const now = new Date().toISOString();
    const created = [];

    // If Google Meet is requested, generate ONE single genuine space shared across all recipients
    let sharedMeeting: any = null;
    let dateFormatted = '';
    let timeFormatted = '';

    if (includeMeet) {
      const spaceResult = await createGoogleMeetSpace(
        req.session.userId!,
        accessToken,
        task.id,
        meetingUri,
        googleSpaceName
      );

      let meetingStatus: 'draft' | 'scheduled' = 'draft';
      let scheduledAtIso: string | null = null;
      let publishedAtIso: string | null = null;

      if (meetDate && meetTime) {
        const scheduledDateTimeStr = `${meetDate}T${meetTime}:00+05:30`;
        const dateObj = new Date(scheduledDateTimeStr);
        if (!isNaN(dateObj.getTime())) {
          meetingStatus = 'scheduled';
          scheduledAtIso = dateObj.toISOString();
          publishedAtIso = now;

          const istNowStr = new Date().toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          const meetingDateIstStr = dateObj.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          const isToday = istNowStr === meetingDateIstStr;

          dateFormatted = dateObj.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          timeFormatted = dateObj
            .toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
            .toUpperCase();
        }
      }

      sharedMeeting = await meetingRepo.create({
        statusRequestId: '', // Will be linked below
        taskId: task.id,
        createdByAdminUid: req.session.userId!,
        googleSpaceName: spaceResult.googleSpaceName,
        meetingUri: spaceResult.meetingUri,
        meetingTitle: `Google Meet Discussion: Status Request on ${task.title}`,
        description: meetDescription,
        status: meetingStatus,
        scheduledAt: scheduledAtIso,
        publishedAt: publishedAtIso,
        timezone: 'Asia/Kolkata',
      });

      await taskRepo.update(task.id, { meetingId: sharedMeeting.id });
    }

    for (const userId of recipientUserIds) {
      // Verify the user is a task member
      const member = taskMemberRepo.findByTaskAndUser(task.id, userId);
      if (!member) continue;

      const sr = await statusRequestRepo.create({
        taskId: task.id,
        createdBy: req.session.userId!,
        recipientUserId: userId,
        question,
        status: 'pending',
        createdAt: now,
        responseDeadline: responseDeadline ?? null,
        meetingId: sharedMeeting ? sharedMeeting.id : undefined,
      });

      if (sharedMeeting) {
        if (!sharedMeeting.statusRequestId) {
          sharedMeeting.statusRequestId = sr.id;
          await meetingRepo.update(sharedMeeting.id, { statusRequestId: sr.id });
        }
        (sr as any).meeting = sharedMeeting;
      }

      // Standard status request notification
      const tmpl = notifTemplates.statusRequested(task.title);
      await createNotification({
        recipientUserId: userId,
        eventType: 'STATUS_REQUESTED',
        title: tmpl.title,
        body: tmpl.body,
        relatedTaskId: task.id,
        relatedStatusRequestId: sr.id,
        navigationUrl: `/employee/tasks/${task.id}`,
      });

      // If scheduled Google Meet discussion included, send immediate meeting notification
      if (sharedMeeting && sharedMeeting.status === 'scheduled' && dateFormatted && timeFormatted) {
        const istNowStr = new Date().toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const dateObj = new Date(`${meetDate}T${meetTime}:00+05:30`);
        const meetingDateIstStr = dateObj.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const isToday = istNowStr === meetingDateIstStr;

        const meetTmpl = notifTemplates.meetingScheduled(dateFormatted, timeFormatted, isToday);
        await createNotification({
          recipientUserId: userId,
          eventType: 'STATUS_REQUESTED',
          title: meetTmpl.title,
          body: meetTmpl.body,
          relatedTaskId: task.id,
          relatedStatusRequestId: sr.id,
          navigationUrl: `/employee/tasks/${task.id}`,
        });
      }

      created.push(sr);
    }

    await createAuditEvent({
      actorUserId: req.session.userId!,
      entityType: 'status_request',
      entityId: task.id,
      eventType: 'STATUS_REQUEST_SENT',
      message: `Status request sent to ${recipientUserIds.length} recipient(s)`,
    });

    res.status(201).json({ success: true, data: created });
  })
);

export default router;
