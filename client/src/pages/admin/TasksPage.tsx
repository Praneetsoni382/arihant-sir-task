import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  Users,
  User as UserIcon,
  AlertTriangle,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { taskApi } from '../../services/api';
import { formatDate, isOverdue } from '../../utils/formatDate';
import {
  getStatusColors,
  getStatusLabel,
  getPriorityColors,
  getPriorityLabel,
} from '../../utils/statusHelpers';
import type { TaskWithMembers } from '../../types';

export function TasksPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', statusFilter, priorityFilter, assignmentTypeFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (assignmentTypeFilter) params.assignmentType = assignmentTypeFilter;
      const res = await taskApi.getAll(params);
      return (res.data?.data ?? []) as TaskWithMembers[];
    },
  });

  const filteredTasks = tasks.filter((t) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.referenceNumber.toLowerCase().includes(q) ||
      t.department.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <AppLayout title="All Tasks">
        <PageLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Organizational Task Register">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header & New Task Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4E8EF]">
          <div>
            <h1 className="text-xl font-bold text-[#172033]">All Organizational Tasks</h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Comprehensive registry of delegated individual and cross-functional group assignments
            </p>
          </div>
          <Button onClick={() => navigate('/admin/tasks/new')} size="sm">
            <PlusCircle size={16} />
            Create New Task
          </Button>
        </div>

        {/* Filter Controls */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-[#667085]" />
              <input
                type="text"
                placeholder="Search by title, ref, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="submitted_for_review">Submitted for Review</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={assignmentTypeFilter}
              onChange={(e) => setAssignmentTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Types (Solo & Group)</option>
              <option value="solo">Solo Tasks Only</option>
              <option value="group">Group Tasks Only</option>
            </select>
          </div>
        </Card>

        {/* Task Table */}
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FBFBFC] border-b border-[#E4E8EF] text-[#667085]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Task Name</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Assignees</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Deadline</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E8EF]">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#667085]">
                      No tasks found matching your filter selection.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => {
                    const statusColors = getStatusColors(t.status);
                    const priorityColors = getPriorityColors(t.priority);
                    const overdue = isOverdue(t.deadline) && t.status !== 'approved';

                    return (
                      <tr key={t.id} className="hover:bg-[#F9FBFF] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#172033]">{t.referenceNumber}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#172033] line-clamp-1">{t.title}</p>
                          <p className="text-[11px] text-[#667085] line-clamp-1">{t.description}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#172033] capitalize">
                            {t.assignmentType === 'group' ? (
                              <Users size={14} className="text-[#3157A4]" />
                            ) : (
                              <UserIcon size={14} className="text-[#667085]" />
                            )}
                            {t.assignmentType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            {t.members?.slice(0, 3).map((m, idx) => (
                              <div
                                key={m.id}
                                title={m.user?.fullName}
                                className="w-6 h-6 rounded-full bg-[#EBF3FF] border border-[#B8D0F5] text-[#3157A4] font-semibold text-[10px] flex items-center justify-center"
                              >
                                {m.user?.fullName?.charAt(0) ?? `${idx + 1}`}
                              </div>
                            ))}
                            {(t.members?.length ?? 0) > 3 && (
                              <span className="text-[10px] text-[#667085] ml-1">
                                +{(t.members?.length ?? 0) - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            bg={priorityColors.bg}
                            color={priorityColors.text}
                            border={priorityColors.border}
                          >
                            {getPriorityLabel(t.priority)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            bg={statusColors.bg}
                            color={statusColors.text}
                            border={statusColors.border}
                          >
                            {getStatusLabel(t.status)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {overdue && <AlertTriangle size={13} className="text-[#D64545]" />}
                            <span className={overdue ? 'text-[#D64545] font-semibold' : 'text-[#667085]'}>
                              {formatDate(t.deadline)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/admin/tasks/${t.id}`)}
                          >
                            Manage
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
    </AppLayout>
  );
}

