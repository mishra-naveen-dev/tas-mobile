import { useQuery } from '@tanstack/react-query';

// Same shape as tas-frontend's core/hooks/useApiQuery.js: fetcherFn returns
// an axios response, this unwraps it to just the payload react-query
// caches (persisted to AsyncStorage via queryClient.js's persister, so it
// survives app restarts the same way the old per-screen AsyncStorage
// caches did — just centralized instead of duplicated three different ways).
export function useApiQuery(queryKey, fetcherFn, options = {}) {
    return useQuery({
        queryKey,
        queryFn: async () => {
            const res = await fetcherFn();
            return res.data;
        },
        ...options,
    });
}
