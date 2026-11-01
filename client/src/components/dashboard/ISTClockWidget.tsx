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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#071B3A] via-[#0B2554] to-[#0A3370] text-white p-6 sm:p-7 shadow-[0_12px_40px_rgba(7,27,58,0.22)] border border-[#1E4E9E]/40">
      {/* Decorative Wave Pattern Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35">
        <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="w-full h-full">
          <path
            d="M 0 160 C 250 80, 450 240, 700 130 C 850 60, 950 180, 1050 120"
            fill="none"
            stroke="url(#istWaveGrad1)"
            strokeWidth="2.5"
          />
          <path
            d="M 0 210 C 200 140, 500 290, 750 180 C 900 110, 980 220, 1050 170"
            fill="none"
            stroke="url(#istWaveGrad2)"
            strokeWidth="1.8"
          />
          <defs>
            <linearGradient id="istWaveGrad1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#168BFF" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#7464E8" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="istWaveGrad2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2458D3" stopOpacity="0.2" />
              <stop offset="60%" stopColor="#00E5FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#168BFF" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left: Clock Display & Details */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#0B2554] text-[#93C5FD] border border-[#1E4E9E]/70 shadow-xs">
              <span className="font-semibold">IN</span>
              <span>Indian Standard Time (IST) · UTC+5:30</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#0A382A] text-[#34D399] border border-[#059669]/40">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>Backend Clock Loop: Active (30s)</span>
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <div className="text-4xl sm:text-5xl font-sans font-semibold tracking-tight text-white drop-shadow-sm tabular-nums">
              {liveIST || clock?.timeWithSeconds || '00:00:00 am'}
            </div>
            <span className="text-xs font-semibold text-[#38BDF8] bg-white/10 px-2 py-0.5 rounded-md border border-white/15">
              IST
            </span>
          </div>

          <p className="text-xs text-[#93C5FD] flex items-center gap-2 font-normal">
            <Calendar size={14} className="text-[#38BDF8]" />
            <span>{liveDate || clock?.dateFormatted || 'Asia/Kolkata Standard Time'}</span>
          </p>

          <p className="text-xs text-[#94A3B8] font-normal max-w-xl leading-relaxed">
            Automatic background scheduler matches configured time slots in Indian Standard Time (IST) and dispatches real-time push and in-app alerts to assigned employees for their pending tasks.
          </p>
        </div>

        {/* Right: Stats & Immediate Trigger Button */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3.5 w-full lg:w-auto">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Stat 1: Pending Tasks Monitored */}
            <div className="flex-1 sm:flex-initial flex items-center gap-3 bg-[#0B2554]/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-[#1E4E9E]/70 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-[#168BFF]/20 text-[#38BDF8] flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] font-medium">Pending tasks monitored</p>
                <p className="text-2xl font-bold text-white leading-tight mt-0.5 tabular-nums">
                  {stats?.activePendingTasksCount ?? scheduledTasks.length}
                </p>
              </div>
            </div>

            {/* Stat 2: Dispatches Today */}
            <div className="flex-1 sm:flex-initial flex items-center gap-3 bg-[#0B2554]/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-[#1E4E9E]/70 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/20 text-[#34D399] flex items-center justify-center shrink-0">
                <Send size={18} />
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] font-medium">Dispatches today</p>
                <p className="text-2xl font-bold text-[#34D399] leading-tight mt-0.5 tabular-nums">
                  {stats?.totalDispatchesToday ?? 0}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh IST Status"
              className="w-10 h-10 rounded-xl bg-[#0B2554] hover:bg-[#123675] text-white flex items-center justify-center transition-all border border-[#1E4E9E] cursor-pointer shadow-xs"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin text-[#38BDF8]' : ''} />
            </button>

            <button
              type="button"
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-[#2458D3] to-[#168BFF] hover:from-[#1D47B0] hover:to-[#0F75DC] text-white text-xs font-medium rounded-xl shadow-[0_4px_16px_rgba(22,139,255,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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
        <div className="mt-4 p-3 bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl text-xs text-white flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="font-medium">{triggerMessage}</span>
        </div>
      )}

      {/* Active Tasks Scheduled Time Slots Preview */}
      {scheduledTasks.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <span className="text-[#93C5FD] flex items-center gap-1.5 font-medium text-xs">
            <Clock size={13} className="text-[#38BDF8]" />
            <span>Active Scheduled Tasks (IST Slots):</span>
          </span>
          {scheduledTasks.slice(0, 4).map((t) => (
            <div
              key={t.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#061833]/85 border border-[#1E4E9E]/60 text-white shadow-xs"
            >
              <span className="font-semibold text-[#93C5FD] text-xs tabular-nums">{t.referenceNumber}:</span>
              <span className="truncate max-w-[130px] font-normal text-white text-xs">{t.title}</span>
              <span className="text-[#34D399] tabular-nums text-xs font-medium">
                [{t.reminderTimes.join(', ')}]
              </span>
              {t.pendingMembersCount > 0 && (
                <span className="text-[#FBBF24] text-[11px] font-medium tabular-nums">
                  ({t.pendingMembersCount} pending)
                </span>
              )}
            </div>
          ))}
          {scheduledTasks.length > 4 && (
            <span className="text-[#38BDF8] text-xs font-medium bg-white/10 px-2 py-1 rounded-lg tabular-nums">
              +{scheduledTasks.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
