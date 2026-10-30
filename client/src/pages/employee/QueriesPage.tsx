import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HelpCircle,
  MessageSquare,
  Send,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { queryApi } from '../../services/api';
import { formatDateTime, formatRelative } from '../../utils/formatDate';
import { getQueryStatusLabel, getStatusColors } from '../../utils/statusHelpers';
import type { Query, QueryMessage } from '../../types';

export function QueriesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: queries = [], isLoading } = useQuery({
    queryKey: ['employee-queries', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await queryApi.getAll(params);
      return (res.data?.data ?? []) as Query[];
    },
    refetchInterval: 10000,
  });

  const { data: activeQuery } = useQuery({
    queryKey: ['query-detail', selectedQueryId],
    queryFn: async () => {
      const res = await queryApi.getById(selectedQueryId!);
      return res.data?.data as Query;
    },
    enabled: !!selectedQueryId,
    refetchInterval: 4000,
  });

  const sendReplyMutation = useMutation({
    mutationFn: ({ qId, message }: { qId: string; message: string }) =>
      queryApi.addMessage(qId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query-detail', selectedQueryId] });
      queryClient.invalidateQueries({ queryKey: ['employee-queries'] });
      setReplyText('');
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (qId: string) => queryApi.updateStatus(qId, 'reopened'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query-detail', selectedQueryId] });
      queryClient.invalidateQueries({ queryKey: ['employee-queries'] });
    },
  });

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedQueryId) return;
    sendReplyMutation.mutate({ qId: selectedQueryId, message: replyText.trim() });
  };

  if (isLoading) {
    return (
      <AppLayout title="My Queries">
        <PageLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="My Queries & Clarifications">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4E8EF]">
          <div>
            <h1 className="text-xl font-bold text-[#172033]">Employee Queries</h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Review management responses, communicate blockers, or request procedural guidance
            </p>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {['', 'open', 'answered', 'resolved'].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={statusFilter === st ? 'primary' : 'secondary'}
              onClick={() => setStatusFilter(st)}
            >
              {st === '' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}
            </Button>
          ))}
        </div>

        {/* Queries List */}
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FBFBFC] border-b border-[#E4E8EF] text-[#667085]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Subject</th>
                  <th className="py-3 px-4 font-semibold">Task Deliverable</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Urgency</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Date Raised</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E8EF]">
                {queries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#667085]">
                      You have not raised any queries yet.
                    </td>
                  </tr>
                ) : (
                  queries.map((q) => {
                    const statusColors = getStatusColors(q.status);
                    return (
                      <tr key={q.id} className="hover:bg-[#F9FBFF] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#172033]">{q.title}</td>
                        <td className="py-3.5 px-4 text-[#3157A4] font-medium">
                          {q.task?.referenceNumber} - {q.task?.title}
                        </td>
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
                            View Thread
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

        {/* Modal: View Thread & Reply */}
        {selectedQueryId && activeQuery && (
          <Modal
            isOpen={!!selectedQueryId}
            onClose={() => setSelectedQueryId(null)}
            title={`Query: ${activeQuery.title}`}
            size="lg"
            footer={
              <div className="w-full flex items-center justify-between">
                <div>
                  {activeQuery.status === 'resolved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reopenMutation.mutate(activeQuery.id)}
                      loading={reopenMutation.isPending}
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
              <div className="p-3 bg-[#FBFBFC] rounded-xl border border-[#E4E8EF] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#172033]">
                    Task: {activeQuery.task?.title} ({activeQuery.task?.referenceNumber})
                  </span>
                  <Badge size="sm">{activeQuery.status}</Badge>
                </div>
                <p className="text-[#667085]">
                  Category: <span className="capitalize">{activeQuery.category.replace('_', ' ')}</span> • Priority: <span className="capitalize">{activeQuery.priority}</span>
                </p>
              </div>

              {/* Message thread */}
              <div className="space-y-3 max-h-72 overflow-y-auto p-1">
                {activeQuery.messages?.map((msg: QueryMessage) => {
                  const isManager = msg.senderRole === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isManager
                          ? 'bg-[#EBF3FF]/50 border-[#B8D0F5] ml-4'
                          : 'bg-[#F9FBFF] border-[#E4E8EF] mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#172033]">
                          {msg.senderName} {isManager && '(Manager / Admin)'}
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

              {/* Reply form */}
              {activeQuery.status !== 'resolved' ? (
                <form onSubmit={handleReplySubmit} className="space-y-2 pt-2 border-t border-[#E4E8EF]">
                  <label className="text-xs font-semibold text-[#172033] block">
                    Your Reply to Management
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide additional context or respond to the manager..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
                    required
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" loading={sendReplyMutation.isPending}>
                      <Send size={14} />
                      Send Reply
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="p-3 bg-[#EDFAF4] border border-[#A8DFC5] rounded-lg text-xs text-[#16865B] text-center font-medium">
                  This query has been marked as resolved by your manager.
                </div>
              )}
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}

