import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../theme/tokens';

const HeroHeader = ({
    user,
    role = 'Employee',
    showStatus = true,
    status = 'online',
    onLogout,
    style
}) => {
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

    const userName = safeUser.first_name && safeUser.last_name
        ? `${safeUser.first_name} ${safeUser.last_name}`
        : safeUser.username || 'User';

    const userInitial = typeof userName === 'string' && userName.length > 0 ? userName.charAt(0).toUpperCase() : 'U';

    const safeRole = typeof role === 'string' ? role : 'employee';
    const safeStatus = typeof status === 'string' ? status : 'offline';

    const roleDisplay = String(safeRole).replace(/_/g, ' ').toUpperCase();
    const statusDisplay = String(safeStatus).charAt(0).toUpperCase() + String(safeStatus).slice(1);

    const getStatusIcon = () => {
        const s = typeof status === 'string' ? status.toLowerCase() : 'offline';
        if (s === 'online') return 'wifi';
        if (s === 'active') return 'activity';
        return 'wifi-off';
    };

    return (
        <View style={[styles.container, style]}>
            <View style={styles.content}>
                <View style={styles.left}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{userInitial}</Text>
                    </View>
                    <View style={styles.info}>
                        <View style={styles.nameRow}>
                            <Text style={styles.greeting}>Hello,</Text>
                            <Text style={styles.name}> {userName}</Text>
                        </View>
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
                    {showStatus && (
                        <View style={[styles.statusIndicator, { backgroundColor: `${getStatusColor(safeStatus)}15` }]}>
                            <Icon name={getStatusIcon()} size={18} color={getStatusColor(safeStatus)} />
                        </View>
                    )}
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
        backgroundColor: colors.primaryLight,
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
    statusIndicator: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
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
