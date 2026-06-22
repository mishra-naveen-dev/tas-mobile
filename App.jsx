import React, { useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';

import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PunchProvider } from './src/context/PunchContext';
import { colors } from './src/theme/tokens';

const SplashView = () => (
    <View style={styles.splashContainer}>
        <View style={styles.splashLogo}>
            <Text style={styles.splashLogoText}>TAS</Text>
        </View>
        <Text style={styles.splashTitle}>TAS Mobile</Text>
        <Text style={styles.splashSubtitle}>Traveling Allowance System</Text>
    </View>
);

const AppContent = () => {
    const auth = useAuth();
    const navigationRef = useRef(null);

    useEffect(() => {
        if (navigationRef.current && auth.setNavigationRef) {
            auth.setNavigationRef(navigationRef.current);
        }
    }, [auth.setNavigationRef]);

    if (!auth.isInitialized) {
        return <SplashView />;
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
                <StatusBar barStyle="dark-content" backgroundColor={colors.primary} />
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    splashContainer: {
        flex: 1,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    splashLogo: {
        width: 100,
        height: 100,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    splashLogoText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 4,
    },
    splashTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    splashSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
    },
});

export default App;
