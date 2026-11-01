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
  Activity,
  Hourglass,
  MessageSquare,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Badge } from '../../components/ui/Badge';
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
        <div className="p-6 bg-red-50 text-[#E34D59] rounded-2xl border border-red-200">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#2458D3] to-[#168BFF] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(36,88,211,0.35)] shrink-0">
              <Activity size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-heading font-semibold text-xl sm:text-2xl text-[#14213D] tracking-tight">Operations & Status Overview</h1>
              <p className="font-sans font-normal text-xs text-[#687894] mt-0.5">Real-time organizational tracking and task workflow status</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/tasks')}
              className="bg-white hover:bg-[#F8FAFD] text-[#14213D] border border-[#E4EBF7] rounded-xl px-4 py-2.5 text-xs font-medium shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <LayoutGrid size={15} className="text-[#687894]" />
              <span>Browse All Tasks</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/tasks/new')}
              className="bg-gradient-to-r from-[#2458D3] to-[#168BFF] hover:from-[#1D47B0] hover:to-[#0F75DC] text-white rounded-xl px-4.5 py-2.5 text-xs font-medium shadow-[0_4px_14px_rgba(22,139,255,0.35)] flex items-center gap-2 cursor-pointer transition-all"
            >
              <PlusCircle size={16} />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* Indian Standard Time (IST) Real-Time Clock & Automated Scheduler Banner */}
        <ISTClockWidget />

        {/* 4 Main Metric Block Cards with subtle pastel gradients */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Tasks Assigned */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#EAF2FF] via-[#F3F8FF] to-[#FFFFFF] p-5 border border-[#CDE0FD] shadow-[0_4px_20px_rgba(20,33,61,0.03)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#2458D3] text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 size={15} />
                </div>
                <span className="font-sans font-semibold text-xs text-[#14213D]">
                  Total Tasks Assigned
                </span>
              </div>
              <Clock size={18} className="text-[#93C5FD]" />
            </div>
            <h3 className="font-sans font-bold text-3xl text-[#14213D] mt-3 tracking-tight tabular-nums">{totalTasks}</h3>
            <p className="font-sans font-normal text-xs text-[#687894] mt-2">Active tasks across all departments</p>
          </div>

          {/* 2. Tasks Completed */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#EBF9F3] via-[#F4FCF8] to-[#FFFFFF] p-5 border border-[#BBEBD6] shadow-[0_4px_20px_rgba(20,33,61,0.03)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#159B70] text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 size={15} />
                </div>
                <span className="font-sans font-semibold text-xs text-[#14213D]">
                  Tasks Completed
                </span>
              </div>
              <CheckCircle2 size={18} className="text-[#86EFAC]" />
            </div>
            <h3 className="font-sans font-bold text-3xl text-[#159B70] mt-3 tracking-tight tabular-nums">{completedTasks}</h3>
            <p className="font-sans font-normal text-xs text-[#687894] mt-2">Manager-approved final deliverables</p>
          </div>

          {/* 3. Tasks Pending */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFF5EB] via-[#FFFAF4] to-[#FFFFFF] p-5 border border-[#FCE1C5] shadow-[0_4px_20px_rgba(20,33,61,0.03)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#E5A02A] text-white flex items-center justify-center shadow-xs">
                  <AlertCircle size={15} />
                </div>
                <span className="font-sans font-semibold text-xs text-[#14213D]">
                  Tasks Pending
                </span>
              </div>
              <Hourglass size={18} className="text-[#FCD34D]" />
            </div>
            <h3 className="font-sans font-bold text-3xl text-[#E5A02A] mt-3 tracking-tight tabular-nums">{pendingTasks}</h3>
            <p className="font-sans font-normal text-xs text-[#687894] mt-2">In progress or awaiting work</p>
          </div>

          {/* 4. Review / Active Queries */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#F3F0FF] via-[#F9F7FF] to-[#FFFFFF] p-5 border border-[#E2D8FF] shadow-[0_4px_20px_rgba(20,33,61,0.03)] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#7464E8] text-white flex items-center justify-center shadow-xs">
                  <FileCheck size={15} />
                </div>
                <span className="font-sans font-semibold text-xs text-[#14213D]">
                  Review & Queries
                </span>
              </div>
              <MessageSquare size={18} className="text-[#C4B5FD]" />
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-sans font-bold text-3xl text-[#7464E8] tracking-tight tabular-nums">{submittedForReview}</h3>
              <span className="font-sans font-medium text-xs text-[#687894]">
                / <span className="text-[#E34D59] font-semibold tabular-nums">{activeQueries}</span> queries
              </span>
            </div>
            <p className="font-sans font-normal text-xs text-[#687894] mt-2">Awaiting review or manager resolution</p>
          </div>
        </div>

        {/* Content Section: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Recent Tasks (2 cols on large) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-[#E4EBF7] p-5 shadow-[0_4px_20px_rgba(20,33,61,0.03)]">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4EBF7]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#EAF2FF] text-[#2458D3] flex items-center justify-center">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-base text-[#14213D]">Recent Task Activity</h3>
                    <p className="font-sans font-normal text-xs text-[#687894]">Latest assigned organizational tasks</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/admin/tasks')}
                  className="font-sans font-medium text-xs text-[#2458D3] hover:text-[#168BFF] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>View All</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E4EBF7] text-[#687894]">
                      <th className="py-3 font-medium text-xs">Ref</th>
                      <th className="py-3 font-medium text-xs">Title</th>
                      <th className="py-3 font-medium text-xs">Type</th>
                      <th className="py-3 font-medium text-xs">Priority</th>
                      <th className="py-3 font-medium text-xs">Status</th>
                      <th className="py-3 font-medium text-xs">Deadline</th>
                      <th className="py-3 text-right font-medium text-xs">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4EBF7]">
                    {recentTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[#687894] font-normal">
                          No recent tasks found.
                        </td>
                      </tr>
                    ) : (
                      recentTasks.map((t: TaskWithMembers) => {
                        const statusColors = getStatusColors(t.status);
                        const priorityColors = getPriorityColors(t.priority);
                        return (
                          <tr key={t.id} className="hover:bg-[#F8FAFD] transition-colors">
                            <td className="py-3.5 font-medium text-[#14213D] tabular-nums">{t.referenceNumber}</td>
                            <td className="py-3.5">
                              <span className="font-medium text-[#14213D] block truncate max-w-xs">{t.title}</span>
                              <span className="font-normal text-[11px] text-[#687894]">
                                {t.members?.length ?? 0} assigned
                              </span>
                            </td>
                            <td className="py-3.5 capitalize text-[#687894] font-normal">{t.assignmentType}</td>
                            <td className="py-3.5">
                              <Badge
                                bg={priorityColors.bg}
                                color={priorityColors.text}
                                border={priorityColors.border}
                              >
                                {getPriorityLabel(t.priority)}
                              </Badge>
                            </td>
                            <td className="py-3.5">
                              <Badge
                                bg={statusColors.bg}
                                color={statusColors.text}
                                border={statusColors.border}
                              >
                                {getStatusLabel(t.status)}
                              </Badge>
                            </td>
                            <td className="py-3.5 text-[#687894] whitespace-nowrap font-normal tabular-nums">{formatDate(t.deadline)}</td>
                            <td className="py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/tasks/${t.id}`)}
                                className="bg-[#F1F4FC] hover:bg-[#E4EBF7] text-[#2458D3] font-medium text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Submissions Awaiting Approval */}
            <div className="bg-white rounded-2xl border border-[#E4EBF7] p-5 shadow-[0_4px_20px_rgba(20,33,61,0.03)]">
              <div className="pb-4 border-b border-[#E4EBF7]">
                <h3 className="font-heading font-semibold text-base text-[#14213D]">Submissions Awaiting Review</h3>
                <p className="font-sans font-normal text-xs text-[#687894]">Employees who have completed and submitted their deliverables</p>
              </div>

              {recentSubmissions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#687894] font-normal">
                  No pending submissions requiring review.
                </div>
              ) : (
                <div className="divide-y divide-[#E4EBF7] mt-2">
                  {recentSubmissions.map((sub) => (
                    <div key={sub.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-[#14213D] truncate">{sub.user?.fullName}</p>
                          <span className="text-[10px] text-[#687894] font-normal px-2 py-0.5 rounded-full bg-[#F1F4FC] border border-[#E4EBF7] tabular-nums">
                            {sub.user?.employeeId}
                          </span>
                        </div>
                        <p className="text-xs text-[#687894] truncate mt-0.5 font-normal">
                          Task: <span className="text-[#14213D] font-medium">{sub.task?.title}</span>
                        </p>
                        {sub.submissionNote && (
                          <p className="text-[11px] text-[#687894] italic mt-1 line-clamp-1 bg-[#F8FAFD] p-2 rounded-lg border border-[#E4EBF7] font-normal">
                            "{sub.submissionNote}"
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/tasks/${sub.taskId}`)}
                        className="bg-[#2458D3] hover:bg-[#1D47B0] text-white font-medium text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Deadlines, Overdue, and Open Queries */}
          <div className="space-y-6">
            {/* Approaching Deadlines & Overdue */}
            <div className="bg-white rounded-2xl border border-[#E4EBF7] p-5 shadow-[0_4px_20px_rgba(20,33,61,0.03)]">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4EBF7]">
                <h3 className="font-heading font-semibold text-base text-[#14213D]">Deadline Watch</h3>
                <Calendar size={18} className="text-[#687894]" />
              </div>

              <div className="space-y-4 mt-4">
                {/* Overdue Section */}
                {overdueTasks.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E34D59]">
                      <AlertTriangle size={15} />
                      <span>Overdue Tasks ({overdueTasks.length})</span>
                    </div>
                    <div className="space-y-2">
                      {overdueTasks.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/admin/tasks/${t.id}`)}
                          className="p-3 rounded-xl border border-[#FECDD3] bg-[#FFF0F0] hover:bg-[#FFE4E6] cursor-pointer transition-all shadow-xs"
                        >
                          <p className="text-xs font-semibold text-[#14213D] truncate">{t.title}</p>
                          <div className="flex items-center justify-between text-[11px] text-[#E34D59] font-medium mt-1.5">
                            <span>Deadline: {formatDate(t.deadline)}</span>
                            <span className="font-medium bg-white/70 px-1.5 py-0.5 rounded text-[10px] tabular-nums">{t.referenceNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approaching Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5A02A]">
                    <Clock size={15} />
                    <span>Approaching in 3 Days ({approachingDeadlines.length})</span>
                  </div>
                  {approachingDeadlines.length === 0 ? (
                    <p className="text-xs text-[#687894] py-2 font-normal">No impending deadlines.</p>
                  ) : (
                    <div className="space-y-2">
                      {approachingDeadlines.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/admin/tasks/${t.id}`)}
                          className="p-3 rounded-xl border border-[#FDE68A] bg-[#FFF8E7] hover:bg-[#FEF3C7] cursor-pointer transition-all shadow-xs"
                        >
                          <p className="text-xs font-semibold text-[#14213D] truncate">{t.title}</p>
                          <div className="flex items-center justify-between text-[11px] text-[#E5A02A] font-medium mt-1.5">
                            <span>Due: {formatDate(t.deadline)}</span>
                            <span className="font-medium bg-white/70 px-1.5 py-0.5 rounded text-[10px] text-[#14213D] tabular-nums">{t.referenceNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Open Queries Requiring Attention */}
            <div className="bg-white rounded-2xl border border-[#E4EBF7] p-5 shadow-[0_4px_20px_rgba(20,33,61,0.03)]">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4EBF7]">
                <div>
                  <h3 className="font-heading font-semibold text-base text-[#14213D]">Active Queries</h3>
                  <p className="font-sans font-normal text-xs text-[#687894]">Questions raised by employees</p>
                </div>
                <HelpCircle size={18} className="text-[#687894]" />
              </div>

              {openQueries.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#687894] font-normal">
                  No unresolved employee queries.
                </div>
              ) : (
                <div className="space-y-2 mt-4">
                  {openQueries.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => navigate('/admin/queries')}
                      className="p-3 rounded-xl border border-[#E4EBF7] hover:border-[#2458D3] hover:bg-[#F8FAFD] cursor-pointer transition-all shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#14213D] truncate">{q.title}</span>
                        <span className="text-[10px] font-semibold text-[#2458D3] px-2 py-0.5 rounded-full bg-[#EAF2FF] border border-[#CDE0FD] uppercase tracking-wide">
                          {q.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#687894] mt-1 font-normal">
                        By {q.creatorName} on <span className="font-medium text-[#14213D]">{q.taskTitle}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

