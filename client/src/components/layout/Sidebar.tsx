import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Users,
  HelpCircle,
  MessageSquareReply,
  Bell,
  FileText,
  LogOut,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationApi } from '../../services/api';
import type { Notification } from '../../types';

interface SidebarProps {
  role: 'admin' | 'employee';
}

export function Sidebar({ role }: SidebarProps) {
  const { user, logout } = useAuth();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationApi.getAll();
      return res.data?.data as { notifications: Notification[]; unreadCount: number };
    },
    refetchInterval: 15000,
  });

  const unreadCount = notifData?.unreadCount ?? 0;

  const adminLinks = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/tasks', label: 'All Tasks', icon: CheckSquare, end: true },
    { to: '/admin/tasks/new', label: 'Create Task', icon: PlusCircle },
    { to: '/admin/employees', label: 'Employees', icon: Users },
    { to: '/admin/status-requests', label: 'Status Requests', icon: MessageSquareReply },
    { to: '/admin/queries', label: 'Queries', icon: HelpCircle },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { to: '/admin/reports', label: 'Reports', icon: FileText },
  ];

  const employeeLinks = [
    { to: '/employee', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/employee/tasks', label: 'My Tasks', icon: CheckSquare },
    { to: '/employee/queries', label: 'Queries', icon: HelpCircle },
    { to: '/employee/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
  ];

  const links = role === 'admin' ? adminLinks : employeeLinks;

  return (
    <aside className="w-64 bg-white border-r border-[#E4E8EF] flex flex-col h-screen shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#E4E8EF] gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#3157A4] flex items-center justify-center text-white font-bold shadow-xs">
          <Briefcase size={18} />
        </div>
        <div>
          <h1 className="font-bold text-base text-[#172033] leading-tight tracking-tight">TaskFlow</h1>
          <p className="text-[11px] text-[#667085] font-medium uppercase tracking-wider">Enterprise OS</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#EBF3FF] text-[#3157A4]'
                    : 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#172033]'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon size={18} />
                <span>{link.label}</span>
              </div>
              {link.badge !== undefined && link.badge > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#D64545] text-white">
                  {link.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-3 border-t border-[#E4E8EF] bg-[#FBFBFC]">
        <div className="flex items-center justify-between px-2 py-2 mb-1">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#EBF3FF] text-[#3157A4] border border-[#B8D0F5] flex items-center justify-center text-xs font-bold shrink-0">
              {user?.fullName?.charAt(0) ?? 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-[#172033] truncate leading-tight">{user?.fullName}</p>
              <p className="text-[11px] text-[#667085] truncate capitalize">{user?.role} • {user?.department || 'Staff'}</p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          type="button"
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#D64545] hover:bg-[#FFF0F0] rounded-lg transition-colors cursor-pointer"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

