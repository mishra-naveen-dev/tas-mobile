import { AppError, ErrorTypes, ErrorCodes, ErrorSeverity, isNetworkError, isAuthError, getErrorMessage } from './ErrorTypes';
import { logError } from '../monitoring/Logger';

class ErrorHandler {
  constructor() {
    this.errorListeners = [];
    this.errorQueue = [];
    this.maxQueueSize = 50;
  }

  addListener(callback) {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(error, context = {}) {
    const errorData = {
      error,
      context,
      timestamp: new Date().toISOString(),
    };

    // Add to queue
    this.errorQueue.push(errorData);
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }

    // Notify all listeners
    this.errorListeners.forEach(callback => {
      try {
        callback(errorData);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  handle(error, context = {}) {
    const appError = this.normalizeError(error);
    
    // Log the error
    logError(appError, context);
    
    // Notify listeners
    this.notifyListeners(appError, context);
    
    // Handle specific error types
    switch (appError.type) {
      case ErrorTypes.AUTH:
        this.handleAuthError(appError);
        break;
      case ErrorTypes.NETWORK:
      case ErrorTypes.OFFLINE:
        this.handleNetworkError(appError);
        break;
      default:
        break;
    }
    
    return appError;
  }

  normalizeError(error) {
    if (error instanceof AppError) {
      return error;
    }

    // Network errors
    if (!navigator.onLine || error.message === 'Network request failed') {
      return new AppError(
        getErrorMessage(error) || 'No internet connection',
        ErrorTypes.OFFLINE,
        ErrorCodes.NO_INTERNET,
        ErrorSeverity.HIGH
      );
    }

    // HTTP errors
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        return new AppError(
          data?.error || 'Session expired. Please login again.',
          ErrorTypes.AUTH,
          ErrorCodes.UNAUTHORIZED,
          ErrorSeverity.HIGH
        );
      }

      if (status === 403) {
        const code = data?.code || 'FORBIDDEN';
        return new AppError(
          data?.error || 'Access denied',
          ErrorTypes.AUTH,
          code,
          ErrorSeverity.HIGH
        );
      }

      if (status === 429) {
        return new AppError(
          'Too many requests. Please wait.',
          ErrorTypes.SERVER,
          ErrorCodes.RATE_LIMITED,
          ErrorSeverity.MEDIUM
        );
      }

      if (status >= 500) {
        return new AppError(
          data?.error || 'Server error. Please try again.',
          ErrorTypes.SERVER,
          ErrorCodes.SERVER_ERROR,
          ErrorSeverity.HIGH
        );
      }

      if (status === 400) {
        const errorMsg = data?.error || data?.detail || Object.values(data || {}).flat()[0] || 'Invalid request';
        return new AppError(
          Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg,
          ErrorTypes.VALIDATION,
          ErrorCodes.BAD_REQUEST,
          ErrorSeverity.MEDIUM
        );
      }

      return new AppError(
        getErrorMessage(error),
        ErrorTypes.SERVER,
        ErrorCodes.SERVER_ERROR,
        ErrorSeverity.MEDIUM
      );
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new AppError(
        'Request timed out. Please try again.',
        ErrorTypes.NETWORK,
        ErrorCodes.TIMEOUT,
        ErrorSeverity.MEDIUM
      );
    }

    // Unknown errors
    return new AppError(
      getErrorMessage(error) || 'Something went wrong',
      ErrorTypes.UNKNOWN,
      ErrorCodes.UNKNOWN,
      ErrorSeverity.MEDIUM
    );
  }

  handleAuthError(error) {
    // Emit auth error event for listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:error', { detail: error }));
    }
  }

  handleNetworkError(error) {
    // Emit network error event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('network:error', { detail: error }));
    }
  }

  getRecentErrors(count = 10) {
    return this.errorQueue.slice(-count);
  }

  clearErrorQueue() {
    this.errorQueue = [];
  }
}

export const errorHandler = new ErrorHandler();
export default errorHandler;
