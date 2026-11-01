import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  RotateCcw,
  MessageSquare,
  History,
  Send,
  Ban,
  User,
  Users,
  Bell,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { taskApi, statusRequestApi, queryApi, chatApi, reminderApi } from '../../services/api';
import { formatDate, formatDateTime, formatRelative, isOverdue } from '../../utils/formatDate';
import {
  getStatusColors,
  getStatusLabel,
  getPriorityColors,
  getPriorityLabel,
} from '../../utils/statusHelpers';
import type { TaskWithMembers, AuditEvent, Query, StatusRequest, ChatMessage } from '../../types';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'members' | 'status_requests' | 'queries' | 'chat' | 'history'>('members');

  // Modals
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [revisionReason, setRevisionReason] = useState('');

  const [statusReqModalOpen, setStatusReqModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState('What is the current update?');
  const [customQuestion, setCustomQuestion] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  // Chat message input
  const [chatInput, setChatInput] = useState('');

  // Fetch Task
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['admin-task-detail', id],
    queryFn: async () => {
      const res = await taskApi.getById(id!);
      if (!res.data?.data) {
        throw new Error(res.data?.error || 'Failed to load task details');
      }
      return res.data.data as TaskWithMembers;
    },
    enabled: !!id,
    refetchInterval: 10000,
  });

  // Fetch History
  const { data: history = [] } = useQuery({
    queryKey: ['task-history', id],
    queryFn: async () => {
      const res = await taskApi.getHistory(id!);
      return (res.data?.data ?? []) as AuditEvent[];
    },
    enabled: !!id && activeTab === 'history',
  });

  // Fetch Queries
  const { data: queries = [] } = useQuery({
    queryKey: ['task-queries', id],
    queryFn: async () => {
      const res = await queryApi.getByTask(id!);
      return (res.data?.data ?? []) as Query[];
    },
    enabled: !!id,
  });

  // Fetch Chat
  const { data: chatMessages = [] } = useQuery({
    queryKey: ['task-chat', id],
    queryFn: async () => {
      const res = await chatApi.getMessages(id!);
      return (res.data?.data ?? []) as ChatMessage[];
    },
    enabled: !!id && activeTab === 'chat',
    refetchInterval: 4000,
  });

  // Fetch Presets
  const { data: presets = [] } = useQuery({
    queryKey: ['status-request-presets'],
    queryFn: async () => {
      const res = await statusRequestApi.getPresets();
      return (res.data?.data ?? []) as string[];
    },
  });

  // Fetch all status requests for this task
  const { data: allStatusRequests = [] } = useQuery({
    queryKey: ['status-requests'],
    queryFn: async () => {
      const res = await statusRequestApi.getAll();
      return (res.data?.data ?? []) as StatusRequest[];
    },
    enabled: activeTab === 'status_requests',
  });

  const taskStatusRequests = allStatusRequests.filter((sr) => sr.taskId === id);

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (memberId: string) => taskApi.approveMember(id!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-task-detail', id] });
    },
  });

  const revisionMutation = useMutation({
    mutationFn: () => taskApi.requestRevision(id!, selectedMemberId!, revisionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-task-detail', id] });
      setRevisionModalOpen(false);
      setRevisionReason('');
      setSelectedMemberId(null);
    },
  });

  const sendStatusReqMutation = useMutation({
    mutationFn: (payload: unknown) => statusRequestApi.send(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-task-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['status-requests'] });
      setStatusReqModalOpen(false);
      setCustomQuestion('');
    },
  });

  const cancelTaskMutation = useMutation({
    mutationFn: () => taskApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-task-detail', id] });
    },
  });

  const sendChatMutation = useMutation({
    mutationFn: (msg: string) => chatApi.sendMessage(id!, msg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-chat', id] });
      setChatInput('');
    },
  });

  const [reminderToast, setReminderToast] = useState<string | null>(null);

  const triggerTaskReminderMutation = useMutation({
    mutationFn: () => reminderApi.triggerIST({ taskId: id, forceAll: true }),
    onSuccess: (res) => {
      const data = res.data?.data as { dispatchedCount?: number } | undefined;
      const dispatched = data?.dispatchedCount ?? 0;
      setReminderToast(
        dispatched > 0
          ? `Dispatched pending task notification to ${dispatched} assigned employee(s)! 🚀`
          : 'All assigned employees have already submitted or were already notified.'
      );
      queryClient.invalidateQueries({ queryKey: ['admin-task-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setTimeout(() => setReminderToast(null), 5000);
    },
    onError: (err: any) => {
      setReminderToast(err?.response?.data?.error || 'Failed to dispatch notification.');
      setTimeout(() => setReminderToast(null), 4000);
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Task Detail">
        <PageLoader />
      </AppLayout>
    );
  }

  if (error || !task) {
    return (
      <AppLayout title="Task Detail">
        <div className="p-6 bg-[#FFF0F0] text-[#D64545] rounded-xl border border-[#F5B8B8]">
          Task record could not be loaded or was not found.
        </div>
      </AppLayout>
    );
  }

  const statusColors = getStatusColors(task.status);
  const priorityColors = getPriorityColors(task.priority);
  const overdue = isOverdue(task.deadline) && task.status !== 'approved';

  const handleOpenStatusRequest = () => {
    setSelectedRecipients(task.members.map((m) => m.userId));
    setStatusReqModalOpen(true);
  };

  const handleSendStatusRequest = () => {
    const q = customQuestion.trim() ? customQuestion.trim() : selectedQuestion;
    sendStatusReqMutation.mutate({
      question: q,
      recipientUserIds: selectedRecipients,
    });
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMutation.mutate(chatInput.trim());
  };

  return (
    <AppLayout title={`Task: ${task.referenceNumber}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation back */}
        <button
          type="button"
          onClick={() => navigate('/admin/tasks')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3157A4] hover:underline cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to All Tasks</span>
        </button>

        {/* Task Header Box */}
        <Card className="border-l-4 border-l-[#3157A4]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E4E8EF]">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">
                  {task.referenceNumber}
                </span>
                <span className="text-xs text-[#667085]">•</span>
                <span className="text-xs font-medium text-[#172033] capitalize flex items-center gap-1">
                  {task.assignmentType === 'group' ? <Users size={14} /> : <User size={14} />}
                  {task.assignmentType} Task
                </span>
                {task.department && (
                  <>
                    <span className="text-xs text-[#667085]">•</span>
                    <span className="text-xs text-[#667085]">{task.department}</span>
                  </>
                )}
              </div>
              <h1 className="text-xl font-bold text-[#172033]">{task.title}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                bg={priorityColors.bg}
                color={priorityColors.text}
                border={priorityColors.border}
                size="md"
              >
                {getPriorityLabel(task.priority)} Priority
              </Badge>
              <Badge
                bg={statusColors.bg}
                color={statusColors.text}
                border={statusColors.border}
                size="md"
              >
                {getStatusLabel(task.status)}
              </Badge>
              {task.status !== 'cancelled' && task.status !== 'approved' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerTaskReminderMutation.mutate()}
                    loading={triggerTaskReminderMutation.isPending}
                  >
                    <Bell size={14} />
                    Dispatch Pending Alert Now
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this task? This action cannot be reversed.')) {
                        cancelTaskMutation.mutate();
                      }
                    }}
                    loading={cancelTaskMutation.isPending}
                  >
                    <Ban size={14} />
                    Cancel Task
                  </Button>
                </>
              )}
            </div>
          </div>

          {reminderToast && (
            <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle size={15} className="text-blue-600 shrink-0" />
              <span>{reminderToast}</span>
            </div>
          )}

          {/* Metadata bar */}
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#667085] block">Target Deadline (IST)</span>
              <span className={`font-semibold flex items-center gap-1 mt-0.5 ${overdue ? 'text-[#D64545]' : 'text-[#172033]'}`}>
                <Calendar size={13} />
                {formatDate(task.deadline)}
                {overdue && ' (Overdue)'}
              </span>
            </div>
            <div>
              <span className="text-[#667085] block">Assigned Personnel</span>
              <span className="font-semibold text-[#172033] mt-0.5 block">
                {task.members.length} {task.members.length === 1 ? 'Employee' : 'Employees'}
              </span>
            </div>
            <div>
              <span className="text-[#667085] block">Timezone Standard</span>
              <span className="font-semibold text-[#172033] mt-0.5 block">
                {task.timezone || 'Asia/Kolkata'} (IST • UTC+5:30)
              </span>
            </div>
            <div>
              <span className="text-[#667085] block">Automated Reminder Slots (IST)</span>
              <span className="font-semibold text-[#172033] mt-0.5 block">
                {task.reminderEnabled && task.reminderTimes && task.reminderTimes.length > 0
                  ? `Active: ${task.reminderTimes.join(', ')} IST`
                  : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="mt-4 pt-4 border-t border-[#E4E8EF]">
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wider mb-1">
              Deliverable Scope & Instructions
            </p>
            <p className="text-sm text-[#172033] leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>

          {task.managerNote && (
            <div className="mt-3 p-3 bg-[#FFF8E7] border border-[#F5D87E] rounded-lg">
              <span className="text-xs font-bold text-[#C58A20] block mb-0.5">Internal Manager Note:</span>
              <p className="text-xs text-[#172033]">{task.managerNote}</p>
            </div>
          )}
        </Card>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E4E8EF] gap-3 sm:gap-6 text-xs sm:text-sm font-medium overflow-x-auto whitespace-nowrap pb-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'members'
                ? 'border-[#3157A4] text-[#3157A4] font-bold'
                : 'border-transparent text-[#667085] hover:text-[#172033]'
            }`}
          >
            Assignees & Review ({task.members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('status_requests')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'status_requests'
                ? 'border-[#3157A4] text-[#3157A4] font-bold'
                : 'border-transparent text-[#667085] hover:text-[#172033]'
            }`}
          >
            Status Requests ({taskStatusRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('queries')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'queries'
                ? 'border-[#3157A4] text-[#3157A4] font-bold'
                : 'border-transparent text-[#667085] hover:text-[#172033]'
            }`}
          >
            Queries ({queries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'chat'
                ? 'border-[#3157A4] text-[#3157A4] font-bold'
                : 'border-transparent text-[#667085] hover:text-[#172033]'
            }`}
          >
            Team Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#3157A4] text-[#3157A4] font-bold'
                : 'border-transparent text-[#667085] hover:text-[#172033]'
            }`}
          >
            Activity History
          </button>
        </div>

        {/* TAB 1: MEMBERS & INDIVIDUAL SUBMISSION REVIEW */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#172033]">Assigned Team Status & Submissions</h3>
                <p className="text-xs text-[#667085]">
                  Monitor individual employee execution and approve or request revisions
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleOpenStatusRequest} className="w-full sm:w-auto">
                <MessageSquare size={14} />
                Send Status Request
              </Button>
            </div>

            <Card padding={false} className="overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#FBFBFC] border-b border-[#E4E8EF] text-[#667085]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Assignee</th>
                    <th className="py-3 px-4 font-semibold">Current State</th>
                    <th className="py-3 px-4 font-semibold">Submission Note</th>
                    <th className="py-3 px-4 font-semibold">Submitted At</th>
                    <th className="py-3 px-4 font-semibold">Reminder Status</th>
                    <th className="py-3 px-4 text-right font-semibold">Manager Review Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E8EF]">
                  {task.members.map((m) => {
                    const mColors = getStatusColors(m.memberStatus);
                    return (
                      <tr key={m.id} className="hover:bg-[#F9FBFF] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#EBF3FF] border border-[#B8D0F5] text-[#3157A4] font-bold flex items-center justify-center text-xs">
                              {m.user?.fullName?.charAt(0) ?? 'U'}
                            </div>
                            <div>
                              <p className="font-semibold text-[#172033]">{m.user?.fullName}</p>
                              <p className="text-[11px] text-[#667085]">
                                {m.user?.employeeId} • {m.user?.department}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge bg={mColors.bg} color={mColors.text} border={mColors.border}>
                            {getStatusLabel(m.memberStatus)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate">
                          {m.submissionNote ? (
                            <span className="text-[#172033] italic">"{m.submissionNote}"</span>
                          ) : (
                            <span className="text-[#667085]">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#667085]">
                          {m.submittedAt ? formatDateTime(m.submittedAt) : 'Pending'}
                        </td>
                        <td className="py-3.5 px-4">
                          {m.reminderEligible ? (
                            <span className="text-[11px] text-[#16865B] font-medium">Eligible (Receiving)</span>
                          ) : (
                            <span className="text-[11px] text-[#667085]">Halted</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {m.memberStatus === 'submitted_for_review' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => approveMutation.mutate(m.id)}
                                  loading={approveMutation.isPending}
                                >
                                  <CheckCircle size={14} />
                                  Approve
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMemberId(m.id);
                                    setRevisionModalOpen(true);
                                  }}
                                >
                                  <RotateCcw size={14} />
                                  Request Revision
                                </Button>
                              </>
                            )}
                            {m.memberStatus === 'approved' && (
                              <span className="text-xs text-[#16865B] font-semibold flex items-center gap-1">
                                <CheckCircle size={14} /> Approved
                              </span>
                            )}
                            {m.memberStatus === 'revision_requested' && (
                              <span className="text-xs text-[#C07020] font-semibold">
                                Revision Pending
                              </span>
                            )}
                            {m.memberStatus !== 'submitted_for_review' &&
                              m.memberStatus !== 'approved' &&
                              m.memberStatus !== 'revision_requested' && (
                                <span className="text-xs text-[#667085]">Awaiting Submission</span>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden p-3.5 space-y-3">
              {task.members.map((m) => {
                const mColors = getStatusColors(m.memberStatus);
                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl border border-[#E4E8EF] bg-white shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#EBF3FF] border border-[#B8D0F5] text-[#3157A4] font-bold flex items-center justify-center text-xs">
                          {m.user?.fullName?.charAt(0) ?? 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-[#172033]">{m.user?.fullName}</p>
                          <p className="text-[10px] text-[#667085]">{m.user?.employeeId} • {m.user?.department}</p>
                        </div>
                      </div>
                      <Badge bg={mColors.bg} color={mColors.text} border={mColors.border} size="sm">
                        {getStatusLabel(m.memberStatus)}
                      </Badge>
                    </div>

                    {m.submissionNote && (
                      <div className="p-2.5 bg-[#F8FAFD] rounded-lg border border-[#E4E8EF] text-xs">
                        <span className="text-[10px] text-[#667085] font-semibold uppercase block mb-0.5">Submission Note:</span>
                        <span className="text-[#172033] italic">"{m.submissionNote}"</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-[#667085] pt-1 border-t border-[#E4E8EF]/60">
                      <span>Submitted: {m.submittedAt ? formatDateTime(m.submittedAt) : 'Pending'}</span>
                      <span>{m.reminderEligible ? 'Reminders: Active' : 'Reminders: Halted'}</span>
                    </div>

                    <div className="pt-2 border-t border-[#E4E8EF] flex items-center justify-end gap-2">
                      {m.memberStatus === 'submitted_for_review' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(m.id)}
                            loading={approveMutation.isPending}
                            className="bg-[#16865B] hover:bg-[#126b48] text-xs"
                          >
                            <CheckCircle size={13} />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setSelectedMemberId(m.id);
                              setRevisionModalOpen(true);
                            }}
                            className="text-xs"
                          >
                            <RotateCcw size={13} />
                            Request Revision
                          </Button>
                        </>
                      )}
                      {m.memberStatus === 'approved' && (
                        <span className="text-xs text-[#16865B] font-semibold flex items-center gap-1">
                          <CheckCircle size={14} /> Approved
                        </span>
                      )}
                      {m.memberStatus === 'revision_requested' && (
                        <span className="text-xs text-[#C07020] font-semibold">
                          Revision Pending
                        </span>
                      )}
                      {m.memberStatus !== 'submitted_for_review' &&
                        m.memberStatus !== 'approved' &&
                        m.memberStatus !== 'revision_requested' && (
                          <span className="text-xs text-[#667085]">Awaiting Submission</span>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          </div>
        )}

        {/* TAB 2: STATUS REQUESTS / INTERROGATION */}
        {activeTab === 'status_requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172033]">Interrogation & Status Requests</h3>
                <p className="text-xs text-[#667085]">
                  Questions dispatched by management to monitor progress and identify blockers
                </p>
              </div>
              <Button size="sm" onClick={handleOpenStatusRequest}>
                <MessageSquare size={14} />
                New Request
              </Button>
            </div>

            {taskStatusRequests.length === 0 ? (
              <Card className="text-center py-8 text-xs text-[#667085]">
                No status requests have been initiated on this task yet.
              </Card>
            ) : (
              <div className="space-y-3">
                {taskStatusRequests.map((sr) => (
                  <Card key={sr.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#172033]">{sr.question}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              sr.status === 'answered'
                                ? 'bg-[#EDFAF4] text-[#16865B] border border-[#A8DFC5]'
                                : 'bg-[#FFF8E7] text-[#C58A20] border border-[#F5D87E]'
                            }`}
                          >
                            {sr.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#667085] mt-1">
                          Sent to: <span className="font-semibold text-[#172033]">{sr.recipientName}</span> •{' '}
                          {formatRelative(sr.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Responses */}
                    {sr.responses && sr.responses.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#E4E8EF] space-y-2">
                        {sr.responses.map((resp) => (
                          <div key={resp.id} className="p-2.5 bg-[#F9FBFF] rounded-lg border border-[#E4E8EF]">
                            <p className="text-xs font-semibold text-[#3157A4] mb-0.5">
                              Employee Response:
                            </p>
                            <p className="text-xs text-[#172033] whitespace-pre-wrap">{resp.responseText}</p>
                            <span className="text-[10px] text-[#667085] mt-1 block">
                              Submitted {formatDateTime(resp.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUERIES */}
        {activeTab === 'queries' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#172033]">Employee Queries on this Task</h3>
            {queries.length === 0 ? (
              <Card className="text-center py-8 text-xs text-[#667085]">
                No queries have been raised on this task.
              </Card>
            ) : (
              <div className="space-y-3">
                {queries.map((q) => (
                  <Card key={q.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[#172033]">{q.title}</h4>
                      <Badge size="sm">{q.status}</Badge>
                    </div>
                    <p className="text-xs text-[#667085] mt-1">{q.description}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#667085]">
                      <span>Raised by {q.creatorName}</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate('/admin/queries')}
                      >
                        Open Query Thread
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: GROUP TEAM CHAT */}
        {activeTab === 'chat' && (
          <Card className="p-0 overflow-hidden flex flex-col h-96">
            <div className="p-3 bg-[#FBFBFC] border-b border-[#E4E8EF] flex items-center justify-between">
              <span className="text-xs font-bold text-[#172033]">Task Discussion & Collaboration</span>
              <span className="text-[11px] text-[#667085]">{chatMessages.length} messages</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#667085]">
                  No messages yet. Send a note to the team.
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-[#172033]">{msg.senderName}</span>
                      <span className="text-[10px] text-[#667085] capitalize">({msg.senderRole})</span>
                      <span className="text-[10px] text-[#667085]">{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <div className="p-2.5 bg-[#F5F7FA] rounded-lg text-xs text-[#172033] max-w-lg leading-relaxed">
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="p-3 border-t border-[#E4E8EF] flex gap-2">
              <input
                type="text"
                placeholder="Type a team message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
              />
              <Button type="submit" size="sm" loading={sendChatMutation.isPending}>
                <Send size={14} />
                Send
              </Button>
            </form>
          </Card>
        )}

        {/* TAB 5: AUDIT HISTORY */}
        {activeTab === 'history' && (
          <Card padding={false} className="overflow-hidden">
            <div className="p-4 bg-[#FBFBFC] border-b border-[#E4E8EF]">
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Immutable Task Audit Log
              </h3>
            </div>
            <div className="divide-y divide-[#E4E8EF]">
              {history.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#667085]">No recorded history events.</div>
              ) : (
                history.map((event) => (
                  <div key={event.id} className="p-3.5 flex items-start gap-3 text-xs">
                    <History size={16} className="text-[#3157A4] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-[#172033]">{event.message}</p>
                      <div className="flex items-center gap-2 text-[11px] text-[#667085] mt-0.5">
                        <span>By {event.actorName}</span>
                        <span>•</span>
                        <span>{formatDateTime(event.createdAt)}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-[#667085] bg-[#F5F7FA] px-2 py-0.5 rounded border border-[#E4E8EF]">
                      {event.eventType}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Modal: Request Revision */}
        <Modal
          isOpen={revisionModalOpen}
          onClose={() => setRevisionModalOpen(false)}
          title="Request Deliverable Revision"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setRevisionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => revisionMutation.mutate()}
                loading={revisionMutation.isPending}
                disabled={!revisionReason.trim()}
              >
                Send Revision Notice
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-[#667085]">
              Specify the exact adjustments, missing deliverables, or fixes required from the employee before this task can be approved.
            </p>
            <Textarea
              label="Detailed Revision Reason *"
              placeholder="e.g. Please update the executive summary and verify figures on slide 4..."
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              rows={4}
              required
            />
          </div>
        </Modal>

        {/* Modal: Status Request */}
        <Modal
          isOpen={statusReqModalOpen}
          onClose={() => setStatusReqModalOpen(false)}
          title="Send Status Interrogation Request"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setStatusReqModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendStatusRequest}
                loading={sendStatusReqMutation.isPending}
                disabled={selectedRecipients.length === 0}
              >
                Send Request
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#172033] block mb-1">
                Choose Preset Inquiry
              </label>
              <select
                value={selectedQuestion}
                onChange={(e) => {
                  setSelectedQuestion(e.target.value);
                  setCustomQuestion('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
              >
                {presets.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <Textarea
              label="Or Custom Inquiry (Overrides preset)"
              placeholder="Write a custom question..."
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              rows={2}
            />

            <div>
              <label className="text-xs font-semibold text-[#172033] block mb-1.5">
                Target Recipients ({selectedRecipients.length} of {task.members.length} selected)
              </label>
              <div className="space-y-1.5 border border-[#E4E8EF] p-2 rounded-lg max-h-36 overflow-y-auto">
                {task.members.map((m) => (
                  <label key={m.userId} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(m.userId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecipients([...selectedRecipients, m.userId]);
                        } else {
                          setSelectedRecipients(selectedRecipients.filter((u) => u !== m.userId));
                        }
                      }}
                      className="text-[#3157A4] rounded"
                    />
                    <span>{m.user?.fullName} ({m.user?.employeeId})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}

