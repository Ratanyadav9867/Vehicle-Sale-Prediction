import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type {
  PredictRequest,
  PredictResponse,
  HealthResponse,
  ModelInfoResponse,
  OptionsResponse,
  AuthResponse,
  User,
  LogEntry,
  PaginatedLogsResponse,
  DashboardStats,
  PredictionListResponse,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  // SECURITY FIX: withCredentials=true causes the browser to include the
  // httpOnly auth_token cookie on every request automatically. The token
  // never has to touch JavaScript or localStorage.
  withCredentials: true,
  xsrfCookieName: 'csrf_token',
  xsrfHeaderName: 'X-CSRF-Token',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

let currentCsrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

export const setCsrfToken = (token: string | null) => {
  currentCsrfToken = token;
  if (token) {
    http.defaults.headers.common['X-CSRF-Token'] = token;
  } else {
    delete http.defaults.headers.common['X-CSRF-Token'];
  }
};

export const getCsrfToken = (): string | null => currentCsrfToken;

export const ensureCsrfToken = async (): Promise<string | null> => {
  if (currentCsrfToken) return currentCsrfToken;
  if (!csrfFetchPromise) {
    csrfFetchPromise = axios
      .get<{ csrf_token: string }>(`${BASE_URL}/api/auth/csrf`, {
        withCredentials: true,
        headers: { Accept: 'application/json' },
      })
      .then(res => {
        const token =
          (res.headers['x-csrf-token'] as string) ||
          (res.headers['X-CSRF-Token'] as string) ||
          res.data?.csrf_token;
        if (token) {
          setCsrfToken(token);
          return token;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        csrfFetchPromise = null;
      });
  }
  return csrfFetchPromise;
};

// Request interceptor: attach X-CSRF-Token for state-changing calls across cross-site domains
http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = config.method?.toLowerCase() || '';
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    if (!config.headers['X-CSRF-Token']) {
      const token = currentCsrfToken || (await ensureCsrfToken());
      if (token) {
        config.headers['X-CSRF-Token'] = token;
      }
    }
  }
  return config;
});

// Centralized response & error interceptor
http.interceptors.response.use(
  response => {
    const csrfHeader =
      (response.headers['x-csrf-token'] as string) ||
      (response.headers['X-CSRF-Token'] as string);
    if (csrfHeader && typeof csrfHeader === 'string') {
      setCsrfToken(csrfHeader);
    }
    return response;
  },
  (error: AxiosError<{ detail?: any; code?: string; message?: string }>) => {
    let message = 'An unexpected error occurred while communicating with the server.';
    let code = (error.response?.data as any)?.code || (error.response?.data?.detail as any)?.code;

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      message = 'Request timed out. The backend server took longer than 10 seconds to respond.';
    } else if (!error.response) {
      message = `Backend server is unavailable at ${BASE_URL}. Please ensure the backend is running.`;
    } else {
      const status = error.response.status;
      const data = error.response.data as any;
      const detail = data?.detail;

      if (data?.message) {
        message = data.message;
      } else if (typeof detail === 'string') {
        message = detail;
      } else if (detail && typeof detail === 'object' && detail.message) {
        message = detail.message;
      } else if (status === 422 && Array.isArray(detail)) {
        const issues = detail.map((d: any) => `${d.loc?.slice(1).join('.')}: ${d.msg}`).join(', ');
        message = `Validation Error: ${issues}`;
      } else if (status === 401) {
        message = 'Authentication required. Please sign in to proceed.';
      } else if (status === 403) {
        message = 'Access denied. You do not have permission to view this resource.';
      } else if (status === 409) {
        message = 'Resource conflict.';
      } else if (status === 429) {
        message = 'Too many attempts. Please wait before trying again.';
      } else if (status === 503) {
        message = 'Service is currently unavailable. Please try again later.';
      } else if (status === 500) {
        message = 'Internal server error occurred on the backend.';
      } else if (error.message) {
        message = error.message;
      }
    }

    const customError = new Error(message);
    (customError as any).code = code;
    (customError as any).status = error.response?.status;
    (customError as any).response = error.response;
    (customError as any).originalError = error;
    return Promise.reject(customError);
  }
);

