import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Send,
  CheckCircle2,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { reminderApi } from '../../services/api';

export function ISTClockWidget() {
  const queryClient = useQueryClient();

  // Fetch server IST status
  const { data: istData, refetch, isFetching } = useQuery({
    queryKey: ['ist-status'],
    queryFn: async () => {
      const res = await reminderApi.getISTStatus();
      return res.data?.data as {
        clock: {
          iso: string;
          time24: string;
          time12: string;
          timeWithSeconds: string;
          date: string;
          dateFormatted: string;
          timezone: string;
          offset: string;
          epoch: number;
        };
        stats: {
          active: boolean;
          intervalSeconds: number;
          lastCheckAt: string | null;
          totalDispatchesToday: number;
          lastDispatchedSummary: string | null;
          activePendingTasksCount: number;
        };
        scheduledTasks: Array<{
          id: string;
          referenceNumber: string;
          title: string;
          deadline: string;
          reminderTimes: string[];
          pendingMembersCount: number;
          pendingMembers: Array<{ userId: string; fullName: string; memberStatus: string }>;
        }>;
      };
    },
    refetchInterval: 15000,
  });

  // Local live ticking IST clock (ticks every 1s)
  const [liveIST, setLiveIST] = useState<string>('');
  const [liveDate, setLiveDate] = useState<string>('');
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const timeStr = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now);

        const dateStr = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(now);

        setLiveIST(timeStr);
        setLiveDate(dateStr);
      } catch {
        // Fallback
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Mutation to manually trigger pending notification check now
  const triggerMutation = useMutation({
    mutationFn: () => reminderApi.triggerIST({ forceAll: true }),
    onSuccess: (res) => {
      const data = res.data?.data as { dispatchedCount?: number } | undefined;
      const dispatched = data?.dispatchedCount ?? 0;
      setTriggerMessage(
        dispatched > 0
          ? `Dispatched pending task alerts to ${dispatched} concerned employee(s) successfully! 🚀`
          : 'All concerned employees are already up-to-date or no pending tasks matched.'
      );
      queryClient.invalidateQueries({ queryKey: ['ist-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setTimeout(() => setTriggerMessage(null), 6000);
    },
    onError: (err: any) => {
      setTriggerMessage(err?.response?.data?.error || 'Failed to dispatch pending reminders.');
      setTimeout(() => setTriggerMessage(null), 5000);
    },
  });

  const clock = istData?.clock;
  const stats = istData?.stats;
  const scheduledTasks = istData?.scheduledTasks || [];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#172033] via-[#1E2D4A] to-[#253D68] text-white p-5 sm:p-6 shadow-xl border border-[#3157A4]/40">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-60 h-60 bg-[#3157A4]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left: Clock Display & Details */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#3157A4] text-white shadow-xs">
              <span>🇮🇳 Indian Standard Time (IST)</span>
              <span className="opacity-80">• UTC+5:30</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Backend Clock Loop: Active (30s)</span>
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <div className="text-3xl sm:text-4xl lg:text-5xl font-mono font-extrabold tracking-tight text-white drop-shadow-sm">
              {liveIST || clock?.timeWithSeconds || 'Loading IST...'}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
              IST
            </span>
          </div>

          <p className="text-xs text-blue-200/90 flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-300" />
            <span>{liveDate || clock?.dateFormatted || 'Asia/Kolkata Standard Time'}</span>
          </p>

          <p className="text-[11px] text-gray-300 max-w-xl leading-relaxed">
            Automatic background scheduler matches configured time slots in Indian Standard Time (IST) and dispatches real-time push and in-app alerts to assigned employees for their pending tasks.
          </p>
        </div>

        {/* Right: Stats & Immediate Trigger Button */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-4 text-xs bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/15 w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <p className="text-[10px] text-gray-300 uppercase tracking-wider">Pending Tasks Monitored</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {stats?.activePendingTasksCount ?? scheduledTasks.length}
              </p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <p className="text-[10px] text-gray-300 uppercase tracking-wider">Dispatches Today</p>
              <p className="text-lg font-bold text-emerald-300 mt-0.5">
                {stats?.totalDispatchesToday ?? 0}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh IST Status"
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/15 cursor-pointer"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-blue-500 to-[#3157A4] hover:from-blue-600 hover:to-[#254687] text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 border border-blue-400/40"
            >
              {triggerMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Checking & Dispatching...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Dispatch Pending Reminders Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Trigger Feedback Banner */}
      {triggerMessage && (
        <div className="mt-4 p-3 bg-white/15 backdrop-blur-md border border-white/25 rounded-xl text-xs text-white flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="font-medium">{triggerMessage}</span>
        </div>
      )}

      {/* Active Tasks Scheduled Time Slots Preview */}
      {scheduledTasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          <span className="text-gray-300 flex items-center gap-1 font-medium">
            <Clock size={12} className="text-blue-300" />
            <span>Active Scheduled Tasks (IST Slots):</span>
          </span>
          {scheduledTasks.slice(0, 4).map((t) => (
            <div
              key={t.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/20 border border-white/10 text-white"
            >
              <span className="font-semibold text-blue-200">{t.referenceNumber}:</span>
              <span className="truncate max-w-[120px]">{t.title}</span>
              <span className="text-emerald-300 font-mono text-[10px]">
                [{t.reminderTimes.join(', ')}]
              </span>
              {t.pendingMembersCount > 0 && (
                <span className="text-amber-300 text-[10px]">
                  ({t.pendingMembersCount} pending)
                </span>
              )}
            </div>
          ))}
          {scheduledTasks.length > 4 && (
            <span className="text-blue-200 text-[10px]">
              +{scheduledTasks.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
