import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

const SkeletonBase = ({ width, height, borderRadius = 8, style }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    easing: Easing.linear,
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
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: '#E5E7EB',
                    opacity,
                },
                style,
            ]}
        />
    );
};

export const SkeletonText = ({ width = '100%', height = 16, style }) => (
    <SkeletonBase width={width} height={height} borderRadius={4} style={style} />
);

export const SkeletonCard = ({ style }) => (
    <View style={[styles.card, style]}>
        <View style={styles.cardHeader}>
            <SkeletonBase width={120} height={20} borderRadius={4} />
        </View>
        <View style={styles.cardBody}>
            <View style={styles.cardRow}>
                <SkeletonBase width={60} height={48} borderRadius={14} />
                <View style={styles.cardTextGroup}>
                    <SkeletonText width="60%" />
                    <SkeletonText width="40%" height={12} style={{ marginTop: 6 }} />
                </View>
            </View>
            <View style={styles.cardRow}>
                <SkeletonBase width={60} height={48} borderRadius={14} />
                <View style={styles.cardTextGroup}>
                    <SkeletonText width="70%" />
                    <SkeletonText width="50%" height={12} style={{ marginTop: 6 }} />
                </View>
            </View>
        </View>
    </View>
);

export const SkeletonAvatar = ({ size = 48, style }) => (
    <SkeletonBase width={size} height={size} borderRadius={size / 2} style={style} />
);

export const SkeletonListItem = ({ style }) => (
    <View style={[styles.listItem, style]}>
        <SkeletonBase width={44} height={44} borderRadius={12} />
        <View style={styles.listItemContent}>
            <SkeletonText width="60%" />
            <SkeletonText width="40%" height={12} style={{ marginTop: 4 }} />
        </View>
    </View>
);

export const SkeletonStatsGrid = ({ style }) => (
    <View style={[styles.statsCard, style]}>
        <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <SkeletonBase width={48} height={48} borderRadius={14} />
                <SkeletonText width={60} height={20} style={{ marginTop: 8 }} />
                <SkeletonText width={50} height={12} style={{ marginTop: 4 }} />
            </View>
            <View style={[styles.statItem, styles.statDivider]}>
                <SkeletonBase width={48} height={48} borderRadius={14} />
                <SkeletonText width={60} height={20} style={{ marginTop: 8 }} />
                <SkeletonText width={50} height={12} style={{ marginTop: 4 }} />
            </View>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <SkeletonBase width={48} height={48} borderRadius={14} />
                <SkeletonText width={60} height={20} style={{ marginTop: 8 }} />
                <SkeletonText width={50} height={12} style={{ marginTop: 4 }} />
            </View>
            <View style={[styles.statItem, styles.statDivider]}>
                <SkeletonBase width={48} height={48} borderRadius={14} />
                <SkeletonText width={60} height={20} style={{ marginTop: 8 }} />
                <SkeletonText width={50} height={12} style={{ marginTop: 4 }} />
            </View>
        </View>
    </View>
);

export const SkeletonMapPreview = ({ style }) => (
    <View style={[styles.mapPreview, style]}>
        <SkeletonBase width="100%" height="100%" borderRadius={16} />
    </View>
);

export const SkeletonForm = ({ style }) => (
    <View style={[styles.form, style]}>
        <SkeletonText width="40%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBase width="100%" height={56} borderRadius={12} style={{ marginBottom: 16 }} />
        <SkeletonText width="40%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBase width="100%" height={56} borderRadius={12} style={{ marginBottom: 16 }} />
        <SkeletonText width="40%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBase width="100%" height={56} borderRadius={12} style={{ marginBottom: 16 }} />
        <SkeletonBase width="100%" height={48} borderRadius={12} style={{ marginTop: 8 }} />
    </View>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    cardHeader: {
        marginBottom: 16,
    },
    cardBody: {},
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTextGroup: {
        flex: 1,
        marginLeft: 12,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
    },
    listItemContent: {
        flex: 1,
        marginLeft: 12,
    },
    statsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statsDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 16,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        borderLeftWidth: 1,
        borderLeftColor: '#F3F4F6',
    },
    mapPreview: {
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
    },
    form: {
        padding: 16,
    },
});

export default SkeletonBase;
