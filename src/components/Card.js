import React from 'react';
import { View, StyleSheet, ViewPropTypes } from 'react-native';
import { colors, borderRadius, shadows, spacing } from '../theme/tokens';

const Card = ({ 
    children, 
    style, 
    variant = 'elevated',
    padding = 'md',
    ...props 
}) => {
    const paddingValue = spacing[padding] || spacing.md;
    
    return (
        <View 
            style={[
                styles.base,
                variant === 'elevated' && styles.elevated,
                variant === 'outlined' && styles.outlined,
                variant === 'filled' && styles.filled,
                { padding: paddingValue },
                style
            ]}
            {...props}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    base: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    elevated: {
        ...shadows.md,
    },
    outlined: {
        borderWidth: 1,
        borderColor: colors.border,
    },
    filled: {
        backgroundColor: colors.divider,
    },
});

export default Card;
