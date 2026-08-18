import { QueryClient, onlineManager, focusManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

// Same rationale as tas-frontend's queryClient.js: staleTime serves cached
// data instantly, retry stays low since the axios layer doesn't retry on
// its own here (unlike tas-frontend's RetryHandler) — react-query's own
// retry covers it.
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            retry: 1,
        },
    },
});

export const asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'TAS_MOBILE_QUERY_CACHE',
});

// React Query has no idea about RN's app-foreground/network events unless
// told — without this, "phone reconnects to wifi" or "app resumes from
// background" would never trigger a background revalidation, unlike the
// browser default tas-frontend gets for free (window focus/online events).
export function wireReactQueryToAppEvents() {
    onlineManager.setEventListener((setOnline) => {
        return NetInfo.addEventListener((state) => {
            setOnline(!!state.isConnected);
        });
    });

    focusManager.setEventListener((setFocused) => {
        const subscription = AppState.addEventListener('change', (status) => {
            setFocused(status === 'active');
        });
        return () => subscription.remove();
    });
}
