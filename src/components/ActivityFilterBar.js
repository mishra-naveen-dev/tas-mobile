import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

const FILTER_OPTIONS = [
    { key: 'ALL', label: 'All' },
    { key: 'PUNCH', label: 'Punch' },
    { key: 'VISIT', label: 'Visit' },
    { key: 'COLLECTION', label: 'Collection' },
    { key: 'DISBURSEMENT', label: 'Disbursement' },
    { key: 'TRAVEL', label: 'Travel' },
];

const ActivityFilterBar = ({ selectedFilter, onFilterChange }) => {
    return (
        <View style={styles.container}>
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {FILTER_OPTIONS.map((filter) => {
                    const isActive = selectedFilter === filter.key;
                    return (
                        <TouchableOpacity
                            key={filter.key}
                            style={[
                                styles.pill,
                                isActive && styles.pillActive,
                            ]}
                            onPress={() => onFilterChange(filter.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.pillText,
                                isActive && styles.pillTextActive,
                            ]}>
                                {filter.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: spacing.xs,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
    },
    pill: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        marginRight: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
    },
    pillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    pillText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textMedium,
    },
    pillTextActive: {
        color: '#FFFFFF',
    },
});

export default ActivityFilterBar;
