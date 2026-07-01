import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { changePassword } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import PrimaryButton from '../../components/PrimaryButton';
import GlassCard from '../../components/GlassCard';
import { colors, typography, spacing } from '../../theme/tokens';

const ChangePasswordScreen = ({ navigation }) => {
    const auth = useAuth();
    const token = auth?.accessToken;

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);

    const validatePasswords = () => {
        if (!currentPassword.trim()) {
            Alert.alert('Validation Error', 'Please enter your current password.');
            return false;
        }

        if (!newPassword.trim()) {
            Alert.alert('Validation Error', 'Please enter a new password.');
            return false;
        }

        if (newPassword.length < 8) {
            Alert.alert('Validation Error', 'New password must be at least 8 characters long.');
            return false;
        }

        if (newPassword === currentPassword) {
            Alert.alert('Validation Error', 'New password cannot be the same as your current password.');
            return false;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Validation Error', 'New password and confirm password do not match.');
            return false;
        }

        return true;
    };

    // Flip force_password_change locally so RootNavigator immediately routes the
    // user to their home screen, then reconcile with the backend's truth.
    const completeSuccess = async () => {
        auth.updateUser({
            ...auth.user,
            force_password_change: false,
            forcePasswordChange: false,
        });
        // Pull the canonical user so any other server-side state is in sync.
        try { await auth.refreshUser(); } catch {}
    };

    const handleChange = async () => {
        if (!validatePasswords()) {
            return;
        }

        setIsLoading(true);

        try {
            await changePassword(currentPassword, newPassword);
            await completeSuccess();
        } catch (error) {
            const response = error?.response;
            const data = response?.data;

            // A real validation error from the server (wrong current password,
            // weak password, reused password, etc.) — show the message.
            if (response && response.status >= 400 && response.status < 500) {
                const errorMessage =
                    data?.error || data?.detail || data?.message ||
                    'Failed to change password. Please try again.';
                Alert.alert('Error', errorMessage);
                setIsLoading(false);
                return;
            }

            // No HTTP response (timeout / network / slow server). The change may
            // have actually applied server-side — verify via /me before failing,
            // so the user isn't stranded on this screen (the old bug: they retry
            // with a password that was already changed).
            const refreshed = await auth.refreshUser();
            if (refreshed && !refreshed.force_password_change) {
                setIsLoading(false);
                return; // success — navigation will switch to home
            }

            Alert.alert(
                'Network Slow',
                'We could not confirm the password change. Please check your connection and try again.'
            );
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <Icon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Change Password</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    <GlassCard style={styles.card}>
                        <Text style={styles.description}>
                            Enter your current password and choose a new password.
                        </Text>

                        <View style={[styles.inputContainer, isLoading && styles.inputDisabled]}>
                            <Icon name="lock" size={20} color={colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Current Password"
                                placeholderTextColor={colors.textMuted}
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                secureTextEntry={!showPasswords}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                            <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)}>
                                <Icon
                                    name={showPasswords ? 'eye-off' : 'eye'}
                                    size={20}
                                    color={colors.textMuted}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.inputContainer, isLoading && styles.inputDisabled]}>
                            <Icon name="lock" size={20} color={colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="New Password"
                                placeholderTextColor={colors.textMuted}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showPasswords}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>

                        <View style={[styles.inputContainer, isLoading && styles.inputDisabled]}>
                            <Icon name="lock" size={20} color={colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm New Password"
                                placeholderTextColor={colors.textMuted}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showPasswords}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>

                        <Text style={styles.hint}>
                            Min. 8 characters · Must differ from current password
                        </Text>

                        <PrimaryButton
                            title="Update Password"
                            onPress={handleChange}
                            loading={isLoading}
                            disabled={isLoading}
                            style={styles.button}
                        />
                    </GlassCard>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        backgroundColor: colors.primaryDark,
    },
    backButton: {
        padding: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        padding: spacing.lg,
        justifyContent: 'center',
    },
    card: {
        padding: spacing.xl,
    },
    description: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    input: {
        flex: 1,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        fontSize: typography.sizes.md,
        color: colors.textDark,
    },
    inputDisabled: {
        opacity: 0.5,
    },
    hint: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    button: {
        marginTop: spacing.sm,
    },
});

export default ChangePasswordScreen;
