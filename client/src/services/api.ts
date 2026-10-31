// ============================================================
// API CLIENT — Axios instance
// ============================================================

import axios from 'axios';
import type { ApiResponse } from '../types';
import { auth } from '../firebase';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Firebase ID token or stored auth token
api.interceptors.request.use(async (config) => {
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    } catch {
      // Continue with stored token
    }
  }
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: unwrap data or throw
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      // Redirect to login if session expired (but not on login page itself)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ============================================================
// API SERVICE FUNCTIONS
// ============================================================

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse>('/auth/login', { email, password }),
  logout: () => api.post<ApiResponse>('/auth/logout'),
  me: () => api.get<ApiResponse>('/auth/me'),
};

// Employees
export const employeeApi = {
  getAll: (params?: Record<string, string>) =>
    api.get<ApiResponse>('/employees', { params }),
  getById: (id: string) => api.get<ApiResponse>(`/employees/${id}`),
  create: (data: unknown) => api.post<ApiResponse>('/employees', data),
  update: (id: string, data: unknown) => api.patch<ApiResponse>(`/employees/${id}`, data),
  updateStatus: (id: string, active: boolean) =>
    api.patch<ApiResponse>(`/employees/${id}/status`, { active }),
};

// Tasks
export const taskApi = {
  getAll: (params?: Record<string, string>) =>
    api.get<ApiResponse>('/tasks', { params }),
  getById: (id: string) => api.get<ApiResponse>(`/tasks/${id}`),
  create: (data: unknown) => api.post<ApiResponse>('/tasks', data),
  update: (id: string, data: unknown) => api.patch<ApiResponse>(`/tasks/${id}`, data),
  cancel: (id: string) => api.post<ApiResponse>(`/tasks/${id}/cancel`),
  getHistory: (id: string) => api.get<ApiResponse>(`/tasks/${id}/history`),
  getMembers: (id: string) => api.get<ApiResponse>(`/tasks/${id}/members`),
  updateMemberStatus: (taskId: string, memberId: string, status: string, explanation?: string) =>
    api.patch<ApiResponse>(`/tasks/${taskId}/members/${memberId}/status`, { status, explanation }),
  submitTask: (taskId: string, memberId: string, submissionNote?: string) =>
    api.post<ApiResponse>(`/tasks/${taskId}/members/${memberId}/submit`, { submissionNote }),
  approveMember: (taskId: string, memberId: string) =>
    api.post<ApiResponse>(`/tasks/${taskId}/members/${memberId}/approve`),
  requestRevision: (taskId: string, memberId: string, reason: string) =>
    api.post<ApiResponse>(`/tasks/${taskId}/members/${memberId}/request-revision`, { reason }),
};

// Status Requests
export const statusRequestApi = {
  getAll: () => api.get<ApiResponse>('/status-requests'),
  getPresets: () => api.get<ApiResponse>('/status-requests/presets'),
  send: (taskId: string, data: unknown) =>
    api.post<ApiResponse>(`/tasks/${taskId}/status-requests`, data),
  respond: (requestId: string, responseText: string) =>
    api.post<ApiResponse>(`/status-requests/${requestId}/respond`, { responseText }),
};

// Queries
export const queryApi = {
  getAll: (params?: Record<string, string>) =>
    api.get<ApiResponse>('/queries', { params }),
  getById: (id: string) => api.get<ApiResponse>(`/queries/${id}`),
  getByTask: (taskId: string) => api.get<ApiResponse>(`/tasks/${taskId}/queries`),
  create: (taskId: string, data: unknown) =>
    api.post<ApiResponse>(`/tasks/${taskId}/queries`, data),
  addMessage: (queryId: string, message: string) =>
    api.post<ApiResponse>(`/queries/${queryId}/messages`, { message }),
  updateStatus: (queryId: string, status: string) =>
    api.patch<ApiResponse>(`/queries/${queryId}/status`, { status }),
};

// Chat
export const chatApi = {
  getMessages: (taskId: string) => api.get<ApiResponse>(`/tasks/${taskId}/messages`),
  sendMessage: (taskId: string, message: string) =>
    api.post<ApiResponse>(`/tasks/${taskId}/messages`, { message }),
};

// Notifications
export const notificationApi = {
  getAll: () => api.get<ApiResponse>('/notifications'),
  markRead: (id: string) => api.patch<ApiResponse>(`/notifications/${id}/read`),
  markAllRead: () => api.post<ApiResponse>('/notifications/read-all'),
};

// Dashboard
export const dashboardApi = {
  admin: () => api.get<ApiResponse>('/dashboard/admin'),
  employee: () => api.get<ApiResponse>('/dashboard/employee'),
};

// Reports
export const reportApi = {
  getReport: (params?: Record<string, string>) =>
    api.get<ApiResponse>('/reports', { params }),
};

// Reminders
export const reminderApi = {
  preview: () => api.get<ApiResponse>('/reminders/preview'),
  evaluate: () => api.post<ApiResponse>('/reminders/evaluate'),
};

