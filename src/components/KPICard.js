import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, shadows } from '../theme/tokens';

const KPICard = ({ 
    title, 
    value, 
    subtitle, 
    icon, 
    iconColor = colors.primary,
    backgroundColor = colors.surface,
    trend,
    onPress 
}) => {
    return (
        <TouchableOpacity 
            style={[styles.card, { backgroundColor }, shadows.sm]} 
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                    <Icon name={icon} size={22} color={iconColor} />
                </View>
                {trend && (
                    <View style={[styles.trendBadge, { 
                        backgroundColor: trend > 0 ? colors.successLight : colors.dangerLight 
                    }]}>
                        <Icon 
                            name={trend > 0 ? 'trending-up' : 'trending-down'} 
                            size={12} 
                            color={trend > 0 ? colors.success : colors.danger} 
                        />
                        <Text style={[styles.trendText, { 
                            color: trend > 0 ? colors.success : colors.danger 
                        }]}>
                            {Math.abs(trend)}%
                        </Text>
                    </View>
                )}
            </View>
            <View style={styles.content}>
                <Text style={styles.value}>{value}</Text>
                <Text style={styles.title}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: spacing.lg,
        marginBottom: spacing.md,
        minHeight: 140,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: 20,
    },
    trendText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        marginLeft: 4,
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    value: {
        fontSize: typography.sizes.xxxl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.xxs,
    },
    title: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
        color: colors.textMedium,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xxs,
    },
});

export default KPICard;
