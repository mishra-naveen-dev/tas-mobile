import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

const Input = ({
    label,
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    keyboardType = 'default',
    multiline = false,
    numberOfLines = 1,
    error,
    disabled = false,
    icon,
    style,
    inputStyle,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const getBorderColor = () => {
        if (error) return colors.danger;
        if (isFocused) return colors.primary;
        return colors.border;
    };

    const getBackgroundColor = () => {
        if (disabled) return colors.divider;
        if (isFocused) return '#F8FAFC';
        return colors.surface;
    };

    return (
        <View style={[styles.container, style]}>
            {label && (
                <Text style={styles.label}>{label}</Text>
            )}
            <View 
                style={[
                    styles.inputContainer,
                    { 
                        borderColor: getBorderColor(),
                        backgroundColor: getBackgroundColor(),
                    },
                    multiline && { height: numberOfLines * 24 + spacing.lg * 2 }
                ]}
            >
                {icon && (
                    <Icon 
                        name={icon} 
                        size={20} 
                        color={isFocused ? colors.primary : colors.textMuted} 
                        style={styles.icon}
                    />
                )}
                <TextInput
                    style={[
                        styles.input,
                        icon && styles.inputWithIcon,
                        multiline && styles.multilineInput,
                        inputStyle,
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry && !showPassword}
                    keyboardType={keyboardType}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                    editable={!disabled}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props}
                />
                {secureTextEntry && (
                    <TouchableOpacity 
                        onPress={() => setShowPassword(!showPassword)} 
                        style={styles.eyeIcon}
                    >
                        <Icon 
                            name={showPassword ? 'eye-off' : 'eye'} 
                            size={20} 
                            color={colors.textMuted} 
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textMedium,
        marginBottom: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        minHeight: 52,
    },
    icon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: typography.sizes.md,
        color: colors.textDark,
        paddingVertical: spacing.sm,
    },
    inputWithIcon: {
        paddingLeft: 0,
    },
    multilineInput: {
        textAlignVertical: 'top',
        paddingTop: spacing.md,
    },
    eyeIcon: {
        padding: spacing.xs,
        marginLeft: spacing.xs,
    },
    error: {
        fontSize: typography.sizes.sm,
        color: colors.danger,
        marginTop: spacing.xs,
    },
});

export default Input;
