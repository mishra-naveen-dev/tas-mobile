import { useState, useCallback, useRef } from 'react';
import { PAGINATION } from '../common/constants';

export const usePagination = (options = {}) => {
  const {
    initialPage = PAGINATION.DEFAULT_PAGE,
    initialLimit = PAGINATION.DEFAULT_LIMIT,
    onLoadMore,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const offsetRef = useRef((page - 1) * limit);

  const reset = useCallback(() => {
    setPage(initialPage);
    setData([]);
    setHasMore(true);
    setError(null);
    offsetRef.current = 0;
  }, [initialPage]);

  const loadData = useCallback(async (fetchFn, params = {}) => {
    try {
      setError(null);
      const currentOffset = (page - 1) * limit;
      
      const response = await fetchFn({
        ...params,
        offset: currentOffset,
        limit,
        page,
      });

      const newData = response.results || response.data || [];
      
      if (page === 1) {
        setData(newData);
      } else {
        setData(prev => [...prev, ...newData]);
      }

      const totalCount = response.count || newData.length;
      const loadedCount = page * limit;
      setHasMore(loadedCount < totalCount);

    } catch (err) {
      setError(err);
    }
  }, [page, limit]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    setPage(prev => prev + 1);
  }, [hasMore, isLoading]);

  const refresh = useCallback(async (fetchFn, params = {}) => {
    setIsRefreshing(true);
    setPage(1);
    offsetRef.current = 0;
    
    try {
      setError(null);
      const response = await fetchFn({
        ...params,
        offset: 0,
        limit,
        page: 1,
      });

      const newData = response.results || response.data || [];
      setData(newData);

      const totalCount = response.count || newData.length;
      setHasMore(limit < totalCount);

    } catch (err) {
      setError(err);
    } finally {
      setIsRefreshing(false);
    }
  }, [limit]);

  const goToPage = useCallback((newPage) => {
    setPage(newPage);
    offsetRef.current = (newPage - 1) * limit;
  }, [limit]);

  const changeLimit = useCallback((newLimit) => {
    setLimit(newLimit);
    setPage(1);
    offsetRef.current = 0;
  }, []);

  return {
    page,
    limit,
    data,
    setData,
    isLoading,
    setIsLoading,
    isRefreshing,
    hasMore,
    error,
    reset,
    loadData,
    loadMore,
    refresh,
    goToPage,
    changeLimit,
    totalLoaded: data.length,
  };
};

export default usePagination;
