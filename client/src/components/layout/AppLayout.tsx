import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NotificationPermissionBanner } from '../notifications/NotificationPermissionBanner';
import { useAuth } from '../../contexts/AuthContext';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-[#F1F4FC]">
      <Sidebar role={user?.role ?? 'employee'} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Ambient fluid glow in the top-right background */}
        <div className="absolute top-0 right-0 w-[550px] h-[360px] bg-gradient-to-bl from-[#DCE8FC]/60 via-[#E8EDFB]/30 to-transparent blur-3xl pointer-events-none" />

        <NotificationPermissionBanner />
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-5 sm:p-7 md:p-8 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}

