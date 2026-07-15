import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';

import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PunchProvider } from './src/context/PunchContext';
import { NotificationProvider, useNotification, NotificationDuration } from './src/common/components/NotificationProvider';
import SSEClient from './src/services/SSEClient';
import { colors } from './src/theme/tokens';
import SplashScreen from './src/components/SplashScreen';

const AppContent = () => {
    const auth = useAuth();
    const notify = useNotification();
    const navigationRef = useRef(null);
    const [splashDone, setSplashDone] = useState(false);

    useEffect(() => {
        if (navigationRef.current && auth.setNavigationRef) {
            auth.setNavigationRef(navigationRef.current);
        }
    }, [auth.setNavigationRef]);

    // Real-time "customer assigned to you" toast — tap to jump straight to
    // that customer in Collections. Falls back gracefully: if the socket
    // isn't connected when this fires, the user still sees it next time
    // they open the Notifications list (server-persisted separately).
    useEffect(() => {
        const unsubscribe = SSEClient.onNotification((msg) => {
            if (msg?.notification_type !== 'CUSTOMER_ASSIGNED') return;
            notify.info(msg.message || 'You have been assigned a new customer', {
                duration: NotificationDuration.LONG,
                onPress: () => {
                    if (!navigationRef.current) return;
                    if (msg.collection_id) {
                        navigationRef.current.navigate('MainTabs', {
                            screen: 'Collections',
                            params: { collectionId: msg.collection_id },
                        });
                    } else {
                        navigationRef.current.navigate('MainTabs', { screen: 'Collections' });
                    }
                },
            });
        });
        return unsubscribe;
    }, [notify]);

    // Show splash until BOTH the animation finishes AND auth has initialized.
    // Auth check runs in parallel — the longer of the two wins.
    if (!splashDone || !auth.isInitialized) {
        return (
            <SplashScreen
                onComplete={() => setSplashDone(true)}
            />
        );
    }

    // PunchProvider must only mount when authenticated — its useEffect fires
    // fetchTodayPunches immediately on mount, which would trigger a 401 on
    // a fresh install (no token) and incorrectly show "Session Expired".
    return (
        <NavigationContainer ref={navigationRef}>
            {auth.isAuthenticated ? (
                <PunchProvider>
                    <RootNavigator />
                </PunchProvider>
            ) : (
                <RootNavigator />
            )}
        </NavigationContainer>
    );
};

const App = () => {
    return (
        <GestureHandlerRootView style={styles.container}>
            <SafeAreaProvider>
                <StatusBar barStyle="light-content" backgroundColor="#C62828" />
                <AuthProvider>
                    <NotificationProvider>
                        <AppContent />
                    </NotificationProvider>
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default App;
