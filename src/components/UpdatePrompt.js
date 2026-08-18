import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, ActivityIndicator, BackHandler, AppState } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import DeviceInfo from 'react-native-device-info';
import api from '../api/api';
import { colors, typography, spacing } from '../theme/tokens';

// A sideloaded (non-Play-Store) APK can never silently install an update —
// Android always requires a human tap to confirm the install, no matter how
// this is built. What this component *can* do is notice a new release
// sooner: on first mount, whenever the app returns to the foreground, and
// on a standing timer while it stays open — instead of only once per cold
// launch. Every check fails silent on any network/API error (a courtesy
// prompt, not a gate, except when the release is explicitly `mandatory`).
const RECHECK_INTERVAL_MS = 20 * 60 * 1000;

const UpdatePrompt = () => {
    const [release, setRelease] = useState(null);
    const [dismissed, setDismissed] = useState(false);
    const [opening, setOpening] = useState(false);
    // Which version_code "Later" was tapped for — re-checking must not
    // re-open the same prompt every cycle, but a *newer* release than the
    // one dismissed should still surface.
    const dismissedVersionRef = useRef(null);

    const checkForUpdate = useCallback(async () => {
        try {
            const versionCode = parseInt(DeviceInfo.getBuildNumber(), 10);
            if (!versionCode) return;
            const res = await api.checkMobileRelease(versionCode);
            const latest = res.data?.latest;
            if (res.data?.update_available && latest) {
                if (latest.version_code === dismissedVersionRef.current) return;
                setDismissed(false);
                setRelease(latest);
            }
        } catch (e) {
            if (__DEV__) console.warn('[UpdatePrompt] Check failed (non-fatal):', e.message);
        }
    }, []);

    useEffect(() => {
        checkForUpdate();

        const appStateSub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') checkForUpdate();
        });
        const interval = setInterval(checkForUpdate, RECHECK_INTERVAL_MS);

        return () => {
            appStateSub.remove();
            clearInterval(interval);
        };
    }, [checkForUpdate]);

    // A mandatory update blocks the hardware back button too — there's
    // nothing else on screen to go back to.
    useEffect(() => {
        if (!release?.mandatory) return undefined;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => sub.remove();
    }, [release]);

    const handleUpdate = async () => {
        setOpening(true);
        try {
            const versionCode = release.version_code;
            const res = await api.getMobileReleaseDownloadUrl(versionCode);
            const url = res.data?.download_url;
            if (url) {
                await Linking.openURL(url);
            }
        } catch (e) {
            if (__DEV__) console.warn('[UpdatePrompt] Download link failed:', e.message);
        } finally {
            setOpening(false);
        }
    };

    if (!release || dismissed) return null;

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <Icon name="download-cloud" size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.title}>
                        {release.mandatory ? 'Update Required' : 'A New Version Is Available'}
                    </Text>
                    <Text style={styles.version}>Version {release.version_name}</Text>

                    {!!release.release_notes && (
                        <ScrollView style={styles.notesBox}>
                            <Text style={styles.notesText}>{release.release_notes}</Text>
                        </ScrollView>
                    )}

                    <Text style={styles.hint}>
                        Downloads the update in your browser. Once it finishes, open it to install — you may need to allow installs from this source if Android asks.
                    </Text>

                    <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} disabled={opening}>
                        {opening
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.updateBtnText}>Update Now</Text>}
                    </TouchableOpacity>

                    {!release.mandatory && (
                        <TouchableOpacity
                            style={styles.laterBtn}
                            onPress={() => {
                                dismissedVersionRef.current = release.version_code;
                                setDismissed(true);
                            }}
                        >
                            <Text style={styles.laterBtnText}>Later</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        alignItems: 'center',
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: typography.sizes?.lg || 18,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
    },
    version: {
        fontSize: typography.sizes?.sm || 13,
        color: colors.textMedium,
        marginTop: 4,
        marginBottom: spacing.sm,
    },
    notesBox: {
        maxHeight: 120,
        alignSelf: 'stretch',
        backgroundColor: colors.background,
        borderRadius: 10,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    notesText: {
        fontSize: typography.sizes?.sm || 13,
        color: colors.textMedium,
    },
    hint: {
        fontSize: typography.sizes?.xs || 11,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    updateBtn: {
        alignSelf: 'stretch',
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    updateBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: typography.sizes?.md || 15,
    },
    laterBtn: {
        marginTop: spacing.sm,
        paddingVertical: 6,
    },
    laterBtnText: {
        color: colors.textMuted,
        fontSize: typography.sizes?.sm || 13,
    },
});

export default UpdatePrompt;
