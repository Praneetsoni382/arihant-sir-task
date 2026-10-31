import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  Send,
  Search,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { queryApi } from '../../services/api';
import { formatDateTime } from '../../utils/formatDate';
import { getQueryStatusLabel, getStatusColors } from '../../utils/statusHelpers';
import type { Query, QueryMessage } from '../../types';

export function QueriesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Selected query for thread view
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: queries = [], isLoading } = useQuery({
    queryKey: ['admin-queries', statusFilter, categoryFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const res = await queryApi.getAll(params);
      return (res.data?.data ?? []) as Query[];
    },
    refetchInterval: 10000,
  });

  const { data: activeQuery } = useQuery({
    queryKey: ['query-detail', selectedQueryId],
    queryFn: async () => {
      const res = await queryApi.getById(selectedQueryId!);
      if (!res.data?.data) {
        throw new Error(res.data?.error || 'Failed to load query detail');
      }
      return res.data.data as Query;
    },
    enabled: !!selectedQueryId,
    refetchInterval: 5000,
  });

  const sendReplyMutation = useMutation({
    mutationFn: ({ qId, message }: { qId: string; message: string }) =>
      queryApi.addMessage(qId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query-detail', selectedQueryId] });
      queryClient.invalidateQueries({ queryKey: ['admin-queries'] });
      setReplyText('');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ qId, status }: { qId: string; status: string }) =>
      queryApi.updateStatus(qId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query-detail', selectedQueryId] });
      queryClient.invalidateQueries({ queryKey: ['admin-queries'] });
    },
  });

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedQueryId) return;
    sendReplyMutation.mutate({ qId: selectedQueryId, message: replyText.trim() });
  };

  const filteredQueries = queries.filter((q) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      q.title.toLowerCase().includes(s) ||
      q.description.toLowerCase().includes(s) ||
      (q.creatorName && q.creatorName.toLowerCase().includes(s))
    );
  });

  if (isLoading) {
    return (
      <AppLayout title="Employee Queries">
        <PageLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Inquiries & Employee Clarifications">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="pb-2 border-b border-[#E4E8EF]">
          <h1 className="text-xl font-bold text-[#172033]">Organizational Query Management</h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Review questions, blockers, and technical concerns raised by employees during task execution
          </p>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-[#667085]" />
              <input
                type="text"
                placeholder="Search queries by title, description or author..."
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
              <option value="">All Statuses (Open, Answered, Resolved)</option>
              <option value="open">Open</option>
              <option value="answered">Answered</option>
              <option value="resolved">Resolved</option>
              <option value="reopened">Reopened</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Categories</option>
              <option value="clarification">Clarification</option>
              <option value="blocker">Blocker</option>
              <option value="dependency">Dependency</option>
              <option value="deadline_concern">Deadline Concern</option>
              <option value="assignment_issue">Assignment Issue</option>
              <option value="technical_issue">Technical Issue</option>
              <option value="other">Other</option>
            </select>
          </div>
        </Card>

        {/* Query Table */}
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FBFBFC] border-b border-[#E4E8EF] text-[#667085]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Query Title</th>
                  <th className="py-3 px-4 font-semibold">Related Task</th>
                  <th className="py-3 px-4 font-semibold">Author</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Raised At</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E8EF]">
                {filteredQueries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#667085]">
                      No employee queries found.
                    </td>
                  </tr>
                ) : (
                  filteredQueries.map((q) => {
                    const statusColors = getStatusColors(q.status);
                    return (
                      <tr key={q.id} className="hover:bg-[#F9FBFF] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#172033]">{q.title}</td>
                        <td className="py-3.5 px-4 text-[#3157A4] font-medium">
                          {q.task?.referenceNumber} - {q.task?.title}
                        </td>
                        <td className="py-3.5 px-4 text-[#172033]">{q.creatorName}</td>
                        <td className="py-3.5 px-4 capitalize text-[#667085]">
                          {q.category.replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-4 capitalize font-medium">{q.priority}</td>
                        <td className="py-3.5 px-4">
                          <Badge
                            bg={statusColors.bg}
                            color={statusColors.text}
                            border={statusColors.border}
                          >
                            {getQueryStatusLabel(q.status)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-[#667085]">{formatDateTime(q.createdAt)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedQueryId(q.id)}
                          >
                            <MessageSquare size={13} />
                            Thread
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

        {/* Modal: Query Conversation Thread */}
        {selectedQueryId && activeQuery && (
          <Modal
            isOpen={!!selectedQueryId}
            onClose={() => setSelectedQueryId(null)}
            title={`Query: ${activeQuery.title}`}
            size="lg"
            footer={
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeQuery.status !== 'resolved' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatusMutation.mutate({ qId: activeQuery.id, status: 'resolved' })
                      }
                      loading={updateStatusMutation.isPending}
                    >
                      <CheckCircle2 size={14} />
                      Mark Resolved
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatusMutation.mutate({ qId: activeQuery.id, status: 'open' })
                      }
                      loading={updateStatusMutation.isPending}
                    >
                      <RotateCcw size={14} />
                      Reopen Query
                    </Button>
                  )}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setSelectedQueryId(null)}>
                  Close
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Query Overview Header */}
              <div className="p-3 bg-[#FBFBFC] rounded-xl border border-[#E4E8EF] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#172033]">
                    Raised by: {activeQuery.creatorName}
                  </span>
                  <Badge size="sm">{activeQuery.status}</Badge>
                </div>
                <p className="text-[#667085]">
                  Task: <span className="text-[#172033] font-medium">{activeQuery.task?.title}</span> (
                  {activeQuery.task?.referenceNumber})
                </p>
                <p className="text-[#667085]">
                  Category: <span className="capitalize">{activeQuery.category.replace('_', ' ')}</span> • Priority: <span className="capitalize">{activeQuery.priority}</span>
                </p>
              </div>

              {/* Message Thread */}
              <div className="space-y-3 max-h-72 overflow-y-auto p-1">
                {activeQuery.messages?.map((msg: QueryMessage) => {
                  const isAdmin = msg.senderRole === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isAdmin
                          ? 'bg-[#EBF3FF]/50 border-[#B8D0F5] ml-4'
                          : 'bg-[#F9FBFF] border-[#E4E8EF] mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#172033]">
                          {msg.senderName} {isAdmin && '(Manager / Admin)'}
                        </span>
                        <span className="text-[10px] text-[#667085]">
                          {formatDateTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-[#172033] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              {activeQuery.status !== 'resolved' ? (
                <form onSubmit={handleReplySubmit} className="space-y-2 pt-2 border-t border-[#E4E8EF]">
                  <label className="text-xs font-semibold text-[#172033] block">
                    Manager Response
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Type an official response or guidance to resolve this query..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
                    required
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" loading={sendReplyMutation.isPending}>
                      <Send size={14} />
                      Post Answer
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="p-3 bg-[#EDFAF4] border border-[#A8DFC5] rounded-lg text-xs text-[#16865B] text-center font-medium">
                  This query has been resolved. Reopen to post additional messages.
                </div>
              )}
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}

