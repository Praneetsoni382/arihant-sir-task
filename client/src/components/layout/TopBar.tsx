import { useState, useRef, useEffect } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { notificationApi } from '../../services/api';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import type { Notification } from '../../types';

interface TopBarProps {
  title: string;
}

import { Key } from 'lucide-react';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

export function TopBar({ title }: TopBarProps) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const res = await notificationApi.getAll();
        if (res?.data?.success && res?.data?.data) {
          return res.data.data as { notifications: Notification[]; unreadCount: number };
        }
        return { notifications: [], unreadCount: 0 };
      } catch {
        return { notifications: [], unreadCount: 0 };
      }
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#E4EBF7] px-6 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-1.5 -ml-1 text-[#687894] hover:text-[#14213D] rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle navigation"
          >
            <Menu size={20} />
          </button>
          <h2 className="font-heading font-semibold text-base sm:text-lg text-[#14213D] tracking-tight">{title}</h2>
        </div>

        <div className="flex items-center gap-3.5">
          {/* Change Password Button */}
          <button
            type="button"
            onClick={() => setChangePasswordOpen(true)}
            className="w-9 h-9 rounded-full bg-[#F1F4FC] hover:bg-[#E4EBF7] flex items-center justify-center text-[#475569] hover:text-[#2458D3] transition-colors relative cursor-pointer"
            title="Change Password"
          >
            <Key size={17} />
          </button>

          {/* Notifications Icon Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-[#F1F4FC] hover:bg-[#E4EBF7] flex items-center justify-center text-[#475569] hover:text-[#14213D] transition-colors relative cursor-pointer"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#E34D59] rounded-full border-2 border-white shadow-xs" />
              )}
            </button>

            {dropdownOpen && (
              <NotificationDropdown
                notifications={notifications}
                unreadCount={unreadCount}
                onClose={() => setDropdownOpen(false)}
                role={user?.role ?? 'employee'}
              />
            )}
          </div>

          {/* User Badge */}
          <div className="flex items-center gap-3 pl-2">
            <div className="w-8 h-8 rounded-full bg-[#071B3A] text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-xs">
              {user?.fullName?.charAt(0) ?? 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <span className="text-xs font-semibold text-[#14213D] block leading-tight">{user?.fullName}</span>
              <span className="text-[11px] text-[#687894] capitalize block font-normal">
                {user?.role === 'admin' ? 'Admin' : 'Employee'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}

