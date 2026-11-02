import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, CheckCircle2, AlertTriangle, Unlink, Zap } from 'lucide-react';
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
      if (errMsg.includes('unauthorized-domain') || popupErr?.code === 'auth/unauthorized-domain') {
        setConnectError(
          'Firebase Auth Domain Notice: Your production domain is not added to Firebase Authorized Domains. To fix this, go to Firebase Console > Authentication > Settings > Authorized domains, and click "Add domain" to enter your deployed website domain.'
        );
      } else {
        setConnectError(errMsg || 'Google authorization was cancelled or failed.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = statusData?.isConnected;
  const connectedEmail = statusData?.connectedEmail || 'neurotantraa@gmail.com';

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
            <Button
              size="sm"
              onClick={handleConnectOAuth}
              loading={isConnecting}
              className="bg-[#3157A4] hover:bg-[#264482] text-xs shrink-0"
            >
              <Zap size={13} />
              Connect with Google
            </Button>
          )}
        </div>

        {connectError && (
          <div className="p-3 bg-[#FFF0F0] text-[#D64545] rounded-xl border border-[#F5B8B8] text-xs space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <AlertTriangle size={14} />
              Authorization Notice
            </span>
            <p className="text-[11px] leading-relaxed">{connectError}</p>
          </div>
        )}

        {/* 1-Click Quick Connect Banner when not connected */}
        {!isConnected && (
          <div className="p-4 bg-[#F0F9FF] rounded-xl border border-[#B8DDFB] space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#3157A4]">
              <Zap size={16} />
              <span>Official Google Meet Workspace Authorization</span>
            </div>
            <p className="text-[#667085] leading-relaxed">
              Connect your administrator account using Google Sign-in to generate genuine Google Meet discussion rooms via the official Google Meet REST API v2. Both you and your employees will join the exact same live room.
            </p>
            <Button
              size="sm"
              onClick={handleConnectOAuth}
              loading={isConnecting}
              className="bg-[#16865B] hover:bg-[#126b48] text-xs font-bold w-full sm:w-auto"
            >
              <CheckCircle2 size={14} />
              Authorize Google Meet API Access
            </Button>
          </div>
        )}

        <div className="p-3 bg-[#FFF8E7] rounded-lg border border-[#F5D87E] text-xs space-y-1.5">
          <div className="font-bold text-[#C58A20] flex items-center gap-1.5">
            <AlertTriangle size={14} />
            <span>Google Cloud OAuth Setup Note</span>
          </div>
          <p className="text-[#667085] leading-relaxed text-[11px]">
            The <code className="bg-white px-1 py-0.5 rounded text-[10px] text-[#172033]">Missing required parameter: client_id</code> error occurs when opening standard Google OAuth consent without setting <code className="bg-white px-1 py-0.5 rounded text-[10px] text-[#172033]">GOOGLE_CLIENT_ID</code> in environment variables. Use <strong>Quick Connect</strong> above for immediate preview authorization, or supply your Google Cloud Client ID in server configuration.
          </p>
        </div>
      </div>
    </Modal>
  );
}
