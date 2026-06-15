import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BackHandler, Alert } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';

const Header = ({
    title,
    subtitle,
    showBack = false,
    onBackPress,
    rightComponent,
    leftComponent,
    variant = 'default',
    style,
    enableExitConfirm = false,
    transparent = false,
    darkBg = true,
}) => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const auth = useAuth();
    const isDark = variant === 'dark' || darkBg;

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

    const handleBack = useCallback(() => {
        if (onBackPress) {
            onBackPress();
            return;
        }

        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate(getFallbackRoute());
        }
    }, [navigation, onBackPress, getFallbackRoute]);

    const handleExitConfirm = useCallback(() => {
        Alert.alert(
            'Exit App',
            'Are you sure you want to exit?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Exit', onPress: () => BackHandler.exitApp() },
            ]
        );
        return true;
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            if (enableExitConfirm) {
                const subscription = BackHandler.addEventListener(
                    'hardwareBackPress',
                    handleExitConfirm
                );
                return () => subscription.remove();
            }
        }, [enableExitConfirm, handleExitConfirm])
    );

    const bgColor = transparent 
        ? 'transparent' 
        : isDark 
            ? colors.primaryDark 
            : colors.surface;

    return (
        <View style={[styles.wrapper, { backgroundColor: bgColor }, style]}>
            <View style={[styles.safeArea, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
                <View style={[
                    styles.container, 
                    isDark && styles.darkContainer,
                    transparent && styles.transparentContainer,
                ]}>
                    <View style={styles.leftSection}>
                        {leftComponent}
                        {showBack && (
                            <TouchableOpacity
                                onPress={handleBack}
                                style={[
                                    styles.backButton,
                                    isDark ? styles.darkBackButton : styles.lightBackButton,
                                ]}
                                activeOpacity={0.7}
                            >
                                <Icon
                                    name="arrow-left"
                                    size={22}
                                    color={isDark ? '#FFFFFF' : colors.textDark}
                                />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.titleContainer}>
                        {title && (
                            <Text
                                style={[
                                    styles.title,
                                    isDark && styles.darkTitle,
                                ]}
                                numberOfLines={1}
                            >
                                {title}
                            </Text>
                        )}
                        {subtitle && (
                            <Text
                                style={[
                                    styles.subtitle,
                                    isDark && styles.darkSubtitle,
                                ]}
                                numberOfLines={1}
                            >
                                {subtitle}
                            </Text>
                        )}
                    </View>

                    <View style={styles.rightSection}>
                        {rightComponent || <View style={styles.spacer} />}
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
    },
    safeArea: {
        width: '100%',
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        minHeight: 56,
    },
    darkContainer: {
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        borderBottomLeftRadius: borderRadius.xl,
        borderBottomRightRadius: borderRadius.xl,
    },
    transparentContainer: {
        backgroundColor: 'transparent',
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 50,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: 50,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    darkBackButton: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    lightBackButton: {
        backgroundColor: colors.divider,
    },
    spacer: {
        width: 40,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
    },
    title: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        textAlign: 'center',
    },
    darkTitle: {
        color: '#FFFFFF',
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    darkSubtitle: {
        color: 'rgba(255,255,255,0.8)',
    },
});

export default Header;
