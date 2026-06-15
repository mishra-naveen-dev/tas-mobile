import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

const SectionHeader = ({ title, count }) => {
    return (
        <View style={styles.container}>
            <View style={styles.leftLine} />
            <Text style={styles.title}>{title}</Text>
            <View style={styles.rightLine} />
            {count !== undefined && (
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginTop: spacing.md,
    },
    leftLine: {
        width: 4,
        height: 16,
        backgroundColor: colors.primary,
        borderRadius: 2,
        marginRight: spacing.sm,
    },
    title: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textMedium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    rightLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.divider,
        marginLeft: spacing.sm,
    },
    countBadge: {
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        marginLeft: spacing.xs,
    },
    countText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
    },
});

export default SectionHeader;
