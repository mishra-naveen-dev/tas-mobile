import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

const StatusBadge = ({ 
    status = 'online',
    icon,
    label,
    size = 'md',
    showIcon = true,
    style,
}) => {
    const getStatusConfig = () => {
        switch (status) {
            case 'online':
                return { color: colors.success, bgColor: colors.successLight, icon: icon || 'wifi' };
            case 'offline':
                return { color: colors.danger, bgColor: colors.dangerLight, icon: icon || 'wifi-off' };
            case 'warning':
                return { color: colors.warning, bgColor: colors.warningLight, icon: icon || 'alert-circle' };
            case 'info':
                return { color: colors.info, bgColor: colors.infoLight, icon: icon || 'info' };
            case 'pending':
                return { color: colors.warning, bgColor: colors.warningLight, icon: icon || 'clock' };
            case 'success':
                return { color: colors.success, bgColor: colors.successLight, icon: icon || 'check-circle' };
            case 'error':
                return { color: colors.danger, bgColor: colors.dangerLight, icon: icon || 'x-circle' };
            default:
                return { color: colors.textMuted, bgColor: colors.divider, icon: icon || 'circle' };
        }
    };

    const config = getStatusConfig();
    const isSmall = size === 'sm';

    return (
        <View style={[
            styles.container, 
            { backgroundColor: config.bgColor },
            isSmall && styles.smallContainer,
            style
        ]}>
            {showIcon && (
                <Icon 
                    name={config.icon} 
                    size={isSmall ? 12 : 14} 
                    color={config.color} 
                    style={styles.icon}
                />
            )}
            {label && (
                <Text style={[
                    styles.label, 
                    { color: config.color },
                    isSmall && styles.smallLabel
                ]}>
                    {label}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    smallContainer: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
    },
    icon: {
        marginRight: spacing.xxs,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
    },
    smallLabel: {
        fontSize: typography.sizes.xs,
    },
});

export default StatusBadge;
