import React, { memo, useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, spacing, typography } from '../theme/tokens';

const InputField = memo(({ 
    icon, 
    placeholder, 
    value, 
    onChangeText, 
    secureTextEntry,
    keyboardType = 'default',
    autoCapitalize = 'none',
    autoCorrect = false,
    error,
    showPasswordToggle = false,
    onSubmitEditing,
    returnKeyType,
    multiline = false,
    numberOfLines = 1
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const inputRef = useRef(null);

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    const togglePasswordVisibility = () => {
        setIsPasswordVisible(!isPasswordVisible);
    };

    return (
        <View style={styles.wrapper}>
            <View style={[
                styles.container,
                isFocused && styles.containerFocused,
                error && styles.containerError,
                multiline && styles.containerMultiline
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
                    ref={inputRef}
                    style={[styles.input, multiline && styles.inputMultiline]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry && !isPasswordVisible}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    autoCorrect={autoCorrect}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onSubmitEditing={onSubmitEditing}
                    returnKeyType={returnKeyType}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                    blurOnSubmit={!multiline}
                    editable={true}
                    caretHidden={false}
                />
                
                {showPasswordToggle && secureTextEntry && (
                    <TouchableOpacity 
                        onPress={togglePasswordVisibility}
                        style={styles.eyeButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Icon 
                            name={isPasswordVisible ? 'eye' : 'eye-off'} 
                            size={20} 
                            color={colors.textMuted} 
                        />
                    </TouchableOpacity>
                )}
            </View>
            
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
});

InputField.displayName = 'InputField';

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
        minHeight: 56,
    },
    containerFocused: {
        borderColor: colors.primary,
        backgroundColor: '#F5F7FF',
    },
    containerError: {
        borderColor: colors.danger,
    },
    containerMultiline: {
        minHeight: 100,
        alignItems: 'flex-start',
        paddingVertical: spacing.sm,
    },
    icon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: typography.sizes.md,
        color: colors.textDark,
        paddingVertical: 0,
        height: 56,
    },
    inputMultiline: {
        height: 'auto',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    eyeButton: {
        padding: spacing.xs,
    },
    errorText: {
        color: colors.danger,
        fontSize: typography.sizes.sm,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    }
});

export default InputField;
