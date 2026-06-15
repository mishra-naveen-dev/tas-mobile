import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, shadows } from '../theme/tokens';

const PrimaryButton = ({ 
    title, 
    onPress, 
    loading = false, 
    variant = 'primary', 
    style 
}) => {
    
    // Determine the baseline colors
    const isPrimary = variant === 'primary';
    const bgColor = isPrimary ? colors.primary : colors.surface;
    const txtColor = isPrimary ? '#FFF' : colors.primary;
    
    return (
        <TouchableOpacity 
            style={[
                styles.button, 
                { backgroundColor: bgColor },
                isPrimary ? shadows.medium : {},
                style
            ]}
            onPress={onPress}
            disabled={loading}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={txtColor} />
            ) : (
                <Text style={[styles.text, { color: txtColor }]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    text: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
    }
});

export default PrimaryButton;
