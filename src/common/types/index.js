// User Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  employee_id?: string;
  phone?: string;
  department?: string;
  designation?: string;
  is_active: boolean;
  date_joined: string;
  last_login?: string;
}

// Auth Types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
  device?: Device;
}

export interface TokenPayload {
  user_id: number;
  exp: number;
  iat: number;
}

// Punch Types
export interface Punch {
  id: number;
  user: number;
  punch_type: 'PUNCH_IN' | 'PUNCH_OUT';
  punch_time: string;
  latitude?: number;
  longitude?: number;
  current_address?: string;
  visit_type?: string;
  reason?: string;
  loan_id?: string;
  amount?: number;
  payment_mode?: string;
  travel_with?: string;
  co_employee_id?: string;
  co_employee_name?: string;
  distance_from_last?: number;
  created_at: string;
}

export interface DailySummary {
  date: string;
  punch_count: number;
  total_distance: number;
  duration: string;
  total_collection: number;
  total_disbursement: number;
  first_punch?: string;
  last_punch?: string;
}

// Allowance Types
export interface AllowanceRequest {
  id: number;
  user: number;
  travel_date: string;
  from_location: string;
  to_location: string;
  total_distance: number;
  total_amount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  remarks?: string;
  bill_url?: string;
  created_at: string;
  updated_at: string;
}

// Correction Types
export interface CorrectionRequest {
  id: number;
  user: number;
  correction_type: 'ADD' | 'EDIT' | 'DELETE';
  correction_date: string;
  correction_time: string;
  punch_type: 'PUNCH_IN' | 'PUNCH_OUT';
  visit_type?: string;
  from_address?: string;
  pincode?: string;
  loan_id?: string;
  amount?: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_comment?: string;
  created_at: string;
}

// Notification Types
export interface Notification {
  id: number;
  user: number;
  type: 'APPROVAL' | 'TRACKING' | 'SYSTEM' | 'INFO';
  title: string;
  message: string;
  is_read: boolean;
  data?: Record<string, any>;
  created_at: string;
}

// Device Types
export interface Device {
  id: number;
  user: number;
  device_id: string;
  device_name: string;
  platform: string;
  is_active: boolean;
  is_primary: boolean;
  last_active?: string;
  created_at: string;
}

// Tracking Types
export interface TrackingPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}

export interface TrackingSession {
  id: number;
  user: number;
  start_time: string;
  end_time?: string;
  total_distance: number;
  points: TrackingPoint[];
}

export interface DailyRoute {
  date: string;
  total_sessions: number;
  total_points: number;
  total_distance: number;
  sessions: TrackingSession[];
  route: TrackingPoint[];
}

// Organization Types
export interface Role {
  id: number;
  name: string;
  permissions: string[];
}

export interface Branch {
  id: number;
  name: string;
  state: string;
  address?: string;
}

export interface State {
  id: number;
  name: string;
  code: string;
}

// Error Types
export interface ApiError {
  code?: string;
  error?: string;
  detail?: string;
  [key: string]: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Pagination Types
export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

// Filter Types
export interface FilterParams {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  role?: string;
}

// Sync Types
export interface SyncQueueItem {
  id: string;
  action: {
    type: string;
    payload: any;
  };
  timestamp: string;
  retries: number;
  status: 'pending' | 'processing' | 'failed';
}

// Offline Types
export interface CachedData<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  OtpVerification: { phone: string };
  EmployeeStack: undefined;
  AdminStack: undefined;
  SuperAdminStack: undefined;
};

export type EmployeeStackParamList = {
  EmployeeTabs: undefined;
  Punch: undefined;
  PunchCorrection: undefined;
  PunchHistory: undefined;
  AllowanceHistory: undefined;
  ApplyAllowance: undefined;
  DailySummary: undefined;
  RouteMap: undefined;
  ChangePassword: undefined;
  Settings: undefined;
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  AdminEmployees: undefined;
  AdminApprovals: undefined;
  AdminDevices: undefined;
  AdminReports: undefined;
};

export type SuperAdminStackParamList = {
  SuperAdminTabs: undefined;
  UserManagement: undefined;
  ApprovalRoutes: undefined;
  OrgSettings: undefined;
  HealthMonitor: undefined;
};
