import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, spacing, typography } from '../theme/tokens';

const InputField = ({ 
    icon, 
    placeholder, 
    value, 
    onChangeText, 
    secureTextEntry,
    keyboardType = 'default',
    error
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    return (
        <View style={styles.wrapper}>
            <View style={[
                styles.container,
                isFocused && styles.containerFocused,
                error && styles.containerError
            ]}>
                {icon && (
                    <Icon 
                        name={icon} 
                        size={20} 
                        color={isFocused ? colors.primary : colors.textMuted} 
                        style={styles.icon}
                    />
                )}
                
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry && !showPassword}
                    keyboardType={keyboardType}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />

                {secureTextEntry && (
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Icon 
                            name={showPassword ? 'eye-off' : 'eye'} 
                            size={20} 
                            color={colors.textMuted} 
                        />
                    </TouchableOpacity>
                )}
            </View>
            
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: spacing.md,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 56,
    },
    containerFocused: {
        borderColor: colors.primary,
        backgroundColor: '#F5F7FF', // Very subtle blue tint
    },
    containerError: {
        borderColor: colors.danger,
    },
    icon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: typography.sizes.md,
        color: colors.textDark,
        height: '100%',
    },
    eyeIcon: {
        padding: spacing.xs,
        marginLeft: spacing.sm,
    },
    errorText: {
        color: colors.danger,
        fontSize: typography.sizes.sm,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    }
});

export default InputField;
