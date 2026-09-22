import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Linking,
    Modal,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import { useAuth } from '../../context/AuthContext';
import api, { loadCustomBaseURL, setCustomBaseURL, getBaseURL } from '../../api/api';
import { DOC_LABEL, DocumentText } from '../../components/LegalGate';

import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import GlassCard from '../../components/GlassCard';
import { colors, typography, spacing } from '../../theme/tokens';

const SUPPORT_EMAIL = 'naveen@armanindia.com';
const SUPPORT_PHONE = '1-800-10-27626';
const LOCAL_EMULATOR_URL = 'http://10.0.2.2:8000';
const PROD_URL = 'https://api.tas.namracred.co.in';

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
                { text: 'Email', onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Need Help - Namracred`) },
                { text: 'Phone', onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`) },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    // ── §19: informational legal links on the login screen (pre-login, public
    // read of /legal/documents/). Purely informational — no checkboxes, no
    // consent capture here; the mandatory acknowledgement happens after login
    // on the LegalGate screen. Content is always served by the backend. ──
    const [viewDocType, setViewDocType] = useState(null);
    const [viewDoc, setViewDoc] = useState(null);
    const [docLoading, setDocLoading] = useState(false);

    const openLegalDoc = async (type) => {
        setViewDocType(type);
        setViewDoc(null);
        setDocLoading(true);
        try {
            const r = await api.getLegalDocuments();
            const all = Array.isArray(r?.data) ? r.data : [];
            setViewDoc(all.find((d) => d.doc_type === type) || null);
        } catch (e) {
            setViewDoc(null);
        } finally {
            setDocLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            Alert.alert('Validation Error', 'Please enter both username and password.');
            return;
        }

        setIsLoading(true);

        try {
            const result = await auth.login(username.trim(), password);

            if (!result.success) {
                const deviceErrorCodes = {
                    DEVICE_LIMIT_EXCEEDED: 'Device Already Registered',
                    NEW_DEVICE_NOT_ALLOWED_FOR_EMPLOYEE: 'New Device Not Allowed',
                    DEVICE_PENDING_APPROVAL: 'Device Pending Approval',
                    DEVICE_BLOCKED: 'Device Blocked',
                    DEVICE_REJECTED: 'Device Rejected',
                    DEVICE_OWNED_BY_ANOTHER_USER: 'Device Conflict',
                    USER_DEVICE_BLOCKED: 'Device Blocked',
                    ACCOUNT_BLOCKED_MULTI_DEVICE: 'Account Locked',
                };
                const isDeviceError = !!deviceErrorCodes[result.code];
                const title = deviceErrorCodes[result.code] || 'Authentication Failed';
                // Guard against arrays — Alert.alert crashes on Android if message is not a string
                const raw = result.error || 'Login failed. Please check your credentials.';
                const message = typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw[0] || '' : String(raw));

                if (isDeviceError) {
                    Alert.alert(title, message, [
                        {
                            text: 'Contact Admin',
                            onPress: handleContactSupport,
                        },
                        { text: 'OK', style: 'cancel' },
                    ]);
                } else {
                    Alert.alert(title, message);
                }
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            if (__DEV__) console.error('Login error:', error);
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
                        <Text style={styles.title}>Namracred</Text>
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

                        {/* Server URL config — dev builds only, never shown to end users */}
                        {__DEV__ && (
                            <>
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
                            </>
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

                    {/* Informational only — the mandatory acknowledgement is the post-login gate (§3, §19) */}
                    <View style={styles.legalLinks}>
                        <TouchableOpacity onPress={() => openLegalDoc('TERMS')} accessibilityRole="link"
                            accessibilityLabel="View Terms and Conditions">
                            <Text style={styles.legalLinkText}>Terms &amp; Conditions</Text>
                        </TouchableOpacity>
                        <Text style={styles.legalDot}>·</Text>
                        <TouchableOpacity onPress={() => openLegalDoc('PRIVACY')} accessibilityRole="link"
                            accessibilityLabel="View Privacy Policy">
                            <Text style={styles.legalLinkText}>Privacy Policy</Text>
                        </TouchableOpacity>
                        <Text style={styles.legalDot}>·</Text>
                        <TouchableOpacity onPress={() => openLegalDoc('LOCATION_TRACKING')} accessibilityRole="link"
                            accessibilityLabel="View Location and Tracking Notice">
                            <Text style={styles.legalLinkText}>Location &amp; Tracking Notice</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={!!viewDocType} animationType="slide"
                onRequestClose={() => setViewDocType(null)}>
                <SafeAreaView style={styles.docModal}>
                    <View style={styles.docModalHead}>
                        <Text style={styles.docModalTitle}>
                            {DOC_LABEL[viewDocType] || 'Legal Document'}
                        </Text>
                        <TouchableOpacity onPress={() => setViewDocType(null)}
                            accessibilityRole="button" accessibilityLabel="Close">
                            <Icon name="x" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.docModalBody}>
                        {docLoading ? (
                            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                        ) : viewDoc ? (
                            <DocumentText doc={viewDoc} />
                        ) : (
                            <Text style={styles.docModalMuted}>
                                This document has not been published yet.
                            </Text>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
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
    legalLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: spacing.md,
    },
    legalLinkText: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: typography.sizes.xs,
        textDecorationLine: 'underline',
    },
    legalDot: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: typography.sizes.xs,
    },
    docModal: {
        flex: 1,
        backgroundColor: colors.background || '#fff',
    },
    docModalHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    docModalTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textPrimary,
        flex: 1,
    },
    docModalBody: {
        padding: spacing.lg,
    },
    docModalMuted: {
        color: colors.textMuted,
        marginTop: spacing.xl,
        textAlign: 'center',
    },
});

export default LoginScreen;
