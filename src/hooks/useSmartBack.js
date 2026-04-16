import { useCallback } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useAuth } from '../context/AuthContext';

const useSmartBack = (navigation) => {
    const auth = useAuth();

    const getFallbackRoute = useCallback(() => {
        if (!auth?.isAuthenticated) {
            return 'Login';
        }

        if (auth.isSuperAdmin) {
            return 'SuperAdminDashboard';
        }

        if (auth.isAdmin) {
            return 'AdminDashboard';
        }

        return 'DashboardMain';
    }, [auth?.isAuthenticated, auth?.isSuperAdmin, auth?.isAdmin]);

    const navigateBack = useCallback(() => {
        if (navigation?.canGoBack?.()) {
            navigation.goBack();
            return true;
        }

        const fallbackRoute = getFallbackRoute();
        navigation?.navigate(fallbackRoute);
        return true;
    }, [navigation, getFallbackRoute]);

    const handleBackWithExitConfirm = useCallback((exitMessage = 'Press back again to exit') => {
        if (navigation?.canGoBack?.()) {
            navigation.goBack();
            return true;
        }

        Alert.alert(
            'Exit App',
            exitMessage,
            [
                {
                    text: 'Cancel',
                    onPress: () => null,
                    style: 'cancel',
                },
                {
                    text: 'Exit',
                    onPress: () => BackHandler.exitApp(),
                },
            ],
            { cancelable: true }
        );

        return true;
    }, [navigation]);

    const exitApp = useCallback(() => {
        Alert.alert(
            'Exit App',
            'Are you sure you want to exit?',
            [
                {
                    text: 'Cancel',
                    onPress: () => null,
                    style: 'cancel',
                },
                {
                    text: 'Exit',
                    onPress: () => BackHandler.exitApp(),
                },
            ]
        );
        return true;
    }, []);

    return {
        navigateBack,
        getFallbackRoute,
        handleBackWithExitConfirm,
        exitApp,
        canGoBack: navigation?.canGoBack?.() || false,
    };
};

export default useSmartBack;
