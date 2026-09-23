// API types matching backend schemas exactly

export interface PredictRequest {
  brand: string;
  year: number;
  present_price: number;
  kms_driven: number;
  fuel_type: string;
  seller_type: string;
  transmission: string;
  owner: number;
}

export interface PredictResponse {
  predicted_price: number;
  currency: string;
  model: string;
  car_age: number;
  present_price: number;
  fuel_type: string;
  transmission: string;
}

export interface PredictionRecord {
  id: number;
  user_id: number;
  user_name: string;
  email: string;
  brand: string;
  year: number;
  present_price: number;
  kms_driven: number;
  fuel_type: string;
  seller_type: string;
  transmission: string;
  owner: number;
  predicted_price: number;
  currency: string;
  car_age: number;
  created_at: string;
}

export interface PredictionListResponse {
  items: PredictionRecord[];
  total: number;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_name: string | null;
  detail: string | null;
}

export interface ModelInfoResponse {
  model_name: string;
  target: string;
  feature_columns: string[];
  numerical_features: string[];
  categorical_features: string[];
  training_rows: number;
  testing_rows: number;
  mae: number;
  rmse: number;
  r2: number;
  training_date: string;
  current_year_used: number;
}

export interface OptionsResponse {
  fuel_types: string[];
  seller_types: string[];
  transmission_types: string[];
  owner_options: number[];
  year_min: number;
  year_max: number;
  note: string;
}

// ── Auth & User Types ─────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
}

export interface AuthResponse {
  token: string;
  token_type: string;
  user: User;
  message: string;
}

// ── Activity Log Types ────────────────────────────────────────────────────────

export type LogCategory = 'auth' | 'navigation' | 'profile' | 'admin' | 'system' | 'error';
export type LogStatus = 'success' | 'failed';

export interface LogEntry {
  id: number;
  timestamp: string;
  user_id: number | null;
  user_name: string;
  email: string;
  role: string;
  action_type: string;
  category: LogCategory;
  description: string;
  status: LogStatus;
  ip_address: string;
  user_agent: string;
  metadata?: Record<string, any> | null;
}

export interface PaginatedLogsResponse {
  items: LogEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  new_registrations_today: number;
  failed_logins_today: number;
  total_predictions: number;
  total_logs: number;
}

export interface SuspiciousActivityItem {
  id: string;
  type: 'failed_login_spike' | 'access_denied' | 'suspicious_ip';
  title: string;
  description: string;
  severity: 'warning' | 'danger';
  count: number;
  timestamp: string;
}
