import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

const Button = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    style,
    textStyle,
    ...props
}) => {
    const isDisabled = disabled || loading;

    const getBackgroundColor = () => {
        if (isDisabled) return colors.textLight;
        switch (variant) {
            case 'primary': return colors.primary;
            case 'secondary': return colors.surface;
            case 'outline': return 'transparent';
            case 'ghost': return 'transparent';
            case 'danger': return colors.danger;
            case 'success': return colors.success;
            default: return colors.primary;
        }
    };

    const getTextColor = () => {
        if (isDisabled) return colors.surface;
        switch (variant) {
            case 'primary': 
            case 'danger': 
            case 'success': return '#FFFFFF';
            case 'secondary': return colors.primary;
            case 'outline': return colors.primary;
            case 'ghost': return colors.primary;
            default: return '#FFFFFF';
        }
    };

    const getBorderStyle = () => {
        if (variant === 'outline') {
            return {
                borderWidth: 1.5,
                borderColor: isDisabled ? colors.textLight : colors.primary,
            };
        }
        return {};
    };

    const getSizeStyle = () => {
        switch (size) {
            case 'sm': return { paddingVertical: spacing.xs, paddingHorizontal: spacing.md };
            case 'md': return { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg };
            case 'lg': return { paddingVertical: spacing.md, paddingHorizontal: spacing.xl };
            default: return { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg };
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.7}
            style={[
                styles.button,
                { backgroundColor: getBackgroundColor() },
                getSizeStyle(),
                getBorderStyle(),
                variant === 'primary' && !isDisabled && shadows.sm,
                style,
            ]}
            {...props}
        >
            {loading ? (
                <ActivityIndicator size="small" color={getTextColor()} />
            ) : (
                <>
                    {icon}
                    <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
        minHeight: 48,
    },
    text: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        textAlign: 'center',
    },
});

export default Button;
