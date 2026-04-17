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

import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import GlassCard from '../../components/GlassCard';
import { colors, typography, spacing } from '../../theme/tokens';

const SUPPORT_EMAIL = 'support@tasenterprise.com';
const SUPPORT_PHONE = '+91-9876543210';

const LoginScreen = ({ navigation }) => {
    const auth = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const getHomeRoute = () => {
        const userData = auth?.user;
        const role = userData?.role;

        if (role === 'SUPER_ADMIN') return 'SuperAdminTabs';
        if (role === 'ADMIN') return 'AdminDashboard';
        return 'EmployeeTabs';
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
                const homeRoute = getHomeRoute();
                if (auth.navigationRef?.current?.isReady()) {
                    auth.navigationRef.current.reset({
                        index: 0,
                        routes: [{ name: homeRoute }],
                    });
                }
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
    }
});

export default LoginScreen;
