import { useState, useCallback } from 'react';

export const useLoadingState = (initialState = false) => {
    const [isLoading, setIsLoading] = useState(initialState);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const startLoading = useCallback(() => {
        setIsLoading(true);
    }, []);

    const stopLoading = useCallback(() => {
        setIsLoading(false);
    }, []);

    const startRefresh = useCallback(() => {
        setIsRefreshing(true);
    }, []);

    const stopRefresh = useCallback(() => {
        setIsRefreshing(false);
    }, []);

    const withLoading = useCallback(async (fn) => {
        setIsLoading(true);
        try {
            const result = await fn();
            return result;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const withRefresh = useCallback(async (fn) => {
        setIsRefreshing(true);
        try {
            const result = await fn();
            return result;
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    return {
        isLoading,
        isRefreshing,
        startLoading,
        stopLoading,
        startRefresh,
        stopRefresh,
        withLoading,
        withRefresh,
    };
};

export default useLoadingState;
