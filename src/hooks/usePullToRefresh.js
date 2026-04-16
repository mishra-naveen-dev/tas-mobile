import { useState, useCallback, useRef } from 'react';

export const usePullToRefresh = (onRefresh, options = {}) => {
  const {
    enabled = true,
    delay = 0,
  } = options;

  const [refreshing, setRefreshing] = useState(false);
  const timeoutRef = useRef(null);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);

    try {
      if (delay > 0) {
        await new Promise(resolve => {
          timeoutRef.current = setTimeout(resolve, delay);
        });
      }

      await onRefresh();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [refreshing, onRefresh, delay]);

  const startRefresh = useCallback(() => {
    if (!enabled) return;
    handleRefresh();
  }, [enabled, handleRefresh]);

  const stopRefresh = useCallback(() => {
    setRefreshing(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    refreshing,
    startRefresh,
    stopRefresh,
    props: enabled ? {
      refreshing,
      onRefresh: handleRefresh,
      colors: ['#007AFF'],
      tintColor: '#007AFF',
    } : {},
  };
};

export default usePullToRefresh;
