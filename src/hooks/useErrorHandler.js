import { useCallback, useMemo } from 'react';
import { errorHandler } from '../core/error/ErrorHandler';

export const useErrorHandler = () => {
  const handleError = useCallback((error, context = {}) => {
    return errorHandler.handle(error, context);
  }, []);

  const showError = useCallback((message, options = {}) => {
    const { type = 'error', duration = 5000 } = options;
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:notification', {
        detail: { message, type, duration },
      }));
    }
  }, []);

  const subscribe = useCallback((callback) => {
    return errorHandler.addListener(callback);
  }, []);

  const getRecentErrors = useCallback((count = 10) => {
    return errorHandler.getRecentErrors(count);
  }, []);

  const clearErrors = useCallback(() => {
    errorHandler.clearErrorQueue();
  }, []);

  return useMemo(() => ({
    handleError,
    showError,
    subscribe,
    getRecentErrors,
    clearErrors,
  }), [handleError, showError, subscribe, getRecentErrors, clearErrors]);
};

export default useErrorHandler;
