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
    <aside className="w-64 bg-[#071B3A] text-white flex flex-col h-screen shrink-0 relative overflow-hidden border-r border-[#0D254C]">
      {/* Brand Header */}
      <div className="h-18 flex items-center px-6 gap-3.5 relative z-10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2458D3] to-[#168BFF] flex items-center justify-center text-white shadow-[0_4px_14px_rgba(22,139,255,0.4)]">
          <Briefcase size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-heading font-semibold text-base text-white leading-tight tracking-tight">
            TaskFlow
          </h1>
          <p className="text-[11px] text-[#38BDF8] font-medium tracking-wide">Enterprise OS</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto relative z-10">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#2458D3] to-[#168BFF] text-white shadow-[0_4px_16px_rgba(36,88,211,0.45)]'
                    : 'text-[#8E9EB5] hover:text-white hover:bg-white/[0.07]'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon size={17} />
                <span>{link.label}</span>
              </div>
              {link.badge !== undefined && link.badge > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-semibold tabular-nums rounded-full bg-[#E34D59] text-white shadow-xs">
                  {link.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Subtle Decorative Wave at Bottom of Sidebar */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-40 overflow-hidden h-36">
        <svg viewBox="0 0 256 144" fill="none" className="w-full h-full object-cover">
          <path
            d="M-20 80 C 40 40, 100 120, 180 70 C 220 40, 260 90, 300 60 L 300 150 L -20 150 Z"
            fill="url(#sidebarWaveGrad)"
            opacity="0.3"
          />
          <path
            d="M-20 100 C 60 70, 120 130, 200 85 C 240 60, 280 110, 320 80"
            stroke="url(#sidebarLineGrad)"
            strokeWidth="1.5"
            fill="none"
          />
          <defs>
            <linearGradient id="sidebarWaveGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2458D3" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0B2554" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sidebarLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#168BFF" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* User Profile & Logout */}
      <div className="p-3.5 border-t border-white/10 bg-[#06152D]/80 backdrop-blur-md relative z-10">
        <div className="flex items-center justify-between px-2 py-1.5 mb-1.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#2458D3] text-white border border-blue-400/30 flex items-center justify-center text-xs font-semibold shrink-0 shadow-xs">
              {user?.fullName?.charAt(0) ?? 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate leading-tight">{user?.fullName}</p>
              <p className="text-[11px] text-[#8E9EB5] truncate capitalize font-normal">{user?.role} • {user?.department || 'Staff'}</p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          type="button"
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-[#F87171] hover:text-white hover:bg-red-500/15 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

