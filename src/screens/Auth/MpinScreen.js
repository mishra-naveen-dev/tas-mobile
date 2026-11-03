import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../context/AuthContext';
import GlassCard from '../../components/GlassCard';
import { colors, typography, spacing } from '../../theme/tokens';
import { MPIN_LENGTH, isWeakMpin } from '../../utils/mpin';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

/**
 * mode="create": after a password login, pick a 6-digit MPIN (entered twice).
 * mode="unlock": on app open / after 5 min in the background.
 */
const MpinScreen = ({ mode }) => {
    const { user, createMpin, unlockWithMpin, forgotMpin } = useAuth();
    const [pin, setPin] = useState('');
    const [firstPin, setFirstPin] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const creating = mode === 'create';
    const title = creating
        ? (firstPin ? 'Re-enter your MPIN' : 'Set a 6-digit MPIN')
        : 'Enter your MPIN';
    const name = user?.first_name || user?.username || '';

    const submit = async (value) => {
        if (creating) {
            if (!firstPin) {
                if (isWeakMpin(value)) {
                    setError('Too easy to guess. Avoid repeated or sequential digits.');
                    return setPin('');
                }
                setFirstPin(value);
                return setPin('');
            }
            if (value !== firstPin) {
                setError("MPINs didn't match. Start again.");
                setFirstPin(null);
                return setPin('');
            }
            setBusy(true);
            await createMpin(value);
            return;
        }
        setBusy(true);
        const res = await unlockWithMpin(value);
        setBusy(false);
        if (!res.ok) {
            setPin('');
            setError(res.attemptsLeft > 0
                ? `Wrong MPIN. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? '' : 's'} left.`
                : 'Too many wrong attempts. Please login with your password.');
        }
    };

    const press = (key) => {
        if (busy) return;
        if (key === 'back') return setPin((p) => p.slice(0, -1));
        if (!key || pin.length >= MPIN_LENGTH) return;
        setError('');
        const next = pin + key;
        setPin(next);
        if (next.length === MPIN_LENGTH) submit(next);
    };

    const onForgot = () => Alert.alert(
        'Forgot MPIN?',
        'You will be logged out. Login with your password to set a new MPIN.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: forgotMpin }],
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.inner}>
                <View style={styles.header}>
                    <Text style={styles.company}>Namra Finance Limited</Text>
                    <Icon name="lock" size={36} color="#FFFFFF" />
                    {!creating && !!name && <Text style={styles.subtitle}>Welcome back, {name}</Text>}
                </View>

                <GlassCard style={styles.card}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    {creating && !firstPin && (
                        <Text style={styles.hint}>You'll use it to open the app instead of your password.</Text>
                    )}

                    <View style={styles.dots} accessibilityLabel={`${pin.length} of ${MPIN_LENGTH} digits entered`}>
                        {Array.from({ length: MPIN_LENGTH }, (_, i) => (
                            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
                        ))}
                    </View>

                    <View style={styles.errorRow}>
                        {busy ? <ActivityIndicator color={colors.primary} />
                            : !!error && <Text style={styles.error}>{error}</Text>}
                    </View>

                    <View style={styles.pad}>
                        {KEYS.map((key, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.key}
                                onPress={() => press(key)}
                                disabled={!key}
                                accessibilityRole="button"
                                accessibilityLabel={key === 'back' ? 'Delete' : key || undefined}
                            >
                                {key === 'back'
                                    ? <Icon name="delete" size={24} color={colors.textDark} />
                                    : <Text style={styles.keyText}>{key}</Text>}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {!creating && (
                        <TouchableOpacity onPress={onForgot} style={styles.forgot}>
                            <Text style={styles.forgotText}>Forgot MPIN? Login with password</Text>
                        </TouchableOpacity>
                    )}
                </GlassCard>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2026 Namra Finance Limited. All rights reserved.</Text>
                    <Text style={styles.footerText}>Developed by Naveen Mishra</Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primaryDark },
    inner: { flex: 1, justifyContent: 'center', padding: spacing.xl },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    company: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        letterSpacing: 1,
        marginBottom: spacing.lg,
    },
    footer: { alignItems: 'center', marginTop: spacing.lg },
    footerText: { fontSize: typography.sizes.xs, color: 'rgba(255, 255, 255, 0.8)', marginTop: spacing.xxs },
    subtitle: {
        fontSize: typography.sizes.md,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: spacing.sm,
    },
    card: { padding: spacing.xl },
    cardTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        textAlign: 'center',
    },
    hint: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    dots: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
    dot: {
        width: 16, height: 16, borderRadius: 8, marginHorizontal: spacing.xs,
        borderWidth: 2, borderColor: colors.primary,
    },
    dotFilled: { backgroundColor: colors.primary },
    errorRow: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    error: { color: colors.error, fontSize: typography.sizes.xs, textAlign: 'center' },
    pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    key: { width: '30%', height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
    keyText: { fontSize: typography.sizes.xxl, color: colors.textDark, fontWeight: typography.weights.medium },
    forgot: { alignItems: 'center', marginTop: spacing.sm },
    forgotText: { color: colors.primary, fontSize: typography.sizes.sm },
});

export default MpinScreen;