export const api = {
  // ML Endpoints
  health: (): Promise<HealthResponse> =>
    http.get<HealthResponse>('/api/health').then(r => r.data),

  modelInfo: (): Promise<ModelInfoResponse> =>
    http.get<ModelInfoResponse>('/api/model-info').then(r => r.data),

  options: (): Promise<OptionsResponse> =>
    http.get<OptionsResponse>('/api/options').then(r => r.data),

  predict: (payload: PredictRequest): Promise<PredictResponse> =>
    http.post<PredictResponse>('/api/predict', payload).then(r => r.data),

  // Predictions Endpoints
  predictions: {
    getMyPredictions: (limit = 30): Promise<PredictionListResponse> =>
      http.get<PredictionListResponse>('/api/me/predictions', { params: { limit } }).then(r => r.data),

    getAdminPredictions: (limit = 50, offset = 0): Promise<PredictionListResponse> =>
      http.get<PredictionListResponse>('/api/admin/predictions', { params: { limit, offset } }).then(r => r.data),
  },

  // Auth Endpoints
  auth: {
    register: (data: { name: string; email: string; password: string; confirm_password: string }): Promise<AuthResponse> =>
      http.post<AuthResponse>('/api/auth/register', data).then(r => r.data),

    login: (data: { email: string; password: string; remember_me?: boolean }): Promise<AuthResponse> =>
      http.post<AuthResponse>('/api/auth/login', data).then(r => r.data),

    adminLogin: (data: { email: string; password: string }): Promise<AuthResponse> =>
      http.post<AuthResponse>('/api/auth/admin-login', data).then(r => r.data),

    me: (): Promise<{ user: User }> =>
      http.get<any>('/api/auth/me').then(r => {
        const user = r.data?.user || r.data;
        return { user };
      }),

    updateProfile: (data: { name: string }): Promise<User> =>
      http.put<User>('/api/auth/profile', data).then(r => r.data),

    changePassword: (data: {
      current_password: string;
      new_password: string;
      confirm_new_password: string;
    }): Promise<{ message: string; token?: string }> =>
      http.put<{ message: string; token?: string }>('/api/auth/change-password', data).then(r => r.data),

    logout: (): Promise<{ message: string }> =>
      http.post<{ message: string }>('/api/auth/logout').then(r => {
        setCsrfToken(null);
        return r.data;
      }),
  },

  // Audit Logs Endpoints
  logs: {
    logEvent: (data: { action_type: string; category?: string; description: string; status?: string; metadata?: Record<string, any> }) =>
      http.post('/api/logs/event', data).then(r => r.data).catch(() => {
        // Fire-and-forget; don't break UI on background telemetry fail
      }),

    getMyLogs: (limit = 30): Promise<LogEntry[]> =>
      http.get<LogEntry[]>('/api/me/logs', { params: { limit } }).then(r => r.data),

    getAdminStats: (): Promise<DashboardStats> =>
      http.get<DashboardStats>('/api/admin/stats').then(r => r.data),

    getAdminLogs: (params: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      role?: string;
      action_type?: string;
      status?: string;
    }): Promise<PaginatedLogsResponse> =>
      http.get<PaginatedLogsResponse>('/api/admin/logs', { params }).then(r => r.data),

    getLogDetail: (logId: number): Promise<LogEntry> =>
      http.get<LogEntry>(`/api/admin/logs/${logId}`).then(r => r.data),

    getUserTimeline: (userId: number, limit = 50): Promise<LogEntry[]> =>
      http.get<LogEntry[]>(`/api/admin/users/${userId}/logs`, { params: { limit } }).then(r => r.data),

    exportUrl: (format: 'csv' | 'json', filters?: Record<string, string>) => {
      const searchParams = new URLSearchParams({ format, ...filters });
      return `${BASE_URL}/api/admin/logs/export?${searchParams.toString()}`;
    },

    downloadExport: async (format: 'csv' | 'json', filters?: Record<string, string>) => {
      const response = await http.get('/api/admin/logs/export', {
        params: { format, ...filters },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  },

  // Admin User Management Endpoints
  users: {
    list: (params?: { search?: string; role?: string; is_active?: boolean; page?: number; limit?: number }) =>
      http.get<{ items: User[]; total: number; page: number; limit: number; total_pages: number }>('/api/admin/users', { params }).then(r => r.data),

    updateStatus: (userId: number, isActive: boolean) =>
      http.patch<{ message: string; user: User }>(`/api/admin/users/${userId}/status`, null, { params: { is_active: isActive } }).then(r => r.data),

    updateRole: (userId: number, role: 'user' | 'admin') =>
      http.patch<{ message: string; user: User }>(`/api/admin/users/${userId}/role`, null, { params: { role } }).then(r => r.data),

    delete: (userId: number) =>
      http.delete<{ message: string }>(`/api/admin/users/${userId}`).then(r => r.data),
  },
};

export default api;
