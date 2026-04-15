import React, { useState, useContext, useCallback } from 'react';
import { 
    View, 
    Text, 
    Alert, 
    StyleSheet, 
    KeyboardAvoidingView, 
    Platform,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import { AuthContext } from '../context/AuthContext';
import { loginUser } from '../api/authApi';

import PrimaryButton from '../components/PrimaryButton';
import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';

const LoginScreen = () => {
    const { saveTokensAndUser } = useContext(AuthContext);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [isUsernameFocused, setIsUsernameFocused] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    const handleLogin = useCallback(async () => {
        if (!username.trim() || !password) {
            Alert.alert("Validation Error", "Please enter both username and password.");
            return;
        }

        setLoading(true);

        try {
            const res = await loginUser(username.trim(), password);
            const data = res.data;

            if (!data.access) {
                Alert.alert("Error", "Invalid server response.");
                return;
            }

            const userData = data.user || {};
            await saveTokensAndUser(data.access, data.refresh, userData);

        } catch (err) {
            const msg = err?.response?.data?.detail || "Login failed. Please check your credentials.";
            Alert.alert("Authentication Failed", msg);
        } finally {
            setLoading(false);
        }
    }, [username, password, saveTokensAndUser]);

    const handleContact = (type) => {
        if (type === 'email') {
            Linking.openURL('mailto:support@tas-system.com?subject=Login Issue - TAS Mobile');
        } else if (type === 'phone') {
            Linking.openURL('tel:+919876543210');
        } else if (type === 'whatsapp') {
            Linking.openURL('whatsapp://send?phone=919876543210&text=I need help with my TAS Mobile login');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.keyboardView}
            >
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.inner}>
                        {/* Header Region */}
                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <Icon name="map" size={48} color="#FFFFFF" />
                            </View>
                            <Text style={styles.title}>TAS Mobile</Text>
                            <Text style={styles.subtitle}>Traveling Allowance System</Text>
                        </View>

                        {/* Form Region */}
                        <GlassCard style={styles.card}>
                            <Text style={styles.cardTitle}>Sign In</Text>
                            
                            {/* Username Field */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Username / Employee ID</Text>
                                <View style={[
                                    styles.inputWrapper,
                                    isUsernameFocused && styles.inputFocused
                                ]}>
                                    <Icon name="user" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Enter username"
                                        placeholderTextColor={colors.textMuted}
                                        value={username}
                                        onChangeText={setUsername}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoComplete="username"
                                        onFocus={() => setIsUsernameFocused(true)}
                                        onBlur={() => setIsUsernameFocused(false)}
                                        returnKeyType="next"
                                    />
                                </View>
                            </View>

                            {/* Password Field */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Password</Text>
                                <View style={[
                                    styles.inputWrapper,
                                    isPasswordFocused && styles.inputFocused
                                ]}>
                                    <Icon name="lock" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Enter password"
                                        placeholderTextColor={colors.textMuted}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoComplete="password"
                                        onFocus={() => setIsPasswordFocused(true)}
                                        onBlur={() => setIsPasswordFocused(false)}
                                        returnKeyType="done"
                                        onSubmitEditing={handleLogin}
                                    />
                                    <TouchableOpacity 
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeButton}
                                    >
                                        <Icon 
                                            name={showPassword ? 'eye-off' : 'eye'} 
                                            size={20} 
                                            color={colors.textMuted} 
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <PrimaryButton 
                                title="Sign In" 
                                onPress={handleLogin} 
                                loading={loading}
                                style={styles.loginBtn}
                            />
                        </GlassCard>

                        {/* Help Button */}
                        <TouchableOpacity 
                            style={styles.helpButton}
                            onPress={() => setShowHelpModal(true)}
                            activeOpacity={0.8}
                        >
                            <Icon name="help-circle" size={20} color="#FFFFFF" />
                            <Text style={styles.helpButtonText}>Need Help? Contact Support</Text>
                        </TouchableOpacity>

                        {/* Footer */}
                        <Text style={styles.footer}>
                            Powered by Naveen Mishra{"\n"}All Copyrights Reserved @ 2026
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Help Modal */}
            <Modal
                visible={showHelpModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowHelpModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity 
                        activeOpacity={1} 
                        onPress={() => setShowHelpModal(false)}
                        style={styles.modalTouchable}
                    >
                        <View style={styles.modalContent}>
                            {/* Header */}
                            <View style={styles.modalHeader}>
                                <View style={styles.modalIconContainer}>
                                    <Icon name="headphones" size={32} color="#FFFFFF" />
                                </View>
                                <Text style={styles.modalTitle}>Contact Support</Text>
                                <Text style={styles.modalSubtitle}>
                                    Having trouble logging in? Reach out to our support team for assistance.
                                </Text>
                            </View>

                            {/* Contact Options */}
                            <View style={styles.contactOptions}>
                                <TouchableOpacity 
                                    style={styles.contactCard}
                                    onPress={() => {
                                        setShowHelpModal(false);
                                        handleContact('email');
                                    }}
                                >
                                    <View style={[styles.contactIcon, { backgroundColor: '#EA4335' }]}>
                                        <Icon name="mail" size={24} color="#FFFFFF" />
                                    </View>
                                    <View style={styles.contactInfo}>
                                        <Text style={styles.contactTitle}>Email Support</Text>
                                        <Text style={styles.contactDetail}>support@tas-system.com</Text>
                                    </View>
                                    <Icon name="chevron-right" size={20} color={colors.textMuted} />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.contactCard}
                                    onPress={() => {
                                        setShowHelpModal(false);
                                        handleContact('phone');
                                    }}
                                >
                                    <View style={[styles.contactIcon, { backgroundColor: colors.success }]}>
                                        <Icon name="phone" size={24} color="#FFFFFF" />
                                    </View>
                                    <View style={styles.contactInfo}>
                                        <Text style={styles.contactTitle}>Call Support</Text>
                                        <Text style={styles.contactDetail}>+91 98765 43210</Text>
                                    </View>
                                    <Icon name="chevron-right" size={20} color={colors.textMuted} />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.contactCard}
                                    onPress={() => {
                                        setShowHelpModal(false);
                                        handleContact('whatsapp');
                                    }}
                                >
                                    <View style={[styles.contactIcon, { backgroundColor: '#25D366' }]}>
                                        <Icon name="message-circle" size={24} color="#FFFFFF" />
                                    </View>
                                    <View style={styles.contactInfo}>
                                        <Text style={styles.contactTitle}>WhatsApp</Text>
                                        <Text style={styles.contactDetail}>Quick chat support</Text>
                                    </View>
                                    <Icon name="chevron-right" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* Super Admin Note */}
                            <View style={styles.adminNote}>
                                <Icon name="info" size={16} color={colors.primary} />
                                <Text style={styles.adminNoteText}>
                                    For urgent account issues, contact your Super Admin directly.
                                </Text>
                            </View>

                            {/* Close Button */}
                            <TouchableOpacity 
                                style={styles.closeButton}
                                onPress={() => setShowHelpModal(false)}
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
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
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: typography.sizes.md,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: spacing.xs,
    },
    card: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: 20,
    },
    cardTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.xl,
        textAlign: 'center',
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
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        minHeight: 56,
    },
    inputFocused: {
        borderColor: colors.primary,
        backgroundColor: colors.red50,
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    textInput: {
        flex: 1,
        fontSize: typography.sizes.md,
        color: colors.textDark,
        height: 56,
    },
    eyeButton: {
        padding: spacing.sm,
    },
    loginBtn: {
        marginTop: spacing.md,
    },
    helpButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
        paddingVertical: spacing.md,
    },
    helpButtonText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.md,
        fontWeight: '500',
        marginLeft: spacing.sm,
    },
    footer: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.sizes.sm,
        marginTop: spacing.lg,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalTouchable: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden',
    },
    modalHeader: {
        backgroundColor: colors.primary,
        padding: spacing.xl,
        alignItems: 'center',
    },
    modalIconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        marginBottom: spacing.xs,
    },
    modalSubtitle: {
        fontSize: typography.sizes.sm,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        lineHeight: 20,
    },
    contactOptions: {
        padding: spacing.lg,
    },
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: spacing.md,
        borderRadius: 16,
        marginBottom: spacing.md,
    },
    contactIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    contactInfo: {
        flex: 1,
    },
    contactTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    contactDetail: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    adminNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.red50,
        marginHorizontal: spacing.lg,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.lg,
    },
    adminNoteText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        marginLeft: spacing.sm,
        lineHeight: 20,
    },
    closeButton: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    closeButtonText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.primary,
    },
});

export default LoginScreen;
