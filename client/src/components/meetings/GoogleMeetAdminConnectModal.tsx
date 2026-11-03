import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, CheckCircle2, AlertTriangle, Unlink, ExternalLink, Globe } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { meetingApi } from '../../services/api';
import { checkOAuthUrlParams } from '../../services/googleMeet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleMeetAdminConnectModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [connectError, setConnectError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Check URL params on open or load
  useEffect(() => {
    const { connected, error } = checkOAuthUrlParams();
    if (connected) {
      setSuccessNotice('Google Meet Workspace authorization succeeded! Connected to Google.');
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
    }
    if (error) {
      setConnectError(`Google authorization failed: ${error}`);
    }
  }, [queryClient, isOpen]);

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['admin-google-status'],
    queryFn: async () => {
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
      setSuccessNotice('');
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
    },
  });

  // Primary: Production-grade Redirect Mode (eliminates popups entirely)
  const handleConnectRedirect = async () => {
    setConnectError('');
    setSuccessNotice('');
    setIsConnecting(true);
    try {
      const { triggerGoogleMeetRedirect } = await import('../../services/googleMeet');
      await triggerGoogleMeetRedirect();
    } catch (err: any) {
      setConnectError(err?.message || 'Redirect authorization failed');
      setIsConnecting(false);
    }
  };

  // Secondary: Popup Mode (for Preview / Local development)
  const handleConnectPopup = async () => {
    setConnectError('');
    setSuccessNotice('');
    setIsConnecting(true);
    try {
      const { getGoogleMeetAccessToken } = await import('../../services/googleMeet');
      const authData = await getGoogleMeetAccessToken(true);
      if (!authData?.accessToken) {
        throw new Error('Google authorization was cancelled or access token is missing.');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
      setSuccessNotice(`Connected to Google account (${authData.email || 'Admin'}) successfully!`);
    } catch (popupErr: any) {
      console.warn('Google Meet connection error:', popupErr);
      const errMsg = popupErr?.message || popupErr?.code || '';
      if (errMsg.includes('popup-closed-by-user') || popupErr?.code === 'auth/popup-closed-by-user') {
        setConnectError(
          'Sign-in Popup Closed: The Google authorization popup window was closed before completing account selection. Please use "Authorize via Google (Redirect Mode)" below to sign in directly in the main browser window.'
        );
      } else if (errMsg.includes('popup-blocked') || popupErr?.code === 'auth/popup-blocked') {
        setConnectError(
          'Popup Blocked: Your browser blocked the Google Sign-in popup. Please use "Authorize via Google (Redirect Mode)" below to sign in directly in the main browser window without popups.'
        );
      } else {
        setConnectError(errMsg || 'Google authorization was cancelled or failed.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Instant Quick Connect (for zero-latency development & testing)
  const handleQuickConnect = async () => {
    setConnectError('');
    setSuccessNotice('');
    setIsConnecting(true);
    try {
      await meetingApi.connectManual({});
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
      setSuccessNotice('Instant Quick Connect authorized successfully.');
    } catch (err: any) {
      setConnectError(err?.message || 'Quick connect failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = statusData?.isConnected;
  const connectedEmail = statusData?.connectedEmail || 'admin@company.com';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentRedirectUri = `${currentOrigin}/api/admin/google/callback`;

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
        {/* Status card */}
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
                onClick={handleConnectRedirect}
                loading={isConnecting}
                className="bg-[#3157A4] hover:bg-[#264482] text-xs font-bold"
              >
                Connect with Google
              </Button>
            </div>
          )}
        </div>

        {/* Success Notice */}
        {successNotice && (
          <div className="p-3.5 bg-[#EDFAF4] text-[#16865B] rounded-xl border border-[#A8DFC5] text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span className="font-semibold">{successNotice}</span>
          </div>
        )}

        {/* Error Notice */}
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
              Connect your Google account to create genuine Google Meet discussion rooms via the official Google Meet REST API v2 (<code className="font-mono text-[#172033]">meet.googleapis.com</code>). Meeting spaces are configured with <code className="font-mono text-[#172033]">accessType: 'OPEN'</code> so both admins and employees join the exact same live room instantly.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleConnectRedirect}
                loading={isConnecting}
                className="bg-[#3157A4] hover:bg-[#264482] text-xs font-bold"
              >
                <ExternalLink size={13} />
                Authorize via Google (Redirect Mode — Recommended)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectPopup}
                loading={isConnecting}
                className="text-xs text-[#3157A4] border-[#B8DDFB] hover:bg-[#EBF3FF]"
              >
                Popup Mode (Preview / Desktop)
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

        {/* Production Configuration & URI Reference */}
        <div className="p-3.5 bg-[#FFF8E7] rounded-xl border border-[#F5D87E] text-xs space-y-2">
          <div className="font-bold text-[#C58A20] flex items-center gap-1.5">
            <Globe size={14} />
            <span>Google Cloud Console Credentials Setup Reference</span>
          </div>
          <p className="text-[#667085] leading-relaxed text-[11px]">
            In Google Cloud Console under <strong>APIs &amp; Services &gt; Credentials &gt; OAuth 2.0 Client IDs</strong>:
          </p>
          <div className="space-y-1.5 text-[11px]">
            <div>
              <span className="font-semibold text-[#172033] block">1. Authorized JavaScript Origins:</span>
              <code className="px-2 py-0.5 bg-white border border-[#E4E8EF] rounded font-mono text-[#3157A4] select-all block mt-0.5 break-all">
                {currentOrigin}
              </code>
            </div>
            <div>
              <span className="font-semibold text-[#172033] block">2. Authorized Redirect URIs:</span>
              <code className="px-2 py-0.5 bg-white border border-[#E4E8EF] rounded font-mono text-[#3157A4] select-all block mt-0.5 break-all">
                {currentRedirectUri}
              </code>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
