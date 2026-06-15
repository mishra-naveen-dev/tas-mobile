// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://tas-backend-8emb.onrender.com',
  API_VERSION: '/api/v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/token/',
    REFRESH: '/auth/token/refresh/',
    LOGOUT: '/auth/logout/',
    CHANGE_PASSWORD: '/organization/users/change_my_password/',
  },

  // Users
  USERS: {
    LIST: '/organization/users/',
    ME: '/organization/users/me/',
    CREATE: '/organization/users/',
    UPDATE: (id) => `/organization/users/${id}/`,
    DELETE: (id) => `/organization/users/${id}/soft_delete/`,
    STATS: '/organization/users/stats/',
  },

  // Attendance/Punch
  ATTENDANCE: {
    PUNCHES: '/attendance/punches/',
    TODAY_PUNCHES: '/attendance/punches/today_punches/',
    DAILY_SUMMARY: '/attendance/punches/daily_summary/',
    CORRECTIONS: '/attendance/correction-requests/',
    MY_CORRECTIONS: '/attendance/correction-requests/my_requests/',
    PENDING_CORRECTIONS: '/attendance/correction-requests/pending/',
  },

  // Allowance
  ALLOWANCE: {
    REQUESTS: '/allowance/requests/',
    APPROVE: (id) => `/allowance/requests/${id}/approve/`,
    REJECT: (id) => `/allowance/requests/${id}/reject/`,
  },

  // Tracking
  TRACKING: {
    EMPLOYEES: '/tracking/employees/',
    ROUTES: '/tracking/routes/',
    DAILY_ROUTE: (id) => `/tracking/routes/daily/${id}/`,
    HISTORY: '/tracking/routes/history/',
  },

  // Organization
  ORG: {
    ROLES: '/organization/roles/',
    STATES: '/organization/states/',
    BRANCHES: '/organization/branches/',
    DEVICES: '/organization/devices/',
    MY_DEVICES: '/organization/devices/my_devices/',
    APPROVAL_ROUTES: '/organization/approval-routes/',
    PENDING_APPROVALS: '/organization/approval-routes/pending/',
    NOTIFICATIONS: '/organization/notifications/',
    SESSIONS: '/organization/sessions/',
    FEATURES: '/organization/features/',
  },
};

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
};

// Punch Types
export const PUNCH_TYPES = {
  PUNCH_IN: 'PUNCH_IN',
  PUNCH_OUT: 'PUNCH_OUT',
};

// Visit Types
export const VISIT_TYPES = {
  COLLECTION: 'COLLECTION',
  DISBURSEMENT: 'DISBURSEMENT',
  CLIENT: 'CLIENT',
  FIELD: 'FIELD',
  OFFICE: 'OFFICE',
  MEETING: 'MEETING',
  OTHER: 'OTHER',
};

// Payment Modes
export const PAYMENT_MODES = {
  CASH: 'CASH',
  UPI: 'UPI',
  CHEQUE: 'CHEQUE',
  ONLINE: 'ONLINE',
};

// Travel With
export const TRAVEL_WITH = {
  ALONE: 'ALONE',
  WITH_EMPLOYEE: 'WITH_EMPLOYEE',
};

// Correction Types
export const CORRECTION_TYPES = {
  ADD: 'ADD',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
};

// Status
export const STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  PAID: 'PAID',
};

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access',
  REFRESH_TOKEN: 'refresh',
  USER: 'user',
  DEVICE_ID: 'device_fingerprint',
  PUNCH_STATE: 'punch_state',
  PUNCH_START_TIME: 'punch_start_time',
  SYNC_QUEUE: 'sync_queue',
  CACHE_PREFIX: 'cache_',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Animation Durations
export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
};

// Date Formats
export const DATE_FORMAT = {
  DISPLAY: 'DD MMM YYYY',
  TIME: 'HH:mm',
  DATETIME: 'DD MMM YYYY, HH:mm',
  API: 'YYYY-MM-DD',
  API_DATETIME: 'YYYY-MM-DDTHH:mm:ss',
};
