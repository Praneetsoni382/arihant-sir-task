import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { notificationApi } from '../../services/api';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import type { Notification } from '../../types';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const res = await notificationApi.getAll();
        return (res.data?.data as { notifications: Notification[]; unreadCount: number }) || { notifications: [], unreadCount: 0 };
      } catch {
        return { notifications: [], unreadCount: 0 };
      }
    },
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
    <header className="h-16 bg-white border-b border-[#E4E8EF] px-8 flex items-center justify-between shrink-0">
      <h2 className="text-lg font-semibold text-[#172033] tracking-tight">{title}</h2>

      <div className="flex items-center gap-4">
        {/* Notifications Icon Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="p-2 rounded-lg text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FA] transition-colors relative cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#D64545] rounded-full border-2 border-white" />
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
        <div className="h-8 border-l border-[#E4E8EF] pl-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#EBF3FF] border border-[#B8D0F5] text-[#3157A4] font-semibold text-xs flex items-center justify-center">
            {user?.fullName?.charAt(0) ?? 'U'}
          </div>
          <div className="hidden sm:block">
            <span className="text-xs font-semibold text-[#172033] block leading-tight">{user?.fullName}</span>
            <span className="text-[10px] text-[#667085] capitalize block">{user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

