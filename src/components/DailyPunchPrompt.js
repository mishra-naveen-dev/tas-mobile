import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { usePunch } from '../context/PunchContext';
import { colors, typography, spacing } from '../theme/tokens';

const IS_DEV = __DEV__;

// One prompt per calendar day, per direction — persisted so re-opening the
// app later the same day (already nudged once) doesn't nag again.
const PUNCH_IN_PROMPT_KEY = '@tas_punch_in_prompt_date';
const PUNCH_OUT_PROMPT_KEY = '@tas_punch_out_prompt_date';

// A work session left open this long gets a punch-out nudge next time the
// employee opens (or returns to) the app — not a hard cutoff, just a nudge.
const PUNCH_OUT_REMINDER_HOURS = 11;
const PUNCH_OUT_REMINDER_MS = PUNCH_OUT_REMINDER_HOURS * 60 * 60 * 1000;

const todayKey = () => new Date().toISOString().slice(0, 10);

// Mounted once on the Employee home screen. Silent by design — a failure to
// read/write AsyncStorage or resolve punch state should never throw or block
// the home screen, at worst the nudge just doesn't show that day.
export default function DailyPunchPrompt() {
    const navigation = useNavigation();
    const { punches, isActive, initialFetchDone } = usePunch();
    const [visible, setVisible] = useState(false);
    const [variant, setVariant] = useState('in'); // 'in' | 'out'

    const evaluate = useCallback(async () => {
        if (!initialFetchDone) return;

        try {
            const today = todayKey();

            // No punch at all yet today — nudge to start the day. Checked
            // before the punch-out case since an empty punch list can never
            // also be "still active".
            if (punches.length === 0) {
                const lastShown = await AsyncStorage.getItem(PUNCH_IN_PROMPT_KEY);
                if (lastShown !== today) {
                    await AsyncStorage.setItem(PUNCH_IN_PROMPT_KEY, today);
                    setVariant('in');
                    setVisible(true);
                }
                return;
            }

            // Still punched in and the current session has run long — nudge
            // to punch out. punches is sorted newest-first, so punches[0] is
            // the active PUNCH_IN (isActive already confirms no PUNCH_OUT
            // has closed it yet, including a same-day second session).
            if (isActive && punches[0]?.punched_at) {
                const elapsedMs = Date.now() - new Date(punches[0].punched_at).getTime();
                if (elapsedMs >= PUNCH_OUT_REMINDER_MS) {
                    const lastShown = await AsyncStorage.getItem(PUNCH_OUT_PROMPT_KEY);
                    if (lastShown !== today) {
                        await AsyncStorage.setItem(PUNCH_OUT_PROMPT_KEY, today);
                        setVariant('out');
                        setVisible(true);
                    }
                }
            }
        } catch (e) {
            if (IS_DEV) console.warn('[DailyPunchPrompt] evaluate error:', e.message);
        }
    }, [punches, isActive, initialFetchDone]);

    useEffect(() => { evaluate(); }, [evaluate]);

    const handleClose = () => setVisible(false);

    const handleStart = () => {
        setVisible(false);
        // Same route the tab bar's own dedicated punch button uses — bubbles
        // up to the stack navigator, opening the shared punch-in/punch-out
        // screen regardless of which tab is currently focused.
        navigation.navigate('Punch');
    };

    const isIn = variant === 'in';
    const accent = isIn ? colors.primary : colors.warning;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={handleClose}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityLabel="Dismiss"
                    >
                        <Icon name="x" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    <View style={[styles.iconContainer, { backgroundColor: `${accent}15` }]}>
                        <Icon name={isIn ? 'sunrise' : 'log-out'} size={34} color={accent} />
                    </View>

                    <Text style={styles.title}>{isIn ? 'Start Your Day' : 'Time to Wrap Up'}</Text>
                    <Text style={styles.subtitle}>
                        {isIn
                            ? "Start your day with amazing energy — let's do your first punch to begin your work."
                            : "You've been active for over 11 hours. Don't forget to punch out when you're done for the day."}
                    </Text>

                    <TouchableOpacity
                        style={[styles.cta, { backgroundColor: accent }]}
                        onPress={handleStart}
                        activeOpacity={0.85}
                    >
                        <Icon name={isIn ? 'play' : 'log-out'} size={18} color="#fff" style={styles.ctaIcon} />
                        <Text style={styles.ctaText}>{isIn ? 'Start Punch' : 'Punch Out Now'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    closeBtn: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        zIndex: 1,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: typography.sizes.sm * typography.lineHeight.normal,
        marginBottom: spacing.xl,
    },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: spacing.md,
        borderRadius: 12,
    },
    ctaIcon: {
        marginRight: spacing.xs,
    },
    ctaText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
    },
});
