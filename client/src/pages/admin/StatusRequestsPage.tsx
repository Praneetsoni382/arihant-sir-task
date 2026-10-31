import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { statusRequestApi } from '../../services/api';
import { formatDateTime, formatRelative } from '../../utils/formatDate';
import type { StatusRequest } from '../../types';

export function StatusRequestsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-status-requests'],
    queryFn: async () => {
      const res = await statusRequestApi.getAll();
      return (res.data?.data ?? []) as StatusRequest[];
    },
    refetchInterval: 10000,
  });

  const filtered = requests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.question.toLowerCase().includes(q) ||
        (r.recipientName && r.recipientName.toLowerCase().includes(q)) ||
        (r.task?.title && r.task.title.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <AppLayout title="Status Requests">
        <PageLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Manager Status Inquiries">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="pb-2 border-b border-[#E4E8EF]">
          <h1 className="text-xl font-bold text-[#172033]">Status Request Tracking</h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Monitor manager interrogation queries and evaluate employee response turnaround
          </p>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-[#667085]" />
              <input
                type="text"
                placeholder="Search by inquiry question, recipient employee, or task..."
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
              <option value="">All Response States</option>
              <option value="pending">Pending Response (Unanswered)</option>
              <option value="answered">Answered by Employee</option>
            </select>
          </div>
        </Card>

        {/* Requests List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-xs text-[#667085]">
              No status requests found matching the current criteria.
            </Card>
          ) : (
            filtered.map((req) => (
              <Card key={req.id} className="p-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#667085]">
                        Task: {req.task?.referenceNumber} - {req.task?.title}
                      </span>
                      <Badge
                        bg={req.status === 'answered' ? '#EDFAF4' : '#FFF8E7'}
                        color={req.status === 'answered' ? '#16865B' : '#C58A20'}
                        border={req.status === 'answered' ? '#A8DFC5' : '#F5D87E'}
                      >
                        {req.status === 'answered' ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={12} /> Answered
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> Pending Response
                          </span>
                        )}
                      </Badge>
                    </div>

                    <h3 className="text-sm font-bold text-[#172033]">"{req.question}"</h3>

                    <p className="text-xs text-[#667085]">
                      Dispatched to: <span className="font-semibold text-[#172033]">{req.recipientName}</span> •{' '}
                      {formatRelative(req.createdAt)} ({formatDateTime(req.createdAt)})
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/tasks/${req.taskId}`)}
                  >
                    Open Task
                    <ArrowRight size={14} />
                  </Button>
                </div>

                {/* Responses */}
                {req.responses && req.responses.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#E4E8EF] space-y-2">
                    {req.responses.map((resp) => (
                      <div key={resp.id} className="p-3 bg-[#F9FBFF] rounded-lg border border-[#E4E8EF]">
                        <p className="text-xs font-bold text-[#3157A4] mb-1">
                          Employee Response ({req.recipientName}):
                        </p>
                        <p className="text-xs text-[#172033] whitespace-pre-wrap leading-relaxed">
                          {resp.responseText}
                        </p>
                        <span className="text-[10px] text-[#667085] mt-1 block">
                          Received {formatDateTime(resp.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}

