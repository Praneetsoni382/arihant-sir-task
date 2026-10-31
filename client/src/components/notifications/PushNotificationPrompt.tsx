// ============================================================
// PUSH NOTIFICATION PROMPT (First Login Permission Workflow)
// File: client/src/components/notifications/PushNotificationPrompt.tsx
// Fulfills Section 5: Browser Permission Workflow
// ============================================================

import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  isPushSupported,
  getNotificationPermission,
  isPromptDismissed,
  setPromptDismissed,
  requestAndRegisterPush,
} from '../../services/fcm';

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultState, setResultState] = useState<'idle' | 'success' | 'denied'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    if (!isPushSupported()) return;

    const permission = getNotificationPermission();
    // Only show if user has not yet decided (permission is 'default') and has not dismissed prompt
    if (permission === 'default' && !isPromptDismissed()) {
      // Delay slightly after login so user perceives the page first
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleEnable = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await requestAndRegisterPush(user.id);
      if (res.success) {
        setResultState('success');
        setTimeout(() => {
          setIsOpen(false);
        }, 3000);
      } else {
        if (res.permission === 'denied') {
          setResultState('denied');
        } else {
          setErrorMessage(res.error || 'Could not enable push notifications.');
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setPromptDismissed(true);
    setIsOpen(false);
  };

  return (
    <aside aria-label="Push Notifications" className="fixed bottom-6 right-6 z-50 max-w-md w-full p-4 bg-white rounded-xl shadow-2xl border border-[#E4E8EF] transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#3157A4]/10 flex items-center justify-center text-[#3157A4] shrink-0">
          <Bell className="w-5 h-5 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[#172033]">
            Enable Real-Time Push Notifications
          </h4>
          <p className="text-xs text-[#667085] mt-1 leading-relaxed">
            Receive critical desktop notifications for new task assignments, manager status checks, blocker updates, and deadline reminders—even when this tab is closed.
          </p>

          {resultState === 'idle' && (
            <>
              {errorMessage && (
                <div className="mt-2.5 p-2 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#3157A4] hover:bg-[#274987] rounded-lg transition-colors shadow-sm disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Requesting...</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      <span>Enable Notifications</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium text-[#667085] hover:text-[#172033] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </>
          )}

          {resultState === 'success' && (
            <div className="mt-2.5 p-2 bg-emerald-50 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">
                Push notifications enabled! You will now receive alerts on this device.
              </span>
            </div>
          )}

          {resultState === 'denied' && (
            <div className="mt-2.5 p-2.5 bg-amber-50 text-amber-900 text-xs rounded-lg space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                Notifications Blocked in Browser
              </p>
              <p className="text-[11px] text-amber-800">
                To enable, click the lock or tune icon on the left of your browser address bar and switch Notifications to &quot;Allow&quot;.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-[11px] font-medium text-amber-900 underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-[#667085] hover:text-[#172033] p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Close prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
