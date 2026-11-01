import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCheck, Bell, ExternalLink, Send, ShieldCheck, AlertCircle } from 'lucide-react';
import { notificationApi, pushApi } from '../../services/api';
import { formatRelative } from '../../utils/formatDate';
import { getNotificationPermission, requestAndRegisterPush } from '../../services/fcm';
import { useAuth } from '../../contexts/AuthContext';
import type { Notification } from '../../types';

interface NotificationDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  onClose: () => void;
  role: 'admin' | 'employee';
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onClose,
  role,
}: NotificationDropdownProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const permission = getNotificationPermission();

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

  const handleTestPush = async () => {
    if (!user) return;
    setIsTesting(true);
    setTestPushStatus(null);
    try {
      if (permission !== 'granted') {
        const reg = await requestAndRegisterPush(user.id);
        if (!reg.success) {
          setTestPushStatus('Permission required');
          setIsTesting(false);
          return;
        }
      }
      const res = await pushApi.sendTestPush();
      setTestPushStatus(res.data?.message || 'Push sent!');
      setTimeout(() => setTestPushStatus(null), 4000);
    } catch (err: any) {
      setTestPushStatus(err?.response?.data?.error || 'Test failed');
      setTimeout(() => setTestPushStatus(null), 4000);
    } finally {
      setIsTesting(false);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.readAt) {
      markReadMutation.mutate(notif.id);
    }
    onClose();

    if (notif.relatedTaskId) {
      const basePath = role === 'admin' ? '/admin/tasks' : '/employee/tasks';
      navigate(`${basePath}/${notif.relatedTaskId}`);
    } else if (notif.relatedQueryId) {
      navigate(role === 'admin' ? '/admin/queries' : '/employee/queries');
    }
  };

  const recent = notifications.slice(0, 5);

  return (
    <div className="absolute -right-12 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-[360px] sm:max-w-none bg-white rounded-xl shadow-xl border border-[#E4E8EF] z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E8EF] bg-[#FBFBFC]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[#172033]">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#EBF3FF] text-[#3157A4] border border-[#B8D0F5]">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="text-xs text-[#3157A4] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <CheckCheck size={14} />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Browser Push Status & Test Bar */}
      <div className="px-3.5 py-2 bg-[#F5F8FC] border-b border-[#E4E8EF] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          {permission === 'granted' ? (
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>Push: Active</span>
            </span>
          ) : permission === 'denied' ? (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <AlertCircle size={13} />
              <span>Push: Blocked in Browser</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#667085] font-medium">
              <Bell size={13} />
              <span>Push: Inactive</span>
            </span>
          )}
        </div>

        <button
          onClick={handleTestPush}
          disabled={isTesting}
          className="text-[11px] font-medium text-[#3157A4] hover:text-[#274987] flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {isTesting ? (
            <span>Sending...</span>
          ) : (
            <>
              <Send size={11} />
              <span>{testPushStatus || (permission === 'granted' ? 'Send Test Push' : 'Enable Push')}</span>
            </>
          )}
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-[#E4E8EF]">
        {recent.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#667085] flex flex-col items-center gap-1">
            <Bell size={20} className="text-[#667085]/60" />
            <span>No notifications yet</span>
          </div>
        ) : (
          recent.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-3.5 hover:bg-[#F5F7FA] transition-colors cursor-pointer flex gap-3 ${
                !n.readAt ? 'bg-[#F9FBFF]' : ''
              }`}
            >
              <div className="mt-1">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    !n.readAt ? 'bg-[#3157A4]' : 'bg-transparent'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#172033] leading-snug">{n.title}</p>
                <p className="text-xs text-[#667085] mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                <span className="text-[10px] text-[#667085]/80 mt-1 block">
                  {formatRelative(n.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2.5 border-t border-[#E4E8EF] text-center bg-[#FBFBFC]">
        <button
          onClick={() => {
            onClose();
            navigate(role === 'admin' ? '/admin/notifications' : '/employee/notifications');
          }}
          className="text-xs font-medium text-[#3157A4] hover:underline flex items-center justify-center gap-1 w-full py-1 cursor-pointer"
        >
          <span>View all notifications</span>
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}

