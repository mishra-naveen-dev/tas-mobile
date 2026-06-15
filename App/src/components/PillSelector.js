import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, typography, spacing } from '../theme/tokens';

const PillSelector = ({ options, selectedValue, onValueChange, label }) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {options.map((option) => {
                    const isActive = selectedValue === option.value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.pill,
                                isActive ? styles.pillActive : styles.pillInactive
                            ]}
                            onPress={() => onValueChange(option.value)}
                            activeOpacity={0.8}
                        >
                            <Text
                                style={[
                                    styles.pillText,
                                    isActive ? styles.pillTextActive : styles.pillTextInactive
                                ]}
                            >
                                {option.label}
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
        marginBottom: spacing.md,
    },
    label: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.xs,
        fontWeight: typography.weights.medium,
    },
    scrollContent: {
        paddingVertical: spacing.xs,
        gap: spacing.sm,
        flexDirection: 'row',
    },
    pill: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    pillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        elevation: 2, // Android shadow
        shadowColor: colors.primary, // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    pillInactive: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    pillText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.bold,
    },
    pillTextActive: {
        color: '#FFFFFF',
    },
    pillTextInactive: {
        color: colors.textMuted,
    }
});

export default PillSelector;
