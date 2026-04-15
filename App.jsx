// App.js

import React, { useContext, useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import OfflineService from './src/services/OfflineService';
import { colors } from './src/theme/tokens';

const NetworkBanner = ({ isOffline }) => {
    if (!isOffline) return null;
    
    return (
        <View style={{
            position: 'absolute',
            top: 50,
            left: 0,
            right: 0,
            backgroundColor: '#F94144',
            padding: 8,
            zIndex: 9999,
            alignItems: 'center'
        }}>
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>
                No Internet Connection - Showing Cached Data
            </Text>
        </View>
    );
};

const AppContent = () => {
    const { loading } = useContext(AuthContext);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        let unsubscribeNetInfo = null;
        let cleanupOffline = null;

        // Initialize offline service and network listener
        const initServices = async () => {
            try {
                // Initialize offline service (returns cleanup function)
                cleanupOffline = await OfflineService.init();
            } catch (error) {
                console.log('OfflineService init error:', error);
            }

            // Prune expired cache on app start
            OfflineService.pruneExpired().catch(err => {
                console.log('Prune error:', err);
            });

            // Listen for connection changes
            unsubscribeNetInfo = NetInfo.addEventListener(state => {
                const offline = !state.isConnected || state.isInternetReachable === false;
                setIsOffline(offline);
            });
        };

        initServices();

        return () => {
            if (unsubscribeNetInfo) {
                unsubscribeNetInfo();
            }
            if (cleanupOffline && typeof cleanupOffline === 'function') {
                cleanupOffline();
            }
        };
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <>
            <NetworkBanner isOffline={isOffline} />
            <AppNavigator />
        </>
    );
};

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StatusBar barStyle="dark-content" />
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
