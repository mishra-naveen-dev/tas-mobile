import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import { useAuth } from '../../context/AuthContext';
import { loadCustomBaseURL, setCustomBaseURL, getBaseURL } from '../../api/api';

import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import GlassCard from '../../components/GlassCard';
import { colors, typography, spacing } from '../../theme/tokens';

const SUPPORT_EMAIL = 'support@tasenterprise.com';
const SUPPORT_PHONE = '+91-9876543210';
const LOCAL_EMULATOR_URL = 'http://10.0.2.2:8000';
const PROD_URL = 'https://tas-backendnew.onrender.com';

const LoginScreen = ({ navigation }) => {
    const auth = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showServerConfig, setShowServerConfig] = useState(false);
    const [serverUrl, setServerUrl] = useState('');

    useEffect(() => {
        loadCustomBaseURL().then(() => {
            setServerUrl(getBaseURL().replace('/api/v1', ''));
        });
    }, []);

    const handleSaveServerUrl = async () => {
        const trimmed = serverUrl.trim();
        await setCustomBaseURL(trimmed || null);
        const saved = getBaseURL().replace('/api/v1', '');
        setServerUrl(saved);
        setShowServerConfig(false);
        Alert.alert('Server Updated', `Now using:\n${saved}`);
    };

    const handleUseLocal = () => {
        setServerUrl(LOCAL_EMULATOR_URL);
    };

    const handleUseProd = () => {
        setServerUrl(PROD_URL);
    };

    const handleContactSupport = () => {
        Alert.alert(
            'Contact Support',
            'How would you like to reach us?',
            [
                { text: 'Email', onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Need Help - TAS Mobile`) },
                { text: 'Phone', onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`) },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            Alert.alert('Validation Error', 'Please enter both username and password.');
            return;
        }

        setIsLoading(true);

        try {
            const result = await auth.login(username.trim(), password);

            if (result.success) {
                // Navigation will automatically update based on auth state change
            } else {
                Alert.alert('Authentication Failed', result.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            console.error('Login error:', error);
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
                <View style={styles.inner}>
                    <View style={styles.header}>
                        <Text style={styles.title}>TAS Mobile</Text>
                        <Text style={styles.subtitle}>Traveling Allowance System</Text>
                    </View>

                    <GlassCard style={styles.card}>
                        <Text style={styles.cardTitle}>Sign In</Text>

                        <InputField
                            icon="user"
                            placeholder="Employee ID or Username"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <InputField
                            icon="lock"
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <PrimaryButton
                            title="Continue"
                            onPress={handleLogin}
                            loading={isLoading}
                            disabled={isLoading}
                            style={{ marginTop: spacing.md }}
                        />

                        {/* Server URL config — collapsed by default */}
                        <TouchableOpacity
                            style={styles.serverToggle}
                            onPress={() => setShowServerConfig(v => !v)}
                            activeOpacity={0.7}
                        >
                            <Icon name="server" size={13} color={colors.textMuted} />
                            <Text style={styles.serverToggleText}>
                                {showServerConfig ? 'Hide Server Config' : 'Server Config'}
                            </Text>
                            <Icon
                                name={showServerConfig ? 'chevron-up' : 'chevron-down'}
                                size={13}
                                color={colors.textMuted}
                            />
                        </TouchableOpacity>

                        {showServerConfig && (
                            <View style={styles.serverPanel}>
                                <InputField
                                    icon="link"
                                    placeholder="http://10.0.2.2:8000"
                                    value={serverUrl}
                                    onChangeText={setServerUrl}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                />
                                <View style={styles.serverQuickRow}>
                                    <TouchableOpacity
                                        style={styles.quickBtn}
                                        onPress={handleUseLocal}
                                    >
                                        <Text style={styles.quickBtnText}>Local (Emulator)</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.quickBtn}
                                        onPress={handleUseProd}
                                    >
                                        <Text style={styles.quickBtnText}>Production</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    style={styles.saveServerBtn}
                                    onPress={handleSaveServerUrl}
                                >
                                    <Text style={styles.saveServerBtnText}>Save & Apply</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </GlassCard>

                    <TouchableOpacity
                        style={styles.supportContainer}
                        onPress={handleContactSupport}
                        activeOpacity={0.7}
                    >
                        <Icon name="help-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.supportText}>Need Help? Contact Support</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primaryDark,
    },
    inner: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xxl,
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        letterSpacing: 1.5,
    },
    subtitle: {
        fontSize: typography.sizes.md,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: spacing.xs,
    },
    card: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
    },
    cardTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    supportContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
        padding: spacing.md,
    },
    supportText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.sm,
        marginLeft: spacing.sm,
    },
    serverToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
        gap: 5,
        paddingVertical: 4,
    },
    serverToggleText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    serverPanel: {
        marginTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.md,
        gap: spacing.sm,
    },
    serverQuickRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    quickBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    quickBtnText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        fontWeight: typography.weights.medium,
    },
    saveServerBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    saveServerBtnText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
    },
});

export default LoginScreen;
