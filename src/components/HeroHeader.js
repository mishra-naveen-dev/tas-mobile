import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing } from '../theme/tokens';
import api from '../api/api';
import SSEClient from '../services/SSEClient';

const HeroHeader = ({
    user,
    role = 'Employee',
    showStatus = true,
    status = 'online',
    onLogout,
    style
}) => {
    const navigation = useNavigation();
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshUnreadCount = useCallback(() => {
        api.getUnreadNotificationCount()
            .then(res => setUnreadCount(res?.data?.unread_count ?? 0))
            .catch(() => {});
    }, []);

    useEffect(() => {
        refreshUnreadCount();
        // Any real-time notification (customer assigned, correction reviewed,
        // etc.) bumps the badge immediately rather than waiting for the next
        // screen focus to re-poll.
        const unsubscribe = SSEClient.onNotification(() => {
            setUnreadCount(prev => prev + 1);
        });
        return unsubscribe;
    }, [refreshUnreadCount]);

    // Re-sync (rather than blindly trust the local increment) whenever this
    // header regains focus, e.g. after the user reads notifications and
    // comes back — keeps the badge honest against server state.
    useEffect(() => {
        const unsubscribeFocus = navigation.addListener?.('focus', refreshUnreadCount);
        return unsubscribeFocus;
    }, [navigation, refreshUnreadCount]);
    const getRoleBadgeColor = (userRole) => {
        const safeRole = typeof userRole === 'string' ? userRole.toUpperCase() : '';
        switch (safeRole) {
            case 'SUPER_ADMIN': return colors.danger;
            case 'ADMIN': return colors.warning;
            case 'EMPLOYEE': return colors.info;
            default: return colors.primary;
        }
    };

    const getStatusColor = (s) => {
        const safeStatus = typeof s === 'string' ? s.toLowerCase() : '';
        switch (safeStatus) {
            case 'online': return colors.success;
            case 'offline': return colors.textMuted;
            case 'active': return colors.info;
            default: return colors.textMuted;
        }
    };

    const safeUser = {
        first_name: typeof user?.first_name === 'string' ? user.first_name : '',
        last_name: typeof user?.last_name === 'string' ? user.last_name : '',
        username: typeof user?.username === 'string' ? user.username : 'User',
    };

    // Title-case a string that may be stored in ALL CAPS from the backend
    const toTitleCase = (str) =>
        str ? str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

    // Greeting: first name only (shorter, fits in one line); fallback to username
    const greetingName = safeUser.first_name
        ? toTitleCase(safeUser.first_name)
        : toTitleCase(safeUser.username) || 'User';

    // Full name shown as a smaller subtitle below the greeting
    const fullName = (safeUser.first_name || safeUser.last_name)
        ? toTitleCase(`${safeUser.first_name} ${safeUser.last_name}`.trim())
        : '';

    const userInitial = greetingName.charAt(0).toUpperCase() || 'U';

    const safeRole = typeof role === 'string' ? role : 'employee';
    const safeStatus = typeof status === 'string' ? status : 'offline';

    const roleDisplay = String(safeRole).replace(/_/g, ' ').toUpperCase();
    const statusDisplay = String(safeStatus).charAt(0).toUpperCase() + String(safeStatus).slice(1);

    return (
        <View style={[styles.container, style]}>
            <View style={styles.content}>
                <View style={styles.left}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{userInitial}</Text>
                    </View>
                    <View style={styles.info}>
                        <View style={styles.nameRow}>
                            <Text style={styles.greeting}>Hello, </Text>
                            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                                {greetingName}
                            </Text>
                        </View>
                        {!!fullName && greetingName !== fullName && (
                            <Text style={styles.fullName} numberOfLines={1} ellipsizeMode="tail">
                                {fullName}
                            </Text>
                        )}
                        <View style={styles.badges}>
                            <View style={[styles.roleBadge, { backgroundColor: `${getRoleBadgeColor(safeRole)}15` }]}>
                                <Text style={[styles.roleText, { color: getRoleBadgeColor(safeRole) }]}>
                                    {roleDisplay}
                                </Text>
                            </View>
                            {showStatus && (
                                <View style={styles.statusBadge}>
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(safeStatus) }]} />
                                    <Text style={[styles.statusText, { color: getStatusColor(safeStatus) }]}>
                                        {statusDisplay}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
                <View style={styles.right}>
                    <TouchableOpacity
                        style={styles.notificationBtn}
                        onPress={() => navigation.navigate('Notifications')}
                        accessibilityLabel="Notifications"
                    >
                        <Icon name="bell" size={18} color={colors.textMuted} />
                        {unreadCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {onLogout && (
                        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
                            <Icon name="log-out" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarText: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.primary,
    },
    info: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    greeting: {
        fontSize: typography.sizes.lg,
        color: colors.textMuted,
    },
    name: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        flexShrink: 1,
    },
    fullName: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 1,
        marginBottom: 2,
    },
    badges: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    roleBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: spacing.sm,
    },
    roleText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        textTransform: 'uppercase',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    notificationBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    notificationBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: colors.surface,
    },
    notificationBadgeText: {
        fontSize: 9,
        fontWeight: typography.weights.bold,
        color: '#fff',
    },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default HeroHeader;
