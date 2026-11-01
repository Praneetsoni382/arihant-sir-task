import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  MessageSquareReply,
  Eye,
  EyeOff,
  Key,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { dashboardApi, statusRequestApi } from '../../services/api';
import { formatDate, formatRelative } from '../../utils/formatDate';
import {
  getStatusColors,
  getStatusLabel,
  getPriorityColors,
  getPriorityLabel,
} from '../../utils/statusHelpers';
import type { EmployeeDashboardData, StatusRequest } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { ChangePasswordModal } from '../../components/auth/ChangePasswordModal';

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showInitialPass, setShowInitialPass] = useState(false);

  // Status response modal
  const [respondingTo, setRespondingTo] = useState<StatusRequest | null>(null);
  const [responseText, setResponseText] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['employee-dashboard'],
    queryFn: async () => {
      const res = await dashboardApi.employee();
      if (!res.data?.data) {
        throw new Error(res.data?.error || 'Failed to load employee dashboard data');
      }
      return res.data.data as EmployeeDashboardData;
    },
    refetchInterval: 15000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ reqId, text }: { reqId: string; text: string }) =>
      statusRequestApi.respond(reqId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
      setRespondingTo(null);
      setResponseText('');
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Employee Workspace">
        <PageLoader />
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout title="Employee Workspace">
        <div className="p-6 bg-[#FFF0F0] text-[#D64545] rounded-xl border border-[#F5B8B8]">
          Unable to load personal workspace metrics.
        </div>
      </AppLayout>
    );
  }

  const {
    totalAssigned,
    inProgress,
    submitted,
    approved,
    myTasks,
    pendingStatusRequests,
    openQueries,
  } = data;

  const handleOpenRespond = (sr: StatusRequest) => {
    setRespondingTo(sr);
    setResponseText('');
  };

  const handleSendResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingTo || !responseText.trim()) return;
    respondMutation.mutate({ reqId: respondingTo.id, text: responseText.trim() });
  };

  const initialPasswordVal =
    user?.initialPassword ||
    user?.currentPasswordPlain ||
    (user?.employeeId ? `Emp@${user.employeeId.replace(/[^a-zA-Z0-9]/g, '')}` : 'Password set by Admin');

  return (
    <AppLayout title="Personal Work Dashboard">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EBF7]">
          <div>
            <h1 className="font-heading font-semibold text-xl text-[#14213D] tracking-tight">Assigned Responsibilities & Progress</h1>
            <p className="font-sans font-normal text-xs text-[#687894] mt-0.5">
              Track delegated assignments, update your execution status, and manage workspace security
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Button size="sm" variant="primary" onClick={() => setShowPasswordModal(true)} className="flex-1 sm:flex-initial justify-center">
              <Key size={15} />
              <span>Change Password</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/employee/tasks')} className="flex-1 sm:flex-initial justify-center">
              <CheckSquare size={15} />
              <span>View All My Tasks</span>
            </Button>
          </div>
        </div>

        {/* Account Credentials & Real-time Security Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-[#071B3A] via-[#102A56] to-[#1E3A70] text-white p-5 shadow-md border border-[#2458D3]/30">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#2458D3]/30 border border-white/20 flex items-center justify-center text-[#168BFF] shrink-0 mt-0.5">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-semibold text-base text-white tracking-tight">
                    Account Security & Assigned Credentials
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#159B70]/20 text-[#34D399] border border-[#159B70]/30">
                    Real-time Auth Sync Active
                  </span>
                </div>
                <p className="font-sans text-xs text-[#A0B3D6] mt-0.5">
                  Logged in as <span className="text-white font-medium">{user?.fullName}</span> ({user?.employeeId || user?.email})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-[#168BFF]" />
                <span className="text-xs text-[#CBD5E1]">Admin Created Password:</span>
                <span className="text-xs font-mono font-semibold tracking-wider text-white">
                  {showInitialPass ? initialPasswordVal : '••••••••••••'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowInitialPass(!showInitialPass)}
                className="p-1 rounded text-[#CBD5E1] hover:text-white hover:bg-white/10 transition-colors"
                title={showInitialPass ? 'Hide password' : 'View admin registered password'}
              >
                {showInitialPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Change Password Modal */}
        <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />

        {/* 4 Metric Block Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#EAF2FF] via-[#F3F8FF] to-[#FFFFFF] p-5 border border-[#CDE0FD] shadow-[0_4px_20px_rgba(20,33,61,0.03)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-sans font-semibold text-xs text-[#14213D]">Assigned to Me</span>
              <div className="w-8 h-8 rounded-full bg-[#2458D3] text-white flex items-center justify-center shadow-xs">
                <Clock size={16} />
              </div>
            </div>
            <h3 className="font-sans font-bold text-3xl text-[#14213D] mt-3 tracking-tight tabular-nums">{totalAssigned}</h3>
            <p className="font-sans font-normal text-xs text-[#687894] mt-2">Total active deliverables</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#EFF6FF] via-[#F8FAFC] to-[#FFFFFF] p-5 border border-[#BFDBFE] shadow-[0_4px_20px_rgba(20,33,61,0.03)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-sans font-semibold text-xs text-[#14213D]">In Progress</span>
              <div className="w-8 h-8 rounded-full bg-[#168BFF] text-white flex items-center justify-center shadow-xs">
                <CheckSquare size={16} />
              </div>
            </div>
            <h3 className="font-sans font-bold text-3xl text-[#168BFF] mt-3 tracking-tight tabular-nums">{inProgress}</h3>
            <p className="font-sans font-normal text-xs text-[#687894] mt-2">Currently undergoing execution</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFF5EB] via-[#FFFAF4] to-[#FFFFFF] p-5 border border-[#FCE1C5] shadow-[0_4px_20px_rgba(20,33,61,0.03)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-sans font-semibold text-xs text-[#14213D]">Under Review</span>
              <div className="w-8 h-8 rounded-full bg-[#E5A02A] text-white flex items-center justify-center shadow-xs">
                <AlertCircle size={16} />
              </div>
            </div>
            <h3 className="font-sans font-bold text-3xl text-[#E5A02A] mt-3 tracking-tight tabular-nums">{submitted}</h3>
            <p className="font-sans font-normal text-xs text-[#687894] mt-2">Submitted for manager sign-off</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#EBF9F3] via-[#F4FCF8] to-[#FFFFFF] p-5 border border-[#BBEBD6] shadow-[0_4px_20px_rgba(20,33,61,0.03)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-sans font-semibold text-xs text-[#14213D]">Approved Work</span>
              <div className="w-8 h-8 rounded-full bg-[#159B70] text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <h3 className="font-sans font-bold text-3xl text-[#159B70] mt-3 tracking-tight tabular-nums">{approved}</h3>
            <p className="font-sans font-normal text-xs text-[#687894] mt-2">Successfully verified deliverables</p>
          </div>
        </div>

        {/* Action Required: Pending Status Requests from Manager */}
        {pendingStatusRequests.length > 0 && (
          <div className="p-4 bg-[#FFF8E7] border border-[#F5D87E] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#C58A20]">
                <MessageSquareReply size={16} />
                <span>Manager Status Inquiries Awaiting Your Response ({pendingStatusRequests.length})</span>
              </div>
            </div>

            <div className="space-y-2">
              {pendingStatusRequests.map((sr) => (
                <div
                  key={sr.id}
                  className="p-3 bg-white rounded-lg border border-[#F5D87E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-[#172033] block">"{sr.question}"</span>
                    <span className="text-[11px] text-[#667085]">
                      Task: {sr.task?.title} ({sr.task?.referenceNumber}) • Received {formatRelative(sr.createdAt)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleOpenRespond(sr)}
                  >
                    Reply to Manager
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: My Assigned Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>My Current Tasks</CardTitle>
                  <p className="text-xs text-[#667085]">Active assignments requiring your input or status updates</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/employee/tasks')}
                >
                  View All
                  <ArrowRight size={14} />
                </Button>
              </CardHeader>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E8EF] text-[#667085]">
                      <th className="py-2.5 font-medium">Ref</th>
                      <th className="py-2.5 font-medium">Task Deliverable</th>
                      <th className="py-2.5 font-medium">Priority</th>
                      <th className="py-2.5 font-medium">Status</th>
                      <th className="py-2.5 font-medium">Deadline</th>
                      <th className="py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E8EF]">
                    {myTasks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#667085]">
                          You currently have no active assigned tasks.
                        </td>
                      </tr>
                    ) : (
                      myTasks.map((t) => {
                        const statusColors = getStatusColors(t.status);
                        const priorityColors = getPriorityColors(t.priority);
                        return (
                          <tr key={t.id} className="hover:bg-[#F9FBFF] transition-colors">
                            <td className="py-3 font-semibold text-[#172033]">{t.referenceNumber}</td>
                            <td className="py-3">
                              <p className="font-semibold text-[#172033] line-clamp-1">{t.title}</p>
                              <span className="text-[11px] text-[#667085] capitalize">
                                {t.assignmentType} Assignment
                              </span>
                            </td>
                            <td className="py-3">
                              <Badge
                                bg={priorityColors.bg}
                                color={priorityColors.text}
                                border={priorityColors.border}
                              >
                                {getPriorityLabel(t.priority)}
                              </Badge>
                            </td>
                            <td className="py-3">
                              <Badge
                                bg={statusColors.bg}
                                color={statusColors.text}
                                border={statusColors.border}
                              >
                                {getStatusLabel(t.status)}
                              </Badge>
                            </td>
                            <td className="py-3 text-[#667085] whitespace-nowrap">{formatDate(t.deadline)}</td>
                            <td className="py-3 text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => navigate(`/employee/tasks/${t.id}`)}
                              >
                                Open Task
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {myTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#667085]">
                    You currently have no active assigned tasks.
                  </div>
                ) : (
                  myTasks.map((t) => {
                    const statusColors = getStatusColors(t.status);
                    const priorityColors = getPriorityColors(t.priority);
                    return (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl border border-[#E4E8EF] bg-[#FBFBFC] space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-[#172033] font-mono">{t.referenceNumber}</span>
                          <span className="text-[10px] text-[#667085] capitalize px-2 py-0.5 rounded-md bg-white border border-[#E4E8EF]">
                            {t.assignmentType}
                          </span>
                        </div>
                        <p className="font-semibold text-xs text-[#172033]">{t.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Badge
                            bg={priorityColors.bg}
                            color={priorityColors.text}
                            border={priorityColors.border}
                            size="sm"
                          >
                            {getPriorityLabel(t.priority)}
                          </Badge>
                          <Badge
                            bg={statusColors.bg}
                            color={statusColors.text}
                            border={statusColors.border}
                            size="sm"
                          >
                            {getStatusLabel(t.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[#E4E8EF] text-xs">
                          <span className="text-[11px] text-[#667085]">Due: {formatDate(t.deadline)}</span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/employee/tasks/${t.id}`)}
                          >
                            Open Task
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Queries & Quick Navigation */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>My Open Queries</CardTitle>
                  <p className="text-xs text-[#667085]">Questions submitted to management</p>
                </div>
                <HelpCircle size={16} className="text-[#667085]" />
              </CardHeader>

              {openQueries.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#667085]">
                  No active queries raised.
                </div>
              ) : (
                <div className="space-y-2">
                  {openQueries.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => navigate('/employee/queries')}
                      className="p-3 rounded-lg border border-[#E4E8EF] hover:border-[#3157A4] hover:bg-[#F9FBFF] cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#172033] truncate">{q.title}</span>
                        <Badge size="sm">{q.status}</Badge>
                      </div>
                      <p className="text-[11px] text-[#667085] mt-1 line-clamp-1">{q.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Modal: Respond to Status Request */}
        {respondingTo && (
          <Modal
            isOpen={!!respondingTo}
            onClose={() => setRespondingTo(null)}
            title="Respond to Manager Status Request"
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setRespondingTo(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendResponse}
                  loading={respondMutation.isPending}
                  disabled={!responseText.trim()}
                >
                  <Send size={14} />
                  Submit Status Response
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="p-3 bg-[#FBFBFC] border border-[#E4E8EF] rounded-xl text-xs space-y-1">
                <span className="text-[#667085] block">Manager's Question:</span>
                <p className="font-bold text-[#172033] text-sm leading-snug">"{respondingTo.question}"</p>
                <p className="text-[11px] text-[#667085] mt-1">
                  Task: {respondingTo.task?.title} ({respondingTo.task?.referenceNumber})
                </p>
              </div>

              <Textarea
                label="Your Status Update & Progress Details *"
                placeholder="Detail the exact progress accomplished, current status, or any blockers preventing delivery..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
                required
              />
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}

