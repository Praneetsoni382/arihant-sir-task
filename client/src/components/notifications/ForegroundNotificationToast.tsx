// ============================================================
// FOREGROUND NOTIFICATION TOAST (In-App Push Listener)
// File: client/src/components/notifications/ForegroundNotificationToast.tsx
// Fulfills Section 12: Foreground & Background notification behavior
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, X, ArrowRight } from 'lucide-react';
import { listenForegroundMessages } from '../../services/fcm';

interface ToastData {
  id: string;
  title: string;
  body: string;
  url: string;
}

export function ForegroundNotificationToast() {
  const [activeToast, setActiveToast] = useState<ToastData | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    listenForegroundMessages((payload) => {
      // 1. Immediately invalidate queries so UI is up to the minute
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['queries'] });
      queryClient.invalidateQueries({ queryKey: ['status-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });

      // 2. Display unobtrusive in-app toast for active tab
      const title = payload.notification?.title || payload.data?.title || 'New Notification';
      const body = payload.notification?.body || payload.data?.body || 'You have an update.';
      const url = payload.data?.url || '/';

      const toastId = `toast-${Date.now()}`;
      setActiveToast({
        id: toastId,
        title,
        body,
        url,
      });

      // Automatically hide after 6 seconds
      setTimeout(() => {
        setActiveToast((current) => (current?.id === toastId ? null : current));
      }, 6000);
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [queryClient]);

  if (!activeToast) return null;

  const handleAction = () => {
    const target = activeToast.url;
    setActiveToast(null);
    if (target && target.startsWith('/')) {
      navigate(target);
    }
  };

  return (
    <aside aria-label="Foreground notification alert" className="fixed top-4 right-4 left-4 sm:left-auto sm:right-5 sm:max-w-sm z-50 bg-[#172033] text-white p-3.5 rounded-xl shadow-2xl border border-gray-700/50 flex items-start gap-3 animate-in fade-in slide-in-from-top-3">
      <div className="w-8 h-8 rounded-lg bg-[#3157A4] flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{activeToast.title}</p>
        <p className="text-[11px] text-gray-300 mt-0.5 line-clamp-2 leading-relaxed">
          {activeToast.body}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleAction}
            className="text-[11px] font-semibold text-[#8EB0F5] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View Details</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setActiveToast(null)}
        className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  );
}
