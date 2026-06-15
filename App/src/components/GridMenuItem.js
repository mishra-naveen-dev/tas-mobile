import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, shadows } from '../theme/tokens';

const GridMenuItem = ({ 
    title, 
    icon, 
    iconColor = colors.primary,
    onPress,
    badge,
    style 
}) => {
    return (
        <TouchableOpacity 
            style={[styles.container, shadows.xs, style]} 
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                <View style={styles.iconWrapper}>
                    <Text style={[styles.icon, { color: iconColor }]}>{icon}</Text>
                </View>
            </View>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {badge && (
                <View style={styles.badgeContainer}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 110,
        margin: spacing.xs,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    iconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 28,
    },
    title: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
        textAlign: 'center',
    },
    badgeContainer: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
    },
    badge: {
        backgroundColor: colors.danger,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.surface,
    },
});

export default GridMenuItem;
