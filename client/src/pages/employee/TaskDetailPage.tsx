import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Play,
  AlertOctagon,
  CheckCircle2,
  Send,
  MessageSquare,
  PlusCircle,
  RotateCcw,
  Users,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { taskApi, statusRequestApi, queryApi, chatApi } from '../../services/api';
import { GoogleMeetCard } from '../../components/meetings/GoogleMeetCard';
import { formatDate, formatDateTime, isOverdue } from '../../utils/formatDate';
import {
  getStatusColors,
  getStatusLabel,
  getPriorityColors,
  getPriorityLabel,
} from '../../utils/statusHelpers';
import type { TaskWithMembers, Query, StatusRequest, ChatMessage } from '../../types';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Modals
  const [blockerModalOpen, setBlockerModalOpen] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');

  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [queryForm, setQueryForm] = useState({
    title: '',
    description: '',
    category: 'clarification',
    priority: 'medium',
  });

  const [chatInput, setChatInput] = useState('');
  const [statusResponseText, setStatusResponseText] = useState('');
  const [respondingToReqId, setRespondingToReqId] = useState<string | null>(null);

  // Fetch Task
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['employee-task-detail', id],
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

  // Fetch Task Queries
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
    enabled: !!id,
    refetchInterval: 4000,
  });

  // Fetch Status Requests
  const { data: statusRequests = [] } = useQuery({
    queryKey: ['status-requests'],
    queryFn: async () => {
      const res = await statusRequestApi.getAll();
      return (res.data?.data ?? []) as StatusRequest[];
    },
    refetchInterval: 10000,
  });

  const myStatusRequests = statusRequests.filter(
    (sr) => sr.taskId === id && sr.recipientUserId === user?.id && sr.status === 'pending'
  );

  // Find employee's own member record
  const myMemberRecord = task?.members.find((m) => m.userId === user?.id);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ status, explanation }: { status: string; explanation?: string }) =>
      taskApi.updateMemberStatus(id!, myMemberRecord!.id, status, explanation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-task-detail', id] });
      setBlockerModalOpen(false);
      setBlockerReason('');
    },
  });

  const submitTaskMutation = useMutation({
    mutationFn: () =>
      taskApi.submitTask(id!, myMemberRecord!.id, submissionNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-task-detail', id] });
      setSubmitModalOpen(false);
      setSubmissionNote('');
    },
  });

  const createQueryMutation = useMutation({
    mutationFn: (data: typeof queryForm) => queryApi.create(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-queries', id] });
      setQueryModalOpen(false);
      setQueryForm({ title: '', description: '', category: 'clarification', priority: 'medium' });
    },
  });

  const sendStatusResponseMutation = useMutation({
    mutationFn: ({ reqId, text }: { reqId: string; text: string }) =>
      statusRequestApi.respond(reqId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-requests'] });
      setRespondingToReqId(null);
      setStatusResponseText('');
    },
  });

  const sendChatMutation = useMutation({
    mutationFn: (message: string) => chatApi.sendMessage(id!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-chat', id] });
      setChatInput('');
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Task Details">
        <PageLoader />
      </AppLayout>
    );
  }

  if (error || !task || !myMemberRecord) {
    return (
      <AppLayout title="Task Details">
        <div className="p-6 bg-[#FFF0F0] text-[#D64545] rounded-xl border border-[#F5B8B8]">
          Task information is unavailable or you are not authorized to view this task.
        </div>
      </AppLayout>
    );
  }

  const memberStatusColors = getStatusColors(myMemberRecord.memberStatus);
  const priorityColors = getPriorityColors(task.priority);
  const overdue = isOverdue(task.deadline) && myMemberRecord.memberStatus !== 'approved';

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMutation.mutate(chatInput.trim());
  };

  return (
    <AppLayout title={`Task: ${task.referenceNumber}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate('/employee/tasks')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3157A4] hover:underline cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to My Tasks</span>
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
                <span className="text-xs font-medium text-[#172033] capitalize">
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
                bg={memberStatusColors.bg}
                color={memberStatusColors.text}
                border={memberStatusColors.border}
                size="md"
              >
                My Status: {getStatusLabel(myMemberRecord.memberStatus)}
              </Badge>
            </div>
          </div>

          <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[#667085] block">Target Deadline</span>
              <span className={`font-semibold flex items-center gap-1 mt-0.5 ${overdue ? 'text-[#D64545]' : 'text-[#172033]'}`}>
                <Calendar size={13} />
                {formatDate(task.deadline)}
                {overdue && ' (Overdue)'}
              </span>
            </div>
            <div>
              <span className="text-[#667085] block">Assigned Colleagues</span>
              <span className="font-semibold text-[#172033] mt-0.5 block">
                {task.members.length} {task.members.length === 1 ? 'Individual' : 'Team Members'}
              </span>
            </div>
            <div>
              <span className="text-[#667085] block">Last Status Timestamp</span>
              <span className="font-semibold text-[#172033] mt-0.5 block">
                {formatDateTime(myMemberRecord.lastStatusUpdateAt)}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#E4E8EF]">
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wider mb-1">
              Deliverable Specifications & Scope
            </p>
            <p className="text-sm text-[#172033] leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        </Card>

        {/* Section 12: REVISION REQUEST NOTIFICATION (If manager requested revision) */}
        {myMemberRecord.memberStatus === 'revision_requested' && (
          <div className="p-4 bg-[#FFF4EC] border-2 border-[#C07020] rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#C07020]">
              <RotateCcw size={16} />
              <span>Manager Has Requested Revisions on Your Submission</span>
            </div>
            <p className="text-xs text-[#172033] font-medium pl-6">
              Reason specified by manager:{' '}
              <span className="font-bold">"{myMemberRecord.revisionReason}"</span>
            </p>
            <p className="text-[11px] text-[#667085] pl-6">
              Please apply the requested fixes, resume work, and submit the final revised task below.
            </p>
          </div>
        )}

        {/* SECTION 11 & 12: WORKFLOW & STATUS ACTIONS PANEL */}
        <Card className="p-5 border-2 border-[#E4E8EF]">
          <CardHeader>
            <div>
              <CardTitle>My Work Status & Lifecycle Transitions</CardTitle>
              <p className="text-xs text-[#667085]">
                Independently communicate your progress to management
              </p>
            </div>
            <Badge bg={memberStatusColors.bg} color={memberStatusColors.text} border={memberStatusColors.border}>
              {getStatusLabel(myMemberRecord.memberStatus)}
            </Badge>
          </CardHeader>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Start Working */}
            {(myMemberRecord.memberStatus === 'pending' || myMemberRecord.memberStatus === 'revision_requested') && (
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate({ status: 'in_progress' })}
                loading={updateStatusMutation.isPending}
              >
                <Play size={14} />
                Commence Work (In Progress)
              </Button>
            )}

            {/* Report Blocker */}
            {myMemberRecord.memberStatus === 'in_progress' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setBlockerModalOpen(true)}
              >
                <AlertOctagon size={14} />
                Report Work Blocker
              </Button>
            )}

            {/* Resolve Blocker */}
            {myMemberRecord.memberStatus === 'blocked' && (
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate({ status: 'in_progress', explanation: 'Blocker resolved' })}
                loading={updateStatusMutation.isPending}
              >
                <CheckCircle2 size={14} />
                Resolve Blocker (Resume)
              </Button>
            )}

            {/* Final Submission */}
            {(myMemberRecord.memberStatus === 'in_progress' || myMemberRecord.memberStatus === 'revision_requested') && (
              <Button
                size="sm"
                onClick={() => setSubmitModalOpen(true)}
                className="bg-[#16865B] hover:bg-[#126b48]"
              >
                <CheckCircle2 size={14} />
                Final Task Submission
              </Button>
            )}

            {myMemberRecord.memberStatus === 'submitted_for_review' && (
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3977C3] bg-[#F0F9FF] border border-[#B8DDFB] p-2.5 rounded-lg w-full">
                <Clock size={16} />
                <span>Your deliverable has been submitted and is currently pending Manager Review & Approval.</span>
              </div>
            )}

            {myMemberRecord.memberStatus === 'approved' && (
              <div className="flex items-center gap-2 text-xs font-semibold text-[#16865B] bg-[#EDFAF4] border border-[#A8DFC5] p-2.5 rounded-lg w-full">
                <CheckCircle2 size={16} />
                <span>Congratulations! Your task submission has been officially approved by the administrator.</span>
              </div>
            )}
          </div>
        </Card>

        {/* SECTION 13: MANAGER STATUS INQUIRIES ON THIS TASK */}
        {myStatusRequests.length > 0 && (
          <div className="p-4 bg-[#FFF8E7] border border-[#F5D87E] rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-[#C58A20] flex items-center gap-1.5">
              <MessageSquare size={15} />
              <span>Manager Status Requests Requiring Your Response</span>
            </h3>
            {myStatusRequests.map((sr) => (
              <div key={sr.id} className="p-3 bg-white rounded-lg border border-[#F5D87E] space-y-2">
                <p className="text-xs font-bold text-[#172033]">"{sr.question}"</p>
                <GoogleMeetCard statusRequest={sr} isAdmin={false} />
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Type your status update for the manager..."
                    value={respondingToReqId === sr.id ? statusResponseText : ''}
                    onChange={(e) => {
                      setRespondingToReqId(sr.id);
                      setStatusResponseText(e.target.value);
                    }}
                    className="w-full flex-1 px-3 py-2 text-xs border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
                  />
                  <Button
                    size="sm"
                    disabled={respondingToReqId !== sr.id || !statusResponseText.trim()}
                    onClick={() =>
                      sendStatusResponseMutation.mutate({ reqId: sr.id, text: statusResponseText.trim() })
                    }
                    loading={sendStatusResponseMutation.isPending}
                    className="w-full sm:w-auto justify-center"
                  >
                    Reply
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 14 & 15: QUERIES & GROUP COLLABORATION TABS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Queries Panel */}
          <Card className="flex flex-col h-96">
            <div className="p-3 border-b border-[#E4E8EF] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#172033]">Formal Queries</h3>
                <p className="text-[11px] text-[#667085]">Questions submitted to management</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setQueryModalOpen(true)}>
                <PlusCircle size={14} />
                Raise Query
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {queries.length === 0 ? (
                <div className="text-center py-16 text-xs text-[#667085]">
                  No queries raised. Click "Raise Query" if you need clarification from management.
                </div>
              ) : (
                queries.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => navigate('/employee/queries')}
                    className="p-2.5 rounded-lg border border-[#E4E8EF] hover:border-[#3157A4] hover:bg-[#F9FBFF] cursor-pointer transition-all text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#172033] truncate">{q.title}</span>
                      <Badge size="sm">{q.status}</Badge>
                    </div>
                    <p className="text-[11px] text-[#667085] mt-1 line-clamp-1">{q.description}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Group Chat Panel */}
          <Card className="flex flex-col h-96 p-0 overflow-hidden">
            <div className="p-3 bg-[#FBFBFC] border-b border-[#E4E8EF] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#172033]">Team Chat</h3>
                <p className="text-[11px] text-[#667085]">Task-specific discussion</p>
              </div>
              <Users size={15} className="text-[#667085]" />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 ? (
                <div className="text-center py-16 text-xs text-[#667085]">
                  No chat messages yet. Start collaborating with assigned teammates.
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderUserId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] text-[#667085] mb-0.5">
                        {isMe ? 'You' : msg.senderName} • {formatDateTime(msg.createdAt)}
                      </span>
                      <div
                        className={`p-2 rounded-xl text-xs max-w-xs leading-relaxed ${
                          isMe
                            ? 'bg-[#3157A4] text-white'
                            : 'bg-[#F5F7FA] text-[#172033] border border-[#E4E8EF]'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="p-2 border-t border-[#E4E8EF] flex gap-2">
              <input
                type="text"
                placeholder="Type a team message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
              />
              <Button type="submit" size="sm" loading={sendChatMutation.isPending}>
                <Send size={14} />
              </Button>
            </form>
          </Card>
        </div>

        {/* Modal: Report Blocker */}
        <Modal
          isOpen={blockerModalOpen}
          onClose={() => setBlockerModalOpen(false)}
          title="Report Execution Blocker"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setBlockerModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  updateStatusMutation.mutate({
                    status: 'blocked',
                    explanation: blockerReason.trim(),
                  })
                }
                loading={updateStatusMutation.isPending}
              >
                Mark Task as Blocked
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-[#667085]">
              Reporting a blocker immediately notifies management so dependencies or technical hurdles can be resolved.
            </p>
            <Textarea
              label="Blocker Details & Obstacles (Optional)"
              placeholder="e.g. Waiting on third-party API credentials, database schema migration dependency..."
              value={blockerReason}
              onChange={(e) => setBlockerReason(e.target.value)}
              rows={3}
            />
          </div>
        </Modal>

        {/* Modal: Final Task Submission */}
        <Modal
          isOpen={submitModalOpen}
          onClose={() => setSubmitModalOpen(false)}
          title="Final Deliverable Submission"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setSubmitModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => submitTaskMutation.mutate()}
                loading={submitTaskMutation.isPending}
                className="bg-[#16865B] hover:bg-[#126b48]"
              >
                Confirm Final Submission
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-[#EDFAF4] border border-[#A8DFC5] rounded-xl text-xs space-y-1">
              <span className="font-bold text-[#16865B] block">Submission Notice:</span>
              <p className="text-[#172033]">
                By submitting, your status will change to <strong>"Submitted for Review"</strong> and your manager will be notified. Ordinary pending reminders will cease until manager evaluation.
              </p>
            </div>

            <Textarea
              label="Completion Note & External Deliverable Links (Optional)"
              placeholder="e.g. Completed PR #142 in GitHub, test suite passing, live staging deployment verified..."
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
              rows={3}
            />
          </div>
        </Modal>

        {/* Modal: Raise Query */}
        <Modal
          isOpen={queryModalOpen}
          onClose={() => setQueryModalOpen(false)}
          title="Raise Query with Management"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setQueryModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createQueryMutation.mutate(queryForm)}
                loading={createQueryMutation.isPending}
                disabled={!queryForm.title.trim() || !queryForm.description.trim()}
              >
                Submit Query
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Query Subject / Title *"
              placeholder="e.g. Clarification on Q4 sales target boundaries"
              value={queryForm.title}
              onChange={(e) => setQueryForm({ ...queryForm, title: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Category"
                value={queryForm.category}
                onChange={(e) => setQueryForm({ ...queryForm, category: e.target.value })}
                options={[
                  { value: 'clarification', label: 'Clarification' },
                  { value: 'blocker', label: 'Blocker' },
                  { value: 'dependency', label: 'Dependency' },
                  { value: 'deadline_concern', label: 'Deadline Concern' },
                  { value: 'assignment_issue', label: 'Assignment Issue' },
                  { value: 'technical_issue', label: 'Technical Issue' },
                  { value: 'other', label: 'Other' },
                ]}
              />

              <Select
                label="Urgency Level"
                value={queryForm.priority}
                onChange={(e) => setQueryForm({ ...queryForm, priority: e.target.value })}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>

            <Textarea
              label="Detailed Explanation *"
              placeholder="Describe what assistance or clarification is needed from management..."
              value={queryForm.description}
              onChange={(e) => setQueryForm({ ...queryForm, description: e.target.value })}
              rows={4}
              required
            />
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}

