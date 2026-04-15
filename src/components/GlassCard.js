import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, shadows } from '../theme/tokens';

const GlassCard = ({ children, style }) => {
    return (
        <View style={[styles.card, shadows.soft, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        marginVertical: spacing.sm,
        // The shadow comes directly from the tokens applied inline
    }
});

export default GlassCard;
