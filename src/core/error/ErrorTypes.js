// Error Types
export const ErrorTypes = {
  NETWORK: 'NETWORK',
  AUTH: 'AUTH',
  VALIDATION: 'VALIDATION',
  SERVER: 'SERVER',
  UNKNOWN: 'UNKNOWN',
  OFFLINE: 'OFFLINE',
};

// Error Severity
export const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

// Error Codes
export const ErrorCodes = {
  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  NO_INTERNET: 'NO_INTERNET',

  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  DEVICE_NOT_BINDED: 'DEVICE_NOT_BINDED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Server
  SERVER_ERROR: 'SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
};

export class AppError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, code = '', severity = ErrorSeverity.MEDIUM, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      code: this.code,
      severity: this.severity,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export const isNetworkError = (error) => {
  if (error instanceof AppError) {
    return error.type === ErrorTypes.NETWORK || error.type === ErrorTypes.OFFLINE;
  }
  return !navigator.onLine || error.message === 'Network request failed';
};

export const isAuthError = (error) => {
  if (error instanceof AppError) {
    return error.type === ErrorTypes.AUTH;
  }
  return error?.response?.status === 401 || error?.response?.status === 403;
};

export const getErrorMessage = (error) => {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};
