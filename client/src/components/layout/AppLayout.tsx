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
    <div className="flex h-screen overflow-hidden bg-[#F5F7FA]">
      <Sidebar role={user?.role ?? 'employee'} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <NotificationPermissionBanner />
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

