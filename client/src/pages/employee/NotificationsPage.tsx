import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { notificationApi } from '../../services/api';
import { formatRelative } from '../../utils/formatDate';
import type { Notification } from '../../types';

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data: notifData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationApi.getAll();
      return res.data?.data as { notifications: Notification[]; unreadCount: number };
    },
    refetchInterval: 10000,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.readAt;
    return true;
  });

  const handleNotificationClick = (n: Notification) => {
    if (!n.readAt) {
      markReadMutation.mutate(n.id);
    }
    if (n.relatedTaskId) {
      navigate(`/employee/tasks/${n.relatedTaskId}`);
    } else if (n.relatedQueryId) {
      navigate('/employee/queries');
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Notifications">
        <PageLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="My Notifications">
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4E8EF]">
          <div>
            <h1 className="text-xl font-bold text-[#172033]">Notifications & Updates</h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Task assignments, status inquiries from managers, and query responses
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAllReadMutation.mutate()}
              loading={markAllReadMutation.isPending}
            >
              <CheckCheck size={16} />
              Mark All as Read ({unreadCount})
            </Button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'primary' : 'secondary'}
            onClick={() => setFilter('all')}
          >
            All Notifications ({notifications.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'unread' ? 'primary' : 'secondary'}
            onClick={() => setFilter('unread')}
          >
            Unread Only ({unreadCount})
          </Button>
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="text-center py-12 text-xs text-[#667085]">
              No notifications to display.
            </Card>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                  !n.readAt
                    ? 'bg-white border-[#3157A4] shadow-xs'
                    : 'bg-[#FAFAFB] border-[#E4E8EF] hover:bg-white'
                }`}
              >
                <div className="mt-1">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      !n.readAt
                        ? 'bg-[#EBF3FF] text-[#3157A4]'
                        : 'bg-[#F5F7FA] text-[#667085]'
                    }`}
                  >
                    <Bell size={16} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-[#172033]">{n.title}</h3>
                    <span className="text-[10px] text-[#667085] whitespace-nowrap">
                      {formatRelative(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] mt-1 leading-relaxed">{n.body}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E4E8EF]/60">
                    <span className="text-[10px] text-[#667085]">
                      Event: <span className="font-semibold text-[#172033]">{n.eventType}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-[#3157A4] flex items-center gap-1 hover:underline">
                      <span>Go to Task</span>
                      <ExternalLink size={12} />
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}

