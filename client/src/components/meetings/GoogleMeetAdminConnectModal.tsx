import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, CheckCircle2, AlertTriangle, Unlink } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { meetingApi } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleMeetAdminConnectModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [connectError, setConnectError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['admin-google-status'],
    queryFn: async () => {
      const { getGoogleMeetAccessToken } = await import('../../services/googleMeet');
      await getGoogleMeetAccessToken(false);
      const res = await meetingApi.getGoogleStatus();
      return res.data?.data as {
        isConnected: boolean;
        connectedEmail?: string;
        hasClientId: boolean;
      };
    },
    enabled: isOpen,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { clearGoogleTokenCache } = await import('../../services/googleMeet');
      clearGoogleTokenCache();
      return meetingApi.disconnectGoogle();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
    },
  });

  const handleConnectOAuth = async () => {
    setConnectError('');
    setIsConnecting(true);
    try {
      const { getGoogleMeetAccessToken } = await import('../../services/googleMeet');
      const authData = await getGoogleMeetAccessToken(true);
      if (!authData?.accessToken) {
        throw new Error('Google authorization was cancelled or access token is missing.');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
    } catch (popupErr: any) {
      console.warn('Google Meet connection error:', popupErr);
      const errMsg = popupErr?.message || popupErr?.code || '';
      if (errMsg.includes('popup-closed-by-user') || popupErr?.code === 'auth/popup-closed-by-user') {
        setConnectError(
          'Sign-in Popup Closed: The Google authorization popup window was closed before completing account selection. Please click "Connect with Google" again and select your Google account.'
        );
      } else if (errMsg.includes('popup-blocked') || popupErr?.code === 'auth/popup-blocked') {
        setConnectError(
          'Popup Blocked: Your browser blocked the Google Sign-in popup. Please allow pop-ups for this site in your browser address bar and try again.'
        );
      } else if (errMsg.includes('unauthorized-domain') || popupErr?.code === 'auth/unauthorized-domain') {
        setConnectError(
          'Firebase Auth Domain Notice: Your current production domain is not added to Firebase Authorized Domains. Go to Firebase Console > Authentication > Settings > Authorized domains and add your deployed app domain.'
        );
      } else {
        setConnectError(errMsg || 'Google authorization was cancelled or failed.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleQuickConnect = async () => {
    setConnectError('');
    setIsConnecting(true);
    try {
      await meetingApi.connectManual({});
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
    } catch (err: any) {
      setConnectError(err?.message || 'Quick connect failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = statusData?.isConnected;
  const connectedEmail = statusData?.connectedEmail || 'admin@company.com';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Google Meet Account Integration"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close Settings
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="p-4 bg-[#F8FAFD] rounded-xl border border-[#E4E8EF] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EBF3FF] border border-[#B8D0F5] text-[#3157A4] flex items-center justify-center shrink-0">
              <Video size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#172033]">Google Meet Integration Status</p>
              {isLoading ? (
                <p className="text-[11px] text-[#667085]">Checking connection...</p>
              ) : isConnected ? (
                <div className="flex items-center gap-1.5 text-xs text-[#16865B] font-semibold mt-0.5">
                  <CheckCircle2 size={13} />
                  <span>Connected ({connectedEmail})</span>
                </div>
              ) : (
                <p className="text-[11px] text-[#D64545] font-semibold mt-0.5">
                  Not Connected — Admin Account Authorization Required
                </p>
              )}
            </div>
          </div>

          {isConnected ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              loading={disconnectMutation.isPending}
              className="text-xs text-[#D64545] hover:bg-[#FFF0F0] shrink-0"
            >
              <Unlink size={13} />
              Disconnect
            </Button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleConnectOAuth}
                loading={isConnecting}
                className="bg-[#3157A4] hover:bg-[#264482] text-xs font-bold"
              >
                Connect with Google
              </Button>
            </div>
          )}
        </div>

        {connectError && (
          <div className="p-3.5 bg-[#FFF0F0] text-[#D64545] rounded-xl border border-[#F5B8B8] text-xs space-y-2">
            <span className="font-bold flex items-center gap-1.5 text-xs">
              <AlertTriangle size={15} className="shrink-0" />
              Authorization Notice
            </span>
            <p className="text-[11px] leading-relaxed">{connectError}</p>
          </div>
        )}

        {/* Workspace Authorization Instructions */}
        {!isConnected && (
          <div className="p-4 bg-[#F0F9FF] rounded-xl border border-[#B8DDFB] space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#3157A4]">
              <Video size={16} />
              <span>Official Google Meet Workspace Authorization</span>
            </div>
            <p className="text-[#667085] leading-relaxed">
              Connect your Google Workspace or Gmail account to generate genuine Google Meet discussion rooms via the official Google Meet REST API v2 (`meet.googleapis.com`). All meeting spaces are set to open access (`accessType: 'OPEN'`) so administrators and employees join the exact same live room without host admission delays.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleConnectOAuth}
                loading={isConnecting}
                className="bg-[#3157A4] hover:bg-[#264482] text-xs font-bold"
              >
                Authorize via Google Sign-in
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickConnect}
                loading={isConnecting}
                className="text-xs text-[#3157A4] border-[#B8DDFB] hover:bg-[#EBF3FF]"
              >
                Quick Connect (Instant Authorization)
              </Button>
            </div>
          </div>
        )}

        <div className="p-3 bg-[#FFF8E7] rounded-lg border border-[#F5D87E] text-xs space-y-1.5">
          <div className="font-bold text-[#C58A20] flex items-center gap-1.5">
            <AlertTriangle size={14} />
            <span>Production Deployment & Domain Whitelisting Note</span>
          </div>
          <p className="text-[#667085] leading-relaxed text-[11px]">
            If Google authentication fails in production with an authorization or popup message:
          </p>
          <ul className="list-disc pl-4 text-[11px] text-[#667085] space-y-1">
            <li>Ensure popups are allowed for your app's domain in your browser address bar.</li>
            <li>In Firebase Console, go to <strong>Authentication &gt; Settings &gt; Authorized domains</strong> and add your production domain (e.g., your app's hosting domain).</li>
            <li>If using Google Cloud OAuth Client ID, ensure your production domain is listed under <strong>Authorized JavaScript origins</strong> in Google Cloud Console.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

