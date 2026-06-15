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

        if (newPassword !== confirmPassword) {
            Alert.alert('Validation Error', 'New password and confirm password do not match.');
            return false;
        }

        return true;
    };

    const handleChange = async () => {
        if (!validatePasswords()) {
            return;
        }

        setIsLoading(true);

        try {
            await changePassword(newPassword, token);
            Alert.alert('Success', 'Password updated successfully. Please login again.', [
                {
                    text: 'OK',
                    onPress: () => {
                        auth.logout();
                    }
                }
            ]);
        } catch (error) {
            const errorMessage = error?.response?.data?.detail || 'Failed to change password. Please try again.';
            Alert.alert('Error', errorMessage);
        } finally {
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

                        <View style={styles.inputContainer}>
                            <Icon name="lock" size={20} color={colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Current Password"
                                placeholderTextColor={colors.textMuted}
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                secureTextEntry={!showPasswords}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)}>
                                <Icon
                                    name={showPasswords ? 'eye-off' : 'eye'}
                                    size={20}
                                    color={colors.textMuted}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon name="lock" size={20} color={colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="New Password"
                                placeholderTextColor={colors.textMuted}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showPasswords}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon name="lock" size={20} color={colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm New Password"
                                placeholderTextColor={colors.textMuted}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showPasswords}
                                autoCapitalize="none"
                            />
                        </View>

                        <Text style={styles.hint}>
                            Password must be at least 8 characters long
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
