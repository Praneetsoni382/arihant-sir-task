import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  ArrowRight,
  Calendar,
  AlertTriangle,
  HelpCircle,
  PlusCircle,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { dashboardApi } from '../../services/api';
import { formatDate } from '../../utils/formatDate';
import { getStatusColors, getStatusLabel, getPriorityColors, getPriorityLabel } from '../../utils/statusHelpers';
import type { AdminDashboardData, TaskWithMembers } from '../../types';
import { ISTClockWidget } from '../../components/dashboard/ISTClockWidget';

export function AdminDashboard() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await dashboardApi.admin();
      if (!res.data?.data) {
        throw new Error(res.data?.error || 'Failed to load admin dashboard data');
      }
      return res.data.data as AdminDashboardData;
    },
    refetchInterval: 20000,
  });

  if (isLoading) {
    return (
      <AppLayout title="Executive Overview">
        <PageLoader />
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout title="Executive Overview">
        <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
          Failed to load dashboard metrics.
        </div>
      </AppLayout>
    );
  }

  const {
    totalTasks,
    completedTasks,
    pendingTasks,
    submittedForReview,
    activeQueries,
    recentTasks,
    approachingDeadlines,
    overdueTasks,
    openQueries,
    recentSubmissions,
  } = data;

  return (
    <AppLayout title="Executive Overview">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4E8EF]">
          <div>
            <h1 className="text-xl font-bold text-[#172033]">Operations & Status Overview</h1>
            <p className="text-xs text-[#667085] mt-0.5">Real-time organizational tracking and task workflow status</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/tasks')}
            >
              Browse All Tasks
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/admin/tasks/new')}
            >
              <PlusCircle size={16} />
              Create Task
            </Button>
          </div>
        </div>

        {/* Indian Standard Time (IST) Real-Time Clock & Automated Scheduler Banner */}
        <ISTClockWidget />

        {/* 8.1 Exactly 4 Main Metric Block Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Tasks Assigned */}
          <Card className="hover:border-[#3157A4]/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Total Tasks Assigned</p>
                <h3 className="text-3xl font-bold text-[#172033] mt-2">{totalTasks}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EBF3FF] text-[#3157A4] flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mt-3">Active tasks across all departments</p>
          </Card>

          {/* 2. Tasks Completed */}
          <Card className="hover:border-[#16865B]/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Tasks Completed</p>
                <h3 className="text-3xl font-bold text-[#16865B] mt-2">{completedTasks}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EDFAF4] text-[#16865B] flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mt-3">Manager-approved final deliverables</p>
          </Card>

          {/* 3. Tasks Pending */}
          <Card className="hover:border-[#C58A20]/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Tasks Pending</p>
                <h3 className="text-3xl font-bold text-[#C58A20] mt-2">{pendingTasks}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#FFF8E7] text-[#C58A20] flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mt-3">In progress or awaiting work</p>
          </Card>

          {/* 4. Requires Review / Active Queries */}
          <Card className="hover:border-[#3977C3]/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wider">Review / Queries</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <h3 className="text-3xl font-bold text-[#3977C3]">{submittedForReview}</h3>
                  <span className="text-xs font-medium text-[#667085]">
                    / <span className="text-[#D64545] font-semibold">{activeQueries}</span> queries
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#F0F9FF] text-[#3977C3] flex items-center justify-center">
                <FileCheck size={20} />
              </div>
            </div>
            <p className="text-[11px] text-[#667085] mt-3">Awaiting review or manager resolution</p>
          </Card>
        </div>

        {/* Content Section: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Recent Tasks (2 cols on large) */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recent Task Activity</CardTitle>
                  <p className="text-xs text-[#667085]">Latest assigned organizational tasks</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/tasks')}
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
                      <th className="py-2.5 font-medium">Title</th>
                      <th className="py-2.5 font-medium">Type</th>
                      <th className="py-2.5 font-medium">Priority</th>
                      <th className="py-2.5 font-medium">Status</th>
                      <th className="py-2.5 font-medium">Deadline</th>
                      <th className="py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E8EF]">
                    {recentTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#667085]">
                          No recent tasks found.
                        </td>
                      </tr>
                    ) : (
                      recentTasks.map((t: TaskWithMembers) => {
                        const statusColors = getStatusColors(t.status);
                        const priorityColors = getPriorityColors(t.priority);
                        return (
                          <tr key={t.id} className="hover:bg-[#F9FBFF] transition-colors">
                            <td className="py-3 font-semibold text-[#172033]">{t.referenceNumber}</td>
                            <td className="py-3">
                              <span className="font-medium text-[#172033] block truncate max-w-xs">{t.title}</span>
                              <span className="text-[11px] text-[#667085]">
                                {t.members?.length ?? 0} assigned
                              </span>
                            </td>
                            <td className="py-3 capitalize text-[#667085]">{t.assignmentType}</td>
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
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/admin/tasks/${t.id}`)}
                              >
                                View
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

            {/* Submissions Awaiting Approval */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Submissions Awaiting Review</CardTitle>
                  <p className="text-xs text-[#667085]">Employees who have completed and submitted their deliverables</p>
                </div>
              </CardHeader>

              {recentSubmissions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#667085]">
                  No pending submissions requiring review.
                </div>
              ) : (
                <div className="divide-y divide-[#E4E8EF]">
                  {recentSubmissions.map((sub) => (
                    <div key={sub.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-[#172033] truncate">{sub.user?.fullName}</p>
                          <span className="text-[10px] text-[#667085] px-1.5 py-0.5 rounded bg-[#F5F7FA] border border-[#E4E8EF]">
                            {sub.user?.employeeId}
                          </span>
                        </div>
                        <p className="text-xs text-[#667085] truncate mt-0.5">
                          Task: <span className="text-[#172033] font-medium">{sub.task?.title}</span>
                        </p>
                        {sub.submissionNote && (
                          <p className="text-[11px] text-[#667085] italic mt-1 line-clamp-1 bg-[#F5F7FA] p-1.5 rounded">
                            "{sub.submissionNote}"
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/admin/tasks/${sub.taskId}`)}
                      >
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Deadlines, Overdue, and Open Queries */}
          <div className="space-y-6">
            {/* Approaching Deadlines & Overdue */}
            <Card>
              <CardHeader>
                <CardTitle>Deadline Watch</CardTitle>
                <Calendar size={16} className="text-[#667085]" />
              </CardHeader>

              <div className="space-y-4">
                {/* Overdue Section */}
                {overdueTasks.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#D64545]">
                      <AlertTriangle size={14} />
                      <span>Overdue Tasks ({overdueTasks.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {overdueTasks.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/admin/tasks/${t.id}`)}
                          className="p-2.5 rounded-lg border border-[#F5B8B8] bg-[#FFF0F0] hover:bg-[#FFE6E6] cursor-pointer transition-colors"
                        >
                          <p className="text-xs font-semibold text-[#172033] truncate">{t.title}</p>
                          <div className="flex items-center justify-between text-[11px] text-[#D64545] mt-1">
                            <span>Deadline: {formatDate(t.deadline)}</span>
                            <span className="font-semibold">{t.referenceNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approaching Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C58A20]">
                    <Clock size={14} />
                    <span>Approaching in 3 Days ({approachingDeadlines.length})</span>
                  </div>
                  {approachingDeadlines.length === 0 ? (
                    <p className="text-xs text-[#667085] py-2">No impending deadlines.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {approachingDeadlines.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/admin/tasks/${t.id}`)}
                          className="p-2.5 rounded-lg border border-[#F5D87E] bg-[#FFF8E7] hover:bg-[#FFF3D6] cursor-pointer transition-colors"
                        >
                          <p className="text-xs font-semibold text-[#172033] truncate">{t.title}</p>
                          <div className="flex items-center justify-between text-[11px] text-[#C58A20] mt-1">
                            <span>Due: {formatDate(t.deadline)}</span>
                            <span className="font-medium text-[#172033]">{t.referenceNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Open Queries Requiring Attention */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Active Queries</CardTitle>
                  <p className="text-xs text-[#667085]">Questions raised by employees</p>
                </div>
                <HelpCircle size={16} className="text-[#667085]" />
              </CardHeader>

              {openQueries.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#667085]">
                  No unresolved employee queries.
                </div>
              ) : (
                <div className="space-y-2">
                  {openQueries.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => navigate('/admin/queries')}
                      className="p-3 rounded-lg border border-[#E4E8EF] hover:border-[#3157A4] hover:bg-[#F9FBFF] cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#172033] truncate">{q.title}</span>
                        <span className="text-[10px] font-semibold text-[#3157A4] px-1.5 py-0.5 rounded bg-[#EBF3FF] border border-[#B8D0F5] uppercase">
                          {q.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#667085] mt-1">
                        By {q.creatorName} on <span className="font-medium text-[#172033]">{q.taskTitle}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

