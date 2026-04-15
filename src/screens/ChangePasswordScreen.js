import React, { useState, useContext, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { changePassword } from '../api/authApi';
import { AuthContext } from '../context/AuthContext';
import { colors, typography, spacing } from '../theme/tokens';

const PasswordInput = ({ label, value, onChangeText, placeholder, error, field, showToggle, isVisible, onToggle }) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{label}</Text>
            <View style={[styles.inputWrapper, isFocused && styles.inputFocused, error && styles.inputErrorBorder]}>
                <Icon name="lock" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                    style={styles.textInput}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={showToggle && !isVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                {showToggle && (
                    <TouchableOpacity onPress={onToggle} style={styles.eyeButton}>
                        <Icon 
                            name={isVisible ? 'eye-off' : 'eye'} 
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

const ChangePasswordScreen = ({ navigation }) => {
    const { token, logout } = useContext(AuthContext);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [errors, setErrors] = useState({});

    const validatePassword = useCallback((password) => {
        if (!password) return 'Password is required';
        if (password.length < 8) return 'Minimum 8 characters required';
        if (!/[A-Z]/.test(password)) return 'Need 1 uppercase letter';
        if (!/[a-z]/.test(password)) return 'Need 1 lowercase letter';
        if (!/[0-9]/.test(password)) return 'Need 1 number';
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Need 1 special character';
        return null;
    }, []);

    const passwordStrength = useMemo(() => {
        if (!newPassword) return { level: 0, label: '', color: '' };
        
        let strength = 0;
        if (newPassword.length >= 8) strength++;
        if (newPassword.length >= 12) strength++;
        if (/[A-Z]/.test(newPassword)) strength++;
        if (/[a-z]/.test(newPassword)) strength++;
        if (/[0-9]/.test(newPassword)) strength++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) strength++;

        if (strength <= 2) return { level: 1, label: 'Weak', color: '#F94144' };
        if (strength <= 4) return { level: 2, label: 'Medium', color: '#F8961E' };
        return { level: 3, label: 'Strong', color: '#4CC9F0' };
    }, [newPassword]);

    const handleGoBack = useCallback(() => {
        const state = navigation.getState();
        if (state && state.routes.length <= 1) {
            logout();
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        } else {
            navigation.goBack();
        }
    }, [navigation, logout]);

    const handleChange = useCallback(async () => {
        const newErrors = {};

        if (!currentPassword) {
            newErrors.currentPassword = 'Current password is required';
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            newErrors.newPassword = passwordError;
        }

        if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (newPassword === currentPassword) {
            newErrors.newPassword = 'New password cannot be same as current';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        setLoading(true);

        try {
            await changePassword(newPassword, token, currentPassword);
            
            Alert.alert(
                'Success',
                'Your password has been changed successfully.',
                [{
                    text: 'OK',
                    onPress: () => {
                        logout();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }]
            );
        } catch (err) {
            const errorMsg = err?.response?.data?.error || 
                            err?.response?.data?.detail || 
                            'Failed to change password.';
            Alert.alert('Error', errorMsg);
        } finally {
            setLoading(false);
        }
    }, [currentPassword, newPassword, confirmPassword, token, validatePassword, logout, navigation]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    showsVerticalScrollIndicator={false}
                >
                    {/* HEADER */}
                    <View style={styles.header}>
                        <TouchableOpacity 
                            onPress={handleGoBack}
                            style={styles.backBtn}
                        >
                            <Icon name="arrow-left" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* CONTENT */}
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <View style={styles.iconCircle}>
                                <Icon name="lock" size={40} color={colors.primary} />
                            </View>
                        </View>

                        <Text style={styles.title}>Change Password</Text>
                        <Text style={styles.subtitle}>
                            Create a strong password with letters, numbers, and symbols.
                        </Text>

                        <PasswordInput
                            label="Current Password"
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Enter current password"
                            error={errors.currentPassword}
                            showToggle={true}
                            isVisible={showCurrent}
                            onToggle={() => setShowCurrent(!showCurrent)}
                        />

                        <PasswordInput
                            label="New Password"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Enter new password"
                            error={errors.newPassword}
                            showToggle={true}
                            isVisible={showNew}
                            onToggle={() => setShowNew(!showNew)}
                        />

                        {newPassword.length > 0 && (
                            <View style={styles.strengthContainer}>
                                <View style={styles.strengthBar}>
                                    <View 
                                        style={[
                                            styles.strengthFill,
                                            { 
                                                width: `${(passwordStrength.level / 3) * 100}%`,
                                                backgroundColor: passwordStrength.color 
                                            }
                                        ]} 
                                    />
                                </View>
                                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                                    {passwordStrength.label}
                                </Text>
                            </View>
                        )}

                        <View style={styles.requirementsCard}>
                            <Text style={styles.requirementsTitle}>Password Requirements</Text>
                            <View style={styles.requirementRow}>
                                <Icon 
                                    name={newPassword.length >= 8 ? 'check-circle' : 'circle'} 
                                    size={16} 
                                    color={newPassword.length >= 8 ? '#4CC9F0' : colors.textMuted} 
                                />
                                <Text style={[styles.requirementText, newPassword.length >= 8 && styles.requirementMet]}>
                                    At least 8 characters
                                </Text>
                            </View>
                            <View style={styles.requirementRow}>
                                <Icon 
                                    name={/[A-Z]/.test(newPassword) ? 'check-circle' : 'circle'} 
                                    size={16} 
                                    color={/[A-Z]/.test(newPassword) ? '#4CC9F0' : colors.textMuted} 
                                />
                                <Text style={[styles.requirementText, /[A-Z]/.test(newPassword) && styles.requirementMet]}>
                                    1 uppercase letter
                                </Text>
                            </View>
                            <View style={styles.requirementRow}>
                                <Icon 
                                    name={/[a-z]/.test(newPassword) ? 'check-circle' : 'circle'} 
                                    size={16} 
                                    color={/[a-z]/.test(newPassword) ? '#4CC9F0' : colors.textMuted} 
                                />
                                <Text style={[styles.requirementText, /[a-z]/.test(newPassword) && styles.requirementMet]}>
                                    1 lowercase letter
                                </Text>
                            </View>
                            <View style={styles.requirementRow}>
                                <Icon 
                                    name={/[0-9]/.test(newPassword) ? 'check-circle' : 'circle'} 
                                    size={16} 
                                    color={/[0-9]/.test(newPassword) ? '#4CC9F0' : colors.textMuted} 
                                />
                                <Text style={[styles.requirementText, /[0-9]/.test(newPassword) && styles.requirementMet]}>
                                    1 number
                                </Text>
                            </View>
                            <View style={styles.requirementRow}>
                                <Icon 
                                    name={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? 'check-circle' : 'circle'} 
                                    size={16} 
                                    color={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? '#4CC9F0' : colors.textMuted} 
                                />
                                <Text style={[styles.requirementText, /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) && styles.requirementMet]}>
                                    1 special character
                                </Text>
                            </View>
                        </View>

                        <PasswordInput
                            label="Confirm New Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Re-enter new password"
                            error={errors.confirmPassword}
                            showToggle={true}
                            isVisible={showConfirm}
                            onToggle={() => setShowConfirm(!showConfirm)}
                        />

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                            onPress={handleChange}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Icon name="check" size={20} color="#FFFFFF" />
                                    <Text style={styles.submitBtnText}>Update Password</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={handleGoBack}
                            disabled={loading}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xxl,
    },
    iconContainer: {
        alignItems: 'center',
        marginTop: spacing.lg,
        marginBottom: spacing.lg,
    },
    iconCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    inputContainer: {
        marginBottom: spacing.lg,
    },
    inputLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        color: colors.textDark,
        marginBottom: spacing.sm,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        minHeight: 56,
    },
    inputFocused: {
        borderColor: colors.primary,
        backgroundColor: '#F5F7FF',
    },
    inputErrorBorder: {
        borderColor: colors.danger,
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    textInput: {
        flex: 1,
        fontSize: typography.sizes.md,
        color: colors.textDark,
        paddingVertical: 0,
        height: 56,
    },
    eyeButton: {
        padding: spacing.sm,
    },
    errorText: {
        fontSize: typography.sizes.xs,
        color: colors.danger,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
    strengthContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: -spacing.sm,
        marginBottom: spacing.md,
    },
    strengthBar: {
        flex: 1,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        marginRight: spacing.sm,
    },
    strengthFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: typography.sizes.xs,
        fontWeight: '600',
        minWidth: 60,
    },
    requirementsCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    requirementsTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    requirementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    requirementText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginLeft: spacing.sm,
    },
    requirementMet: {
        color: '#4CC9F0',
        fontWeight: '500',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        borderRadius: 14,
        height: 56,
        marginTop: spacing.md,
    },
    submitBtnDisabled: {
        opacity: 0.7,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        marginLeft: spacing.sm,
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    cancelBtnText: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        fontWeight: '500',
    },
});

export default ChangePasswordScreen;
