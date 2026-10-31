import { useState } from 'react';
import { Bell, ShieldCheck, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getNotificationPermission,
  isPromptDismissed,
  setPromptDismissed,
  requestAndRegisterPush,
} from '../../services/fcm';

export function NotificationPermissionBanner() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    () => getNotificationPermission()
  );
  const [dismissed, setDismissed] = useState<boolean>(() => isPromptDismissed());
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!user || permission === 'granted' || permission === 'unsupported' || permission === 'denied' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const result = await requestAndRegisterPush(user.id);
      setPermission(result.permission);
      if (result.success) {
        setStatusMessage('Notifications enabled!');
        setTimeout(() => setStatusMessage(null), 3000);
      } else if (result.error) {
        setStatusMessage(result.error);
      }
    } catch (err: any) {
      setStatusMessage(err?.message || 'Permission request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setPromptDismissed(true);
  };

  return (
    <div className="bg-[#EBF3FF] border-b border-[#B8D0F5] px-4 py-3 text-xs text-[#172033] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#3157A4] text-white flex items-center justify-center shrink-0">
          <Bell size={16} />
        </div>
        <div>
          <p className="font-semibold text-[#172033] flex items-center gap-1.5">
            <span>Enable Push Notifications</span>
            <Sparkles size={13} className="text-[#3157A4]" />
          </p>
          <p className="text-[11px] text-[#42526E] mt-0.5">
            Receive instant desktop alerts when tasks are assigned, queries answered, or status updates requested.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
        {statusMessage ? (
          <span className="text-[11px] font-medium text-[#3157A4] px-2 py-1 bg-white rounded-md border border-[#B8D0F5]">
            {statusMessage}
          </span>
        ) : (
          <button
            onClick={handleEnable}
            disabled={loading}
            className="px-3 py-1.5 bg-[#3157A4] hover:bg-[#274987] text-white font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs text-xs"
          >
            <ShieldCheck size={14} />
            <span>{loading ? 'Enabling...' : 'Enable Notifications'}</span>
          </button>
        )}

        <button
          onClick={handleDismiss}
          className="p-1.5 text-[#667085] hover:text-[#172033] hover:bg-[#D6E4FF] rounded-lg transition-colors cursor-pointer"
          title="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
