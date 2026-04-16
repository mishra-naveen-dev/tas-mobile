import React, { useState, useContext } from 'react';
import { View, Text, Alert, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import { AuthContext } from '../context/AuthContext';
import { loginUser } from '../api/authApi';

import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';

const SUPPORT_EMAIL = 'support@tasenterprise.com';
const SUPPORT_PHONE = '+91-9876543210';

const LoginScreen = () => {
    const { saveTokensAndUser } = useContext(AuthContext);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

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
        if (!username || !password) {
            Alert.alert("Validation Error", "Please enter both username and password.");
            return;
        }

        try {
            setLoading(true);
            const res = await loginUser(username, password);
            const data = res.data;

            if (!data.access) {
                Alert.alert("Error", "Invalid server response.");
                return;
            }

            // The backend returns user object within the token pair response
            const userData = data.user || {};
            await saveTokensAndUser(data.access, data.refresh, userData);
            
            // Note: Navigation is now automatically handled by AppNavigator observing AuthContext!

        } catch (err) {
            const msg = err?.response?.data?.detail || "Login failed. Please check your credentials.";
            Alert.alert("Authentication Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.container}
            >
                <View style={styles.inner}>
                    {/* Header Region */}
                    <View style={styles.header}>
                        <Text style={styles.title}>TAS Mobile</Text>
                        <Text style={styles.subtitle}>Traveling Allowance System</Text>
                    </View>

                    {/* Form Region */}
                    <GlassCard style={styles.card}>
                        <Text style={styles.cardTitle}>Sign In</Text>
                        
                        <InputField
                            icon="user"
                            placeholder="Employee ID or Username"
                            value={username}
                            onChangeText={setUsername}
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
                            loading={loading}
                            style={{ marginTop: spacing.md }}
                        />
                    </GlassCard>

                    {/* Contact Support */}
                    <TouchableOpacity style={styles.supportContainer} onPress={handleContactSupport}>
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
        textDecorationLine: 'underline',
    }
});

export default LoginScreen;