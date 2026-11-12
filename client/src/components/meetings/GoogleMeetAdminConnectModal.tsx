import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, CheckCircle2, AlertTriangle, Unlink } from 'lucide-react';
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
      setSuccessNotice('Google account authorized successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
    }
    if (error) {
      setConnectError(`Google authorization notice: ${error}`);
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
      setConnectError('');
      queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
    },
  });

  // Single Main Action: Connect Google Account via Google Identity Services
  const handleConnectGoogle = async () => {
    setConnectError('');
    setSuccessNotice('');
    setIsConnecting(true);
    try {
      const { getGoogleMeetAccessToken } = await import('../../services/googleMeet');
      const authData = await getGoogleMeetAccessToken(true);
      if (!authData?.accessToken) {
        throw new Error('Google authorization was not completed. Please select your account.');
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-google-status'] });
      setSuccessNotice(`Connected to Google account (${authData.email || 'Admin'}) successfully!`);
    } catch (err: any) {
      console.warn('Google connection notice:', err);
      setConnectError(err?.message || 'Failed to connect Google account. Please try again.');
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
        {/* Connection Status Card */}
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
              onClick={handleConnectGoogle}
              loading={isConnecting}
              className="bg-[#3157A4] hover:bg-[#264482] text-xs font-bold shrink-0"
            >
              Connect with Google
            </Button>
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
          <div className="p-3.5 bg-[#FFF0F0] text-[#D64545] rounded-xl border border-[#F5B8B8] text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="font-semibold">{connectError}</span>
          </div>
        )}

        {/* Single Main Connection Card */}
        {!isConnected && (
          <div className="p-4 bg-[#F0F9FF] rounded-xl border border-[#B8DDFB] space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#3157A4]">
              <Video size={16} />
              <span>Official Google Meet Workspace Authorization</span>
            </div>
            <p className="text-[#667085] leading-relaxed">
              Connect your Google account to automatically create genuine Google Meet discussion rooms for status requests. Both admins and employees join the exact same live room instantly.
            </p>
            <div className="pt-1">
              <Button
                size="sm"
                onClick={handleConnectGoogle}
                loading={isConnecting}
                className="bg-[#3157A4] hover:bg-[#264482] text-xs font-bold"
              >
                Connect with Google
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

