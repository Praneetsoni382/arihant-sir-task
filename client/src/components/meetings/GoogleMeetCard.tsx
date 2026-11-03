import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Video,
  Copy,
  Check,
  Calendar,
  Clock,
  ExternalLink,
  Plus,
  AlertCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { meetingApi } from '../../services/api';
import type { Meeting, StatusRequest } from '../../types';

interface Props {
  statusRequest: StatusRequest;
  isAdmin: boolean;
  onOpenGoogleConnect?: () => void;
}

const TODAY_ISO = new Date().toISOString().split('T')[0];

export function GoogleMeetCard({ statusRequest, isAdmin, onOpenGoogleConnect }: Props) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const [creationError, setCreationError] = useState('');
  const [isCreatingMeet, setIsCreatingMeet] = useState(false);

  // Fetch or retrieve meeting associated with status request
  const { data: meeting } = useQuery({
    queryKey: ['status-request-meeting', statusRequest.id],
    queryFn: async () => {
      const res = await meetingApi.getMeetingByRequest(statusRequest.id);
      return res.data?.data as Meeting | null;
    },
    refetchInterval: 6000,
  });

  // Create Genuine Meet Link using Google Meet REST API v2
  const handleCreateRealMeetLink = async () => {
    setCreationError('');
    setIsCreatingMeet(true);
    try {
      const { getGoogleMeetAccessToken } = await import(
        '../../services/googleMeet'
      );

      // 1. Check if token already available locally or via backend status
      let token = (await getGoogleMeetAccessToken(false))?.accessToken;
      if (!token) {
        const statusRes = await meetingApi.getGoogleStatus();
        const isConnected = !!(statusRes.data?.data as any)?.isConnected;

        if (!isConnected) {
          if (onOpenGoogleConnect) {
            onOpenGoogleConnect();
            setIsCreatingMeet(false);
            return;
          }
          // Fall back to interactive popup only if modal callback unavailable
          const authData = await getGoogleMeetAccessToken(true);
          token = authData?.accessToken;
        }
      }

      // 2. Persist & generate genuine space on server via Google Meet REST API v2
      await meetingApi.createMeeting(statusRequest.id, {
        accessToken: token && !token.startsWith('backend_') ? token : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['status-request-meeting', statusRequest.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-status-requests'] });
      queryClient.invalidateQueries({ queryKey: ['status-requests'] });
    } catch (err: any) {
      console.error('Failed to create real Google Meet space:', err);
      const msg = err?.response?.data?.error || err?.message || err?.code || '';
      if (msg.includes('Google Meet authorization required') || msg.includes('No active Google Meet access token')) {
        setCreationError(
          'Google Meet Authorization Required: Please click "Google Settings" above to connect your Google account with Google Meet permissions.'
        );
        if (onOpenGoogleConnect) {
          onOpenGoogleConnect();
        }
      } else if (msg.includes('popup-closed-by-user') || err?.code === 'auth/popup-closed-by-user') {
        setCreationError(
          'Sign-in window closed: Please click "Google Settings" and use "Authorize via Google (Redirect Mode)" to connect seamlessly without popups.'
        );
      } else if (msg.includes('popup-blocked') || err?.code === 'auth/popup-blocked') {
        setCreationError(
          'Popup Blocked: Please click "Google Settings" and select "Authorize via Google (Redirect Mode)" to authorize directly in the main browser window.'
        );
      } else {
        setCreationError(msg || 'Failed to create real Google Meet space.');
      }
    } finally {
      setIsCreatingMeet(false);
    }
  };

  // Schedule & Publish Meeting Mutation (Admin)
  const scheduleMeetingMutation = useMutation({
    mutationFn: (data: { date: string; time: string; description?: string }) =>
      meetingApi.scheduleMeeting(statusRequest.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-request-meeting', statusRequest.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-status-requests'] });
      queryClient.invalidateQueries({ queryKey: ['status-requests'] });
      setScheduleModalOpen(false);
      setScheduleError('');
    },
    onError: (err: any) => {
      setScheduleError(err?.response?.data?.error || err?.message || 'Failed to schedule meeting');
    },
  });

  // Cancel Meeting Mutation (Admin)
  const cancelMeetingMutation = useMutation({
    mutationFn: () => meetingApi.cancelMeeting(statusRequest.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-request-meeting', statusRequest.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-status-requests'] });
      queryClient.invalidateQueries({ queryKey: ['status-requests'] });
    },
  });

  const handleCopyLink = (uri: string) => {
    navigator.clipboard.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError('');

    if (!meetingDate || !meetingTime) {
      setScheduleError('Please select both a date and time for the meeting.');
      return;
    }

    scheduleMeetingMutation.mutate({
      date: meetingDate,
      time: meetingTime,
      description: meetingDescription.trim(),
    });
  };

  // Helper formatting for IST display
  const formatISTDate = (isoStr?: string | null) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const formatISTTime = (isoStr?: string | null) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return (
        d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).toUpperCase() + ' IST'
      );
    } catch {
      return isoStr;
    }
  };

  // Do not show card to employees if no published/scheduled meeting exists
  if (!isAdmin && (!meeting || meeting.status === 'draft')) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#E4E8EF] space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#EBF3FF] border border-[#B8D0F5] text-[#3157A4] flex items-center justify-center shrink-0">
            <Video size={13} />
          </div>
          <h4 className="text-xs font-bold text-[#172033]">Google Meet Discussion</h4>
        </div>

        {meeting && (
          <Badge
            bg={
              meeting.status === 'scheduled'
                ? '#EDFAF4'
                : meeting.status === 'draft'
                ? '#FFF8E7'
                : '#FFF0F0'
            }
            color={
              meeting.status === 'scheduled'
                ? '#16865B'
                : meeting.status === 'draft'
                ? '#C58A20'
                : '#D64545'
            }
            border={
              meeting.status === 'scheduled'
                ? '#A8DFC5'
                : meeting.status === 'draft'
                ? '#F5D87E'
                : '#F5B8B8'
            }
            size="sm"
          >
            {meeting.status === 'scheduled'
              ? 'Scheduled & Published'
              : meeting.status === 'draft'
              ? 'Draft (Unpublished)'
              : 'Cancelled'}
          </Badge>
        )}
      </div>

      {/* STATE 1: No Meeting Created Yet (Admin View) */}
      {!meeting && isAdmin && (
        <div className="p-3 bg-[#F9FBFF] rounded-lg border border-[#E4E8EF] space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#667085]">
              <p className="font-semibold text-[#172033]">No meeting space created yet.</p>
              <p className="text-[11px] text-[#667085] mt-0.5">
                Generate a real Google Meet room via the official Google Meet API, schedule an IST time, and publish it to the employee.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenGoogleConnect && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenGoogleConnect}
                  className="text-xs text-[#3157A4] border-[#B8D0F5]"
                >
                  Google Settings
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleCreateRealMeetLink}
                loading={isCreatingMeet}
                className="bg-[#3157A4] hover:bg-[#264482] text-xs shrink-0"
              >
                <Plus size={13} />
                Create Meet Link
              </Button>
            </div>
          </div>

          {creationError && (
            <div className="p-2.5 bg-[#FFF0F0] text-[#D64545] rounded-lg border border-[#F5B8B8] text-xs flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-bold block">Google Meet API Notice</span>
                <span className="text-[11px] leading-relaxed block">{creationError}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATE 2: Draft Meeting Created (Unpublished - Admin View) */}
      {meeting && meeting.status === 'draft' && isAdmin && (
        <div className="p-3.5 bg-[#FFFDF5] rounded-xl border border-[#F5D87E] space-y-3">
          <div className="text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#C58A20] uppercase tracking-wider block">
                Google Meet API Space (Draft State)
              </span>
              <span className="text-[10px] text-[#16865B] font-semibold bg-[#EDFAF4] px-1.5 py-0.5 rounded border border-[#A8DFC5]">
                ✓ Verified Meet API Space
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-[#E4E8EF] text-xs font-mono text-[#3157A4]">
              <span className="truncate flex-1">{meeting.meetingUri}</span>
              <button
                type="button"
                onClick={() => handleCopyLink(meeting.meetingUri)}
                className="text-[#667085] hover:text-[#3157A4] p-1 cursor-pointer shrink-0"
                title="Copy Link"
              >
                {copied ? <Check size={14} className="text-[#16865B]" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={meeting.meetingUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3157A4] hover:bg-[#264482] text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
            >
              <Video size={13} />
              Test Join Space
              <ExternalLink size={12} />
            </a>

            <Button
              size="sm"
              onClick={() => {
                setScheduleError('');
                setScheduleModalOpen(true);
              }}
              className="bg-[#16865B] hover:bg-[#126b48] text-xs"
            >
              <Calendar size={13} />
              Schedule & Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopyLink(meeting.meetingUri)}
              className="text-xs"
            >
              {copied ? 'Link Copied!' : 'Copy Link'}
            </Button>
          </div>
        </div>
      )}

      {/* STATE 3: Scheduled & Published Meeting (Admin & Employee View) */}
      {meeting && meeting.status === 'scheduled' && (
        <div className="p-3.5 bg-[#F0F9FF] rounded-xl border border-[#B8DDFB] space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#172033]">{meeting.meetingTitle}</p>
            {meeting.description && (
              <p className="text-xs text-[#667085] italic">"{meeting.description}"</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-[#B8DDFB]/60">
            <div className="flex items-center gap-1.5 text-[#3157A4] font-semibold">
              <Calendar size={13} />
              <span>Date: {formatISTDate(meeting.scheduledAt)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#3157A4] font-semibold">
              <Clock size={13} />
              <span>Time: {formatISTTime(meeting.scheduledAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#B8DDFB] text-xs font-mono text-[#3157A4]">
            <span className="truncate flex-1 select-all">{meeting.meetingUri}</span>
            <button
              type="button"
              onClick={() => handleCopyLink(meeting.meetingUri)}
              className="text-[#667085] hover:text-[#3157A4] p-1 cursor-pointer shrink-0 transition-colors"
              title="Copy Link"
            >
              {copied ? <Check size={14} className="text-[#16865B]" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-2">
            <a
              href={meeting.meetingUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#16865B] hover:bg-[#126b48] text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
            >
              <Video size={13} />
              Join Google Meet
              <ExternalLink size={12} />
            </a>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopyLink(meeting.meetingUri)}
              className="text-xs"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>

            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setScheduleError('');
                    setScheduleModalOpen(true);
                  }}
                  className="text-xs"
                >
                  <RefreshCw size={12} />
                  Reschedule
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => cancelMeetingMutation.mutate()}
                  loading={cancelMeetingMutation.isPending}
                  className="text-xs"
                >
                  <XCircle size={12} />
                  Cancel Meeting
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* STATE 4: Cancelled Meeting */}
      {meeting && meeting.status === 'cancelled' && (
        <div className="p-3 bg-[#FFF0F0] rounded-lg border border-[#F5B8B8] text-xs text-[#D64545] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>This Google Meet discussion was cancelled by the administrator.</span>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateRealMeetLink}
              loading={isCreatingMeet}
              className="text-xs border-[#F5B8B8] text-[#D64545]"
            >
              New Meet Link
            </Button>
          )}
        </div>
      )}

      {/* MODAL: Schedule Meeting Dialog */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule & Publish Google Meet Discussion"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSchedule}
              loading={scheduleMeetingMutation.isPending}
              className="bg-[#16865B] hover:bg-[#126b48]"
            >
              Schedule & Publish
            </Button>
          </>
        }
      >
        <form onSubmit={handleConfirmSchedule} className="space-y-4 text-xs">
          <p className="text-[#667085]">
            Set the IST scheduled time for this status request discussion. Upon publication, all concerned employees will receive an immediate TaskFlow notification.
          </p>

          {scheduleError && (
            <div className="p-2.5 bg-[#FFF0F0] text-[#D64545] rounded-lg border border-[#F5B8B8] font-medium">
              {scheduleError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Meeting Date (IST) *"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              min={TODAY_ISO}
              required
            />
            <Input
              label="Meeting Start Time (IST) *"
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              required
            />
          </div>

          <Textarea
            label="Optional Agenda / Discussion Notes"
            placeholder="e.g. Review deliverable blockers and confirm revision timeline..."
            value={meetingDescription}
            onChange={(e) => setMeetingDescription(e.target.value)}
            rows={3}
          />
        </form>
      </Modal>
    </div>
  );
}
