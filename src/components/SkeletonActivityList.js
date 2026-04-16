import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/tokens';

const SkeletonActivityCard = () => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        shimmer.start();
        return () => shimmer.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={styles.card}>
            <Animated.View style={[styles.icon, { opacity }]} />
            <View style={styles.content}>
                <Animated.View style={[styles.title, { opacity }]} />
                <Animated.View style={[styles.subtitle, { opacity }]} />
            </View>
            <Animated.View style={[styles.time, { opacity }]} />
        </View>
    );
};

const SkeletonActivityList = () => {
    return (
        <View style={styles.container}>
            {[1, 2, 3, 4, 5].map(i => (
                <SkeletonActivityCard key={i} />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: spacing.sm,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
        borderRadius: borderRadius.md,
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.divider,
    },
    content: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    title: {
        width: '60%',
        height: 14,
        borderRadius: 4,
        backgroundColor: colors.divider,
        marginBottom: 6,
    },
    subtitle: {
        width: '80%',
        height: 12,
        borderRadius: 4,
        backgroundColor: colors.divider,
    },
    time: {
        width: 50,
        height: 12,
        borderRadius: 4,
        backgroundColor: colors.divider,
    },
});

export default SkeletonActivityList;
