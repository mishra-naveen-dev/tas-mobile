import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    AppState,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import LocationService from '../services/LocationService';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

const STEPS = [
    "Click on the 'Go to Settings' button below",
    "Select 'Permissions'",
    "Select 'Location'",
    "Select 'Allow all the time' & turn on 'Use Precise Location'",
];

// Full-screen prompt that mirrors the delivery-app background-location gate.
const BackgroundLocationScreen = ({ onGranted }) => {
    const [busy, setBusy] = useState(false);

    const recheck = useCallback(async () => {
        const fg = await LocationService.checkPermission();
        const bg = await LocationService.checkBackgroundPermission();
        if (fg && bg) onGranted?.();
        return fg && bg;
    }, [onGranted]);

    // Re-check whenever the app comes back to the foreground (e.g. returning
    // from the system Settings screen).
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') recheck();
        });
        return () => sub.remove();
    }, [recheck]);

    const handleAllow = async () => {
        setBusy(true);
        try {
            // Fire the native prompts first (foreground, then "all the time").
            const status = await LocationService.requestForegroundStatus();
            if (status === 'granted') {
                await LocationService.requestBackgroundPermission();
            }
            const ok = await recheck();
            if (!ok) LocationService.openSettings();
        } finally {
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.iconWrap}>
                    <View style={styles.pinCircle}>
                        <Icon name="map-pin" size={44} color="#FFFFFF" />
                    </View>
                </View>

                <Text style={styles.title}>Background location permission needed</Text>

                <Text style={styles.desc}>
                    Background Location is needed when the app is not in use so your visits and
                    route are recorded for collection tracking. Features that use location:
                    Punch In / Out, Route tracking, Customer visits and collections.
                </Text>

                <View style={styles.steps}>
                    {STEPS.map((step, i) => (
                        <View key={i} style={styles.stepRow}>
                            <View style={styles.stepBadgeCol}>
                                <View style={styles.stepBadge}>
                                    <Text style={styles.stepNum}>{i + 1}</Text>
                                </View>
                                {i < STEPS.length - 1 && <View style={styles.stepLine} />}
                            </View>
                            <Text style={styles.stepText}>{step}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.button} onPress={handleAllow} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Go to Settings</Text>}
            </TouchableOpacity>
        </SafeAreaView>
    );
};

/**
 * Gate that enforces background location for users who require tracking.
 * Renders the permission screen until granted; otherwise renders children.
 */
const LocationGate = ({ user, children }) => {
    const trackingRequired = !!(user && user.tracking_enabled);
    const [granted, setGranted] = useState(null); // null = checking
    const checkedOnce = useRef(false);

    const check = useCallback(async () => {
        if (!trackingRequired) { setGranted(true); return; }
        const fg = await LocationService.checkPermission();
        const bg = await LocationService.checkBackgroundPermission();
        setGranted(fg && bg);
    }, [trackingRequired]);

    // Priority check on mount / login and on every return to foreground.
    useEffect(() => {
        check();
        checkedOnce.current = true;
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') check();
        });
        return () => sub.remove();
    }, [check]);

    if (!trackingRequired) return children;
    if (granted === null) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }
    if (!granted) {
        return <BackgroundLocationScreen onGranted={() => setGranted(true)} />;
    }
    return children;
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    scroll: { padding: spacing.xl, paddingBottom: spacing.lg, flexGrow: 1 },
    iconWrap: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
    pinCircle: {
        width: 96, height: 96, borderRadius: 48,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    title: {
        fontSize: typography.sizes.xl, fontWeight: typography.weights.bold,
        color: colors.textDark, textAlign: 'center', marginBottom: spacing.md,
    },
    desc: {
        fontSize: typography.sizes.sm, color: colors.textMuted,
        textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl,
    },
    steps: { marginTop: spacing.sm },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
    stepBadgeCol: { alignItems: 'center', width: 40 },
    stepBadge: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    stepNum: { color: colors.primary, fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },
    stepLine: { width: 2, height: 34, backgroundColor: colors.border, marginVertical: 2 },
    stepText: {
        flex: 1, fontSize: typography.sizes.md, color: colors.textDark,
        marginLeft: spacing.md, marginTop: spacing.xs, marginBottom: spacing.lg,
    },
    button: {
        backgroundColor: colors.primary, margin: spacing.lg,
        paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center',
    },
    buttonText: { color: '#FFFFFF', fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
});

export { BackgroundLocationScreen };
export default LocationGate;
