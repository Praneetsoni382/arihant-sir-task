import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Users, User, AlertTriangle } from 'lucide-react';
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

export function MyTasksPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['employee-my-tasks', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await taskApi.getAll(params);
      return (res.data?.data ?? []) as TaskWithMembers[];
    },
  });

  const filtered = tasks.filter((t) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.referenceNumber.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <AppLayout title="My Tasks">
        <PageLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="My Assigned Deliverables">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="pb-2 border-b border-[#E4E8EF]">
          <h1 className="text-xl font-bold text-[#172033]">Personal Task Registry</h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Solo and group assignments allocated to your profile with deadlines and delivery states
          </p>
        </div>

        {/* Filter controls */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-[#667085]" />
              <input
                type="text"
                placeholder="Search by title, reference, or description..."
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
            </select>
          </div>
        </Card>

        {/* Tasks Table */}
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FBFBFC] border-b border-[#E4E8EF] text-[#667085]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Task Name</th>
                  <th className="py-3 px-4 font-semibold">Assignment</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">My Status</th>
                  <th className="py-3 px-4 font-semibold">Deadline (IST)</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E8EF]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#667085]">
                      No assigned tasks match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
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
                              <User size={14} className="text-[#667085]" />
                            )}
                            {t.assignmentType}
                          </span>
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
    </AppLayout>
  );
}

