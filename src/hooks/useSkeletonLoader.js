import { useState, useCallback } from 'react';

export const useSkeletonLoader = (initialLoading = true) => {
  const [loading, setLoading] = useState(initialLoading);
  const [data, setData] = useState(null);

  const startLoading = useCallback(() => {
    setLoading(true);
  }, []);

  const stopLoading = useCallback((newData = null) => {
    setLoading(false);
    if (newData) {
      setData(newData);
    }
  }, []);

  const setLoadingState = useCallback((state, newData = null) => {
    setLoading(state);
    if (!state && newData) {
      setData(newData);
    }
  }, []);

  return {
    loading,
    data,
    setLoading,
    startLoading,
    stopLoading,
    setLoadingState,
  };
};

export default useSkeletonLoader;