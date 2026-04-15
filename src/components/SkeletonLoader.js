import React, { memo, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { colors, spacing } from '../theme/tokens';

const SkeletonLoader = memo(({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style,
    children,
    isLoading = true,
}) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isLoading) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(animatedValue, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(animatedValue, {
                        toValue: 0,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
            return () => animation.stop();
        }
    }, [isLoading, animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    if (!isLoading) {
        return children;
    }

    return (
        <View style={[styles.container, style]}>
            <Animated.View
                style={[
                    styles.skeleton,
                    {
                        width,
                        height,
                        borderRadius,
                        opacity,
                    },
                ]}
            />
            {children}
        </View>
    );
});

export const SkeletonCard = memo(({ style }) => (
    <SkeletonLoader width="100%" height={100} borderRadius={16} style={style}>
        <View style={[styles.cardSkeleton, style]}>
            <SkeletonLoader width={50} height={50} borderRadius={12} />
            <View style={styles.cardContent}>
                <SkeletonLoader width="60%" height={16} borderRadius={4} />
                <SkeletonLoader width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
        </View>
    </SkeletonLoader>
));

export const SkeletonText = memo(({ lines = 3, style }) => (
    <View style={[styles.textContainer, style]}>
        {Array.from({ length: lines }).map((_, index) => (
            <SkeletonLoader
                key={index}
                width={index === lines - 1 ? '60%' : '100%'}
                height={14}
                borderRadius={4}
                style={{ marginBottom: 8 }}
            />
        ))}
    </View>
));

export const SkeletonAvatar = memo(({ size = 48, style }) => (
    <SkeletonLoader
        width={size}
        height={size}
        borderRadius={size / 2}
        style={style}
    />
));

export const SkeletonListItem = memo(({ style }) => (
    <View style={[styles.listItem, style]}>
        <SkeletonAvatar size={44} />
        <View style={styles.listItemContent}>
            <SkeletonLoader width="50%" height={16} borderRadius={4} />
            <SkeletonLoader width="30%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
        <View style={styles.listItemRight}>
            <SkeletonLoader width={50} height={24} borderRadius={8} />
        </View>
    </View>
));

export const SkeletonStatCard = memo(({ style }) => (
    <SkeletonLoader width="48%" height={100} borderRadius={16} style={style}>
        <View style={[styles.statCardSkeleton, style]}>
            <SkeletonLoader width={32} height={32} borderRadius={8} />
            <SkeletonLoader width="60%" height={24} borderRadius={4} style={{ marginTop: 12 }} />
            <SkeletonLoader width="80%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
    </SkeletonLoader>
));

export const SkeletonHeader = memo(({ style }) => (
    <View style={[styles.headerSkeleton, style]}>
        <View style={styles.headerContent}>
            <SkeletonLoader width={120} height={24} borderRadius={4} />
            <SkeletonLoader width={80} height={14} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
        <SkeletonLoader width={44} height={44} borderRadius={12} />
    </View>
));

export const SkeletonMenuItem = memo(({ style }) => (
    <SkeletonLoader height={72} borderRadius={16} style={style}>
        <View style={[styles.menuItemSkeleton, style]}>
            <SkeletonLoader width={48} height={48} borderRadius={14} />
            <View style={styles.menuItemContent}>
                <SkeletonLoader width="40%" height={16} borderRadius={4} />
                <SkeletonLoader width="60%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
            <SkeletonLoader width={20} height={20} borderRadius={10} />
        </View>
    </SkeletonLoader>
));

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    skeleton: {
        backgroundColor: colors.border,
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    cardSkeleton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    cardContent: {
        flex: 1,
        marginLeft: spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    listItemContent: {
        flex: 1,
        marginLeft: spacing.md,
    },
    listItemRight: {
        marginLeft: spacing.sm,
    },
    statCardSkeleton: {
        padding: spacing.md,
        alignItems: 'center',
    },
    headerSkeleton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
    },
    headerContent: {
        flex: 1,
    },
    menuItemSkeleton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    menuItemContent: {
        flex: 1,
        marginLeft: spacing.md,
    },
});

export default SkeletonLoader;
