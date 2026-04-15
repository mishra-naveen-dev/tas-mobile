import React, { Suspense, lazy, useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { colors, typography, spacing } from '../theme/tokens';
import SkeletonLoader from './SkeletonLoader';

export const LoadingFallback = memo(({ height = '100%' }) => (
    <View style={[styles.fallback, { height }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.fallbackText}>Loading...</Text>
    </View>
));

export const ErrorFallback = memo(({ message, onRetry }) => (
    <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
        <Text style={styles.errorMessage}>{message || 'Unable to load content'}</Text>
        {onRetry && (
            <Text style={styles.retryButton} onPress={onRetry}>
                Tap to retry
            </Text>
        )}
    </View>
));

export const LazyLoadScreen = memo(({ 
    children, 
    isLoading, 
    skeleton = 'default',
    height = '100%' 
}) => {
    if (isLoading) {
        return <LoadingFallback height={height} />;
    }

    return children;
});

export const withLazyLoading = (Component, skeletonType = 'default') => {
    return React.forwardRef(({ isLoading, ...props }, ref) => {
        if (isLoading) {
            return <LoadingFallback />;
        }
        return <Component ref={ref} {...props} />;
    });
};

export const SkeletonScreen = memo(({ type = 'default' }) => {
    const defaultSkeleton = (
        <View style={styles.defaultSkeleton}>
            <SkeletonLoader width="100%" height={200} borderRadius={0} />
            <View style={styles.defaultSkeletonContent}>
                <SkeletonLoader width="60%" height={24} borderRadius={6} />
                <SkeletonLoader width="80%" height={16} borderRadius={4} style={{ marginTop: 12 }} />
                <SkeletonLoader width="90%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
                <SkeletonLoader width="40%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
        </View>
    );

    const cardSkeleton = (
        <View style={styles.cardSkeletonList}>
            {[1, 2, 3, 4].map((item) => (
                <SkeletonLoader key={item} height={100} borderRadius={16} style={styles.cardSkeletonItem} />
            ))}
        </View>
    );

    const listSkeleton = (
        <View style={styles.listSkeletonList}>
            {[1, 2, 3, 4, 5].map((item) => (
                <SkeletonLoader key={item} height={72} borderRadius={14} style={styles.listSkeletonItem} />
            ))}
        </View>
    );

    const profileSkeleton = (
        <View style={styles.profileSkeleton}>
            <View style={styles.profileHeader}>
                <SkeletonLoader width={100} height={100} borderRadius={50} />
                <SkeletonLoader width={160} height={20} borderRadius={6} style={{ marginTop: 16 }} />
                <SkeletonLoader width={120} height={14} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
            <SkeletonLoader width="90%" height={120} borderRadius={16} style={{ marginHorizontal: 16 }} />
        </View>
    );

    const dashboardSkeleton = (
        <View style={styles.dashboardSkeleton}>
            <SkeletonLoader width="100%" height={160} borderRadius={0} />
            <View style={styles.statsRow}>
                <SkeletonLoader width="31%" height={100} borderRadius={16} />
                <SkeletonLoader width="31%" height={100} borderRadius={16} />
                <SkeletonLoader width="31%" height={100} borderRadius={16} />
            </View>
        </View>
    );

    const skeletons = {
        default: defaultSkeleton,
        card: cardSkeleton,
        list: listSkeleton,
        profile: profileSkeleton,
        dashboard: dashboardSkeleton,
    };

    return skeletons[type] || defaultSkeleton;
});

const styles = StyleSheet.create({
    fallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    fallbackText: {
        marginTop: spacing.md,
        color: colors.textMuted,
        fontSize: typography.sizes.sm,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.background,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    errorTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    retryButton: {
        fontSize: typography.sizes.md,
        color: colors.primary,
        fontWeight: typography.weights.semibold,
        padding: spacing.md,
    },
    defaultSkeleton: {
        flex: 1,
        backgroundColor: colors.background,
    },
    defaultSkeletonContent: {
        padding: spacing.lg,
    },
    cardSkeletonList: {
        padding: spacing.md,
    },
    cardSkeletonItem: {
        marginBottom: spacing.md,
    },
    listSkeletonList: {
        padding: spacing.md,
    },
    listSkeletonItem: {
        marginBottom: spacing.sm,
    },
    profileSkeleton: {
        flex: 1,
        backgroundColor: colors.background,
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        backgroundColor: colors.primary,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    dashboardSkeleton: {
        flex: 1,
        backgroundColor: colors.background,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        marginTop: -spacing.lg,
    },
});

export default SkeletonLoader;
