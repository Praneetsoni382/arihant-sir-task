import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PageLoader } from './components/ui/LoadingSpinner';

// Auth
import { LoginPage } from './pages/auth/LoginPage';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { EmployeesPage } from './pages/admin/EmployeesPage';
import { TasksPage } from './pages/admin/TasksPage';
import { CreateTaskPage } from './pages/admin/CreateTaskPage';
import { TaskDetailPage as AdminTaskDetailPage } from './pages/admin/TaskDetailPage';
import { QueriesPage as AdminQueriesPage } from './pages/admin/QueriesPage';
import { StatusRequestsPage } from './pages/admin/StatusRequestsPage';
import { NotificationsPage as AdminNotificationsPage } from './pages/admin/NotificationsPage';
import { ReportsPage } from './pages/admin/ReportsPage';

// Employee pages
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { MyTasksPage } from './pages/employee/MyTasksPage';
import { TaskDetailPage as EmployeeTaskDetailPage } from './pages/employee/TaskDetailPage';
import { QueriesPage as EmployeeQueriesPage } from './pages/employee/QueriesPage';
import { NotificationsPage as EmployeeNotificationsPage } from './pages/employee/NotificationsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/employee'} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RootRedirect />} />

            {/* Admin Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/employees" element={<EmployeesPage />} />
              <Route path="/admin/tasks" element={<TasksPage />} />
              <Route path="/admin/tasks/new" element={<CreateTaskPage />} />
              <Route path="/admin/tasks/:id" element={<AdminTaskDetailPage />} />
              <Route path="/admin/queries" element={<AdminQueriesPage />} />
              <Route path="/admin/status-requests" element={<StatusRequestsPage />} />
              <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
              <Route path="/admin/reports" element={<ReportsPage />} />
            </Route>

            {/* Employee Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
              <Route path="/employee" element={<EmployeeDashboard />} />
              <Route path="/employee/tasks" element={<MyTasksPage />} />
              <Route path="/employee/tasks/:id" element={<EmployeeTaskDetailPage />} />
              <Route path="/employee/queries" element={<EmployeeQueriesPage />} />
              <Route path="/employee/notifications" element={<EmployeeNotificationsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
