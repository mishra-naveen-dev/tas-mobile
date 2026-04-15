import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, shadows } from '../theme/tokens';

const PrimaryButton = ({ 
    title, 
    onPress, 
    loading = false, 
    disabled = false,
    variant = 'primary', 
    size = 'medium',
    style,
    textStyle
}) => {
    
    const getButtonStyles = () => {
        const sizeStyles = {
            small: {
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
            },
            medium: {
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
            },
            large: {
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.xl,
            }
        };

        return sizeStyles[size] || sizeStyles.medium;
    };

    const getColors = () => {
        switch (variant) {
            case 'primary':
                return {
                    bg: disabled ? colors.red300 : colors.primary,
                    text: colors.white,
                    border: 'transparent',
                    shadow: shadows.medium
                };
            case 'secondary':
                return {
                    bg: colors.white,
                    text: disabled ? colors.textMuted : colors.primary,
                    border: disabled ? colors.border : colors.primary,
                    shadow: {}
                };
            case 'danger':
                return {
                    bg: disabled ? colors.red300 : colors.danger,
                    text: colors.white,
                    border: 'transparent',
                    shadow: shadows.medium
                };
            case 'success':
                return {
                    bg: disabled ? colors.successLight : colors.success,
                    text: colors.white,
                    border: 'transparent',
                    shadow: shadows.medium
                };
            case 'outline':
                return {
                    bg: 'transparent',
                    text: disabled ? colors.textMuted : colors.primary,
                    border: disabled ? colors.border : colors.primary,
                    shadow: {}
                };
            case 'ghost':
                return {
                    bg: 'transparent',
                    text: disabled ? colors.textMuted : colors.primary,
                    border: 'transparent',
                    shadow: {}
                };
            default:
                return {
                    bg: disabled ? colors.red300 : colors.primary,
                    text: colors.white,
                    border: 'transparent',
                    shadow: shadows.medium
                };
        }
    };

    const buttonColors = getColors();

    return (
        <TouchableOpacity 
            style={[
                styles.button,
                getButtonStyles(),
                { 
                    backgroundColor: buttonColors.bg,
                    borderColor: buttonColors.border,
                    borderWidth: variant === 'outline' || variant === 'secondary' ? 1.5 : 0,
                },
                buttonColors.shadow,
                style
            ]}
            onPress={onPress}
            disabled={loading || disabled}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={buttonColors.text} />
            ) : (
                <Text style={[
                    styles.text, 
                    { color: buttonColors.text },
                    textStyle
                ]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    text: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
    }
});

export default PrimaryButton;
