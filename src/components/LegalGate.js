import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DeviceInfo from 'react-native-device-info';
import api, { setLegalRequiredCallback, resetLegalRequiredHandler } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme/tokens';

export const DOC_LABEL = {
    TERMS: 'Terms & Conditions',
    PRIVACY: 'Privacy Policy',
    LOCATION_TRACKING: 'Location & Tracking Notice',
};
const CHECK_TEXT = {
    TERMS: 'I have read and understood the Terms & Conditions.',
    PRIVACY: 'I acknowledge the Privacy Policy.',
    LOCATION_TRACKING: 'I acknowledge the Location & Field Activity Tracking Notice.',
};

export const DocumentText = ({ doc }) => (
    <View>
        <Text style={styles.meta}>
            Version {doc.version}{doc.effective_date ? ` · Effective ${doc.effective_date}` : ''}
        </Text>
        <Text style={styles.body}>{doc.content}</Text>
    </View>
);

/**
 * Blocks the signed-in user until every currently published legal document
 * version is acknowledged. The server (apps/legal) decides what is pending and
 * is the only place the record is kept. If it cannot be reached (offline in the
 * field) the user is let through rather than locked out; the check runs again
 * on the next launch/login.
 */
const LegalGate = ({ children }) => {
    const { logout } = useAuth();
    const [pending, setPending] = useState(null);       // null = loading
    const [checked, setChecked] = useState({});
    const [viewing, setViewing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const refresh = () => api.getLegalStatus()
        .then((r) => setPending(r?.data?.pending || []))
        .catch(() => setPending((p) => (p === null ? [] : p)));   // offline: keep whatever we had

    useEffect(() => {
        refresh();
    }, []);

    // A version can be published while the user is already past the gate
    // (this component then renders `children`, not the checklist below); the
    // server's 403 LEGAL_ACKNOWLEDGEMENT_REQUIRED on their next call is what
    // tells us to re-open it, rather than waiting for the next app launch.
    useEffect(() => {
        setLegalRequiredCallback(refresh);
        return () => resetLegalRequiredHandler();
    }, []);

    if (pending === null) {
        return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
    }
    if (pending.length === 0) return children;

    const allChecked = pending.every((d) => checked[d.id]);
    const submit = async () => {
        setSaving(true); setError('');
        try {
            await api.acknowledgeLegal({
                version_ids: pending.map((d) => d.id),
                platform: Platform.OS,
                app_version: DeviceInfo.getVersion(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            setPending([]);
        } catch (e) {
            setError(e?.response?.data?.error || 'Could not save your acknowledgement. Check your connection and try again.');
        } finally { setSaving(false); }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Terms, Privacy & Location Notice</Text>
                <Text style={styles.sub}>Please read and acknowledge the following before continuing.</Text>
                {pending.map((d) => (
                    <View key={d.id} style={styles.card}>
                        <TouchableOpacity style={styles.checkRow} activeOpacity={0.7}
                            onPress={() => setChecked({ ...checked, [d.id]: !checked[d.id] })}>
                            <Icon name={checked[d.id] ? 'check-square' : 'square'} size={22}
                                color={checked[d.id] ? colors.primary : colors.textMuted} />
                            <Text style={styles.checkText}>{CHECK_TEXT[d.doc_type] || d.title} (v{d.version})</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setViewing(d)}>
                            <Text style={styles.link}>View {DOC_LABEL[d.doc_type] || d.title}</Text>
                        </TouchableOpacity>
                    </View>
                ))}
                {!!error && <Text style={styles.error}>{error}</Text>}
                <TouchableOpacity style={[styles.btn, (!allChecked || saving) && styles.btnOff]}
                    disabled={!allChecked || saving} onPress={submit}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={logout}>
                    <Text style={[styles.link, { textAlign: 'center', marginTop: spacing.md }]}>Log out</Text>
                </TouchableOpacity>
            </ScrollView>
            <Modal visible={!!viewing} animationType="slide" onRequestClose={() => setViewing(null)}>
                <SafeAreaView style={styles.screen}>
                    <View style={styles.modalHead}>
                        <Text style={styles.modalTitle}>{viewing?.title}</Text>
                        <TouchableOpacity onPress={() => setViewing(null)}>
                            <Icon name="x" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.content}>{viewing && <DocumentText doc={viewing} />}</ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

export default LegalGate;

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: spacing.lg },
    title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
    sub: { color: colors.textMuted, marginBottom: spacing.lg },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
    checkRow: { flexDirection: 'row', alignItems: 'center' },
    checkText: { flex: 1, marginLeft: spacing.sm, color: colors.textPrimary },
    link: { color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },
    error: { color: colors.error, marginBottom: spacing.md },
    btn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
    btnOff: { opacity: 0.4 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    meta: { color: colors.textMuted, marginBottom: spacing.sm },
    body: { color: colors.textPrimary, lineHeight: 20 },
});
