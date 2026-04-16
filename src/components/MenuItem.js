import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, shadows } from '../theme/tokens';

const MenuItem = ({ 
    title, 
    subtitle,
    icon, 
    iconColor = colors.primary,
    onPress,
    showArrow = true,
    badge,
    badgeColor = colors.danger,
    style 
}) => {
    return (
        <TouchableOpacity 
            style={[styles.container, shadows.xs, style]} 
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                <Icon name={icon} size={22} color={iconColor} />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {badge && (
                <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                    <Text style={styles.badgeText}>{badge}</Text>
                </View>
            )}
            {showArrow && (
                <Icon name="chevron-right" size={22} color={colors.textMuted} />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: 16,
        marginBottom: spacing.sm,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: 20,
        marginRight: spacing.sm,
    },
    badgeText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.surface,
    },
});

export default MenuItem;
