import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { reportApi, employeeApi } from '../../services/api';
import { formatDate } from '../../utils/formatDate';
import { getStatusColors, getStatusLabel } from '../../utils/statusHelpers';
import type { User } from '../../types';

interface ReportTask {
  taskId: string;
  referenceNumber: string;
  title: string;
  assignmentType: string;
  priority: string;
  status: string;
  deadline: string;
  isOverdue: boolean;
  category: string;
  department: string;
  createdAt: string;
  members: Array<{
    userId: string;
    fullName: string;
    department: string;
    memberStatus: string;
    submittedAt: string | null;
    approvedAt: string | null;
    openQueries: number;
  }>;
}

export function ReportsPage() {
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignmentType, setAssignmentType] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  // Fetch employees for dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ['report-employees'],
    queryFn: async () => {
      const res = await employeeApi.getAll();
      return (res.data?.data ?? []) as User[];
    },
  });

  // Fetch report data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['reports', department, status, priority, assignmentType, employeeId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (department) params.department = department;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (assignmentType) params.assignmentType = assignmentType;
      if (employeeId) params.employeeId = employeeId;
      const res = await reportApi.getReport(params);
      if (!res.data?.data) {
        throw new Error(res.data?.error || 'Failed to load report data');
      }
      return res.data.data as { total: number; tasks: ReportTask[]; generatedAt: string };
    },
  });

  const tasks = reportData?.tasks ?? [];

  // CSV Export utility
  const handleExportCSV = () => {
    if (!tasks || tasks.length === 0) return;

    const headers = [
      'Task Reference',
      'Task Name',
      'Department',
      'Assignment Type',
      'Priority',
      'Status',
      'Deadline',
      'Is Overdue',
      'Assignees',
      'Submitted At',
      'Approved At',
      'Created Date',
    ];

    const rows = tasks.map((t) => [
      `"${t.referenceNumber}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.department}"`,
      `"${t.assignmentType}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.deadline}"`,
      `"${t.isOverdue ? 'Yes' : 'No'}"`,
      `"${t.members.map((m) => m.fullName).join('; ')}"`,
      `"${t.members.map((m) => m.submittedAt ?? '-').join('; ')}"`,
      `"${t.members.map((m) => m.approvedAt ?? '-').join('; ')}"`,
      `"${t.createdAt}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TaskFlow_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <AppLayout title="Audit & Reports">
        <PageLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reports & Export Registry">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4E8EF]">
          <div>
            <h1 className="text-xl font-bold text-[#172033]">Operational Deliverable Reports</h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Generate structured reports on accountability, turnaround time, submission, and approval states
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            disabled={tasks.length === 0}
          >
            <Download size={15} />
            Export CSV Registry
          </Button>
        </div>

        {/* Filter Controls */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Marketing">Marketing</option>
              <option value="Finance">Finance</option>
            </select>

            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeId})
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
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
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={assignmentType}
              onChange={(e) => setAssignmentType(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Assignment Types</option>
              <option value="solo">Solo Only</option>
              <option value="group">Group Only</option>
            </select>
          </div>
        </Card>

        {/* Report Table */}
        <Card padding={false} className="overflow-hidden">
          <div className="p-3 bg-[#FBFBFC] border-b border-[#E4E8EF] flex items-center justify-between text-xs text-[#667085]">
            <span>Total Tasks Indexed: <strong className="text-[#172033]">{tasks.length}</strong></span>
            <span>Report Generated: {reportData?.generatedAt}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FBFBFC] border-b border-[#E4E8EF] text-[#667085]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Ref</th>
                  <th className="py-3 px-4 font-semibold">Task Title</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Assigned Members & Individual States</th>
                  <th className="py-3 px-4 font-semibold">Overall Status</th>
                  <th className="py-3 px-4 font-semibold">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E8EF]">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#667085]">
                      No tasks matched the report filters.
                    </td>
                  </tr>
                ) : (
                  tasks.map((t) => {
                    const statusColors = getStatusColors(t.status);
                    return (
                      <tr key={t.taskId} className="hover:bg-[#F9FBFF] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#172033]">{t.referenceNumber}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#172033]">{t.title}</p>
                          <span className="text-[10px] text-[#667085] capitalize">
                            {t.assignmentType} • Priority: {t.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#172033]">{t.department}</td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {t.members.map((m) => (
                              <div key={m.userId} className="flex items-center justify-between gap-3 text-[11px]">
                                <span className="font-medium text-[#172033]">{m.fullName}:</span>
                                <span className="text-[#667085] capitalize">
                                  {m.memberStatus.replace('_', ' ')}
                                  {m.submittedAt && ` (Sub: ${m.submittedAt})`}
                                </span>
                              </div>
                            ))}
                          </div>
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
                          <div className="flex items-center gap-1">
                            {t.isOverdue && <AlertTriangle size={12} className="text-[#D64545]" />}
                            <span className={t.isOverdue ? 'text-[#D64545] font-semibold' : 'text-[#667085]'}>
                              {t.deadline}
                            </span>
                          </div>
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

