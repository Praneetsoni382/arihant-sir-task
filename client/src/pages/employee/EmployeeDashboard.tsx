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

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  return (
    <AppLayout title="Personal Work Dashboard">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4E8EF]">
          <div>
            <h1 className="text-xl font-bold text-[#172033]">Assigned Responsibilities & Progress</h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Track delegated assignments, update your execution status, and resolve manager inquiries
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/employee/tasks')}>
            <CheckSquare size={16} />
            View All My Tasks
          </Button>
        </div>

        {/* 4 Metric Block Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Assigned to Me</p>
                <h3 className="text-3xl font-bold text-[#172033] mt-2">{totalAssigned}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EBF3FF] text-[#3157A4] flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mt-3">Total active deliverables</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">In Progress</p>
                <h3 className="text-3xl font-bold text-[#3157A4] mt-2">{inProgress}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EBF3FF] text-[#3157A4] flex items-center justify-center">
                <CheckSquare size={20} />
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mt-3">Currently undergoing execution</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Under Review</p>
                <h3 className="text-3xl font-bold text-[#C58A20] mt-2">{submitted}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#FFF8E7] text-[#C58A20] flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mt-3">Submitted for manager sign-off</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Approved Work</p>
                <h3 className="text-3xl font-bold text-[#16865B] mt-2">{approved}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EDFAF4] text-[#16865B] flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mt-3">Successfully verified deliverables</p>
          </Card>
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

              <div className="overflow-x-auto">
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

