import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Modal,
    Platform,
    AppState,
    BackHandler,
    AccessibilityInfo,
} from 'react-native';
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

// Exact per-document acknowledgement labels (§3/§4). Never preselect any of them.
export const CHECK_TEXT = {
    TERMS: 'I have read and accept the Terms & Conditions',
    PRIVACY: 'I have read and accept the Privacy Policy',
    LOCATION_TRACKING: 'I have read and accept the Location & Tracking Notice',
};

export const GATE_TITLE = 'Legal & Privacy';
export const GATE_SUBTITLE =
    'Please review and accept the following documents before continuing.';
// Shown when the employee already acknowledged older versions (§15).
export const NEW_DOCS_SUBTITLE =
    'New Legal & Privacy documents require your acknowledgement.';
export const ACCEPT_LABEL = 'Accept & Continue';
export const SUCCESS_MESSAGE = 'Legal & Privacy consent recorded successfully.';
export const SUBMIT_ERROR_MESSAGE = 'Unable to record your consent. Please try again.';

export const DocumentText = ({ doc }) => (
    <View>
        <Text style={styles.meta}>
            Version {doc.version}{doc.effective_date ? ` · Effective ${doc.effective_date}` : ''}
        </Text>
        <Text style={styles.body}>{doc.content}</Text>
    </View>
);

/**
 * Central legal/privacy gate (§4-§6, §17).
 *
 * Wraps the authenticated navigators in RootNavigator, so it runs for every
 * authenticated surface: cold start, biometric/session restore, logout->login,
 * force-password-change, deep links and offline sync. It never renders for a
 * logged-out user (no checkboxes on the login screen, §3).
 *
 * FAIL-CLOSED: while the policy status is unknown or /legal/status/ fails,
 * the authenticated area is not reachable — the screen shows an error with
 * Retry (§17). Only an explicit server response with no pending mandatory
 * document opens the app. The backend is the source of truth: the
 * acknowledgement record lives server-side (append-only), so it survives
 * logout, reinstall and cache clearing.
 */
const LegalGate = ({ children }) => {
    const { logout } = useAuth();
    const [pending, setPending] = useState(null);   // null = checking (fail-closed)
    const [docs, setDocs] = useState([]);           // every published doc + acknowledged flag
    const [checked, setChecked] = useState({});     // {versionId: bool} — never preselected
    const [viewing, setViewing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [accepted, setAccepted] = useState(false);// brief success state
    const [error, setError] = useState('');
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const applyStatus = useCallback((payload) => {
        if (!mountedRef.current) return;
        const pendingList = Array.isArray(payload?.pending) ? payload.pending : [];
        const all = Array.isArray(payload?.documents) ? payload.documents : [];
        setDocs(all);
        setPending(pendingList);
        // No checkbox is ever preselected (§7).
        const next = {};
        pendingList.forEach((d) => { next[d.id] = false; });
        setChecked(next);
        if (pendingList.length > 0) setAccepted(false);
    }, []);

    const refresh = useCallback(() => {
        setError('');
        return api.getLegalStatus()
            .then((r) => applyStatus(r?.data))
            .catch((e) => {
                if (!mountedRef.current) return;
                // Fail closed (§17): the status is unknown, so the app stays
                // behind the gate with an explicit error + Retry. Never a
                // silent allow, never a silent lock without a way out.
                setPending(null);
                setError(
                    e?.response?.data?.error ||
                    'Unable to verify legal document status. Check your connection and try again.'
                );
            });
    }, [applyStatus]);

    // Runs on mount: app start, session restore, logout->login, force change.
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Server-side enforcement: a 403 LEGAL_ACKNOWLEDGEMENT_REQUIRED from any
    // business endpoint re-opens the gate mid-session (a new mandatory
    // version was published). Tokens stay valid; only business calls are
    // blocked server-side.
    useEffect(() => {
        setLegalRequiredCallback(refresh);
        return () => resetLegalRequiredHandler();
    }, [refresh]);

    // Recheck when returning to the foreground (ack done on another device
    // or a document published meanwhile).
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active' && pending !== null && pending.length > 0) refresh();
        });
        return () => sub.remove();
    }, [refresh, pending]);

    // Android Back must not reach Home while blocked (§10) — stay here.
    const blocked = pending === null || pending.length > 0;
    useEffect(() => {
        if (!blocked) return undefined;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => sub.remove();
    }, [blocked]);

    const alreadyAcked = useMemo(
        () => docs.filter((d) => d.acknowledged && !(pending || []).some((p) => p.id === d.id)),
        [docs, pending]
    );
    const optionalDocs = useMemo(
        () => docs.filter((d) => !d.mandatory && !d.acknowledged),
        [docs]
    );
    // §15: employees who accepted older versions get the "new documents" wording.
    const subtitle = (pending || []).length > 0 && alreadyAcked.length > 0
        ? NEW_DOCS_SUBTITLE : GATE_SUBTITLE;

    const allChecked = (pending || []).length > 0 && (pending || []).every((d) => checked[d.id]);

    const submit = async () => {
        if (!allChecked || saving) return;
        setSaving(true);
        setError('');
        try {
            const r = await api.acknowledgeLegal({
                version_ids: (pending || []).map((d) => d.id),
                platform: Platform.OS,
                app_version: DeviceInfo.getVersion(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            if (!mountedRef.current) return;
            const payload = r?.data || {};
            // The backend re-checks after storing: enter only when it says
            // nothing is pending anymore (never trust local state alone).
            if (payload?.requires_acknowledgement) {
                applyStatus(payload);
                setError('Some documents still require acknowledgement. Please try again.');
                return;
            }
            applyStatus({ pending: [], documents: payload?.documents || docs });
            setAccepted(true);
            AccessibilityInfo.announceForAccessibility?.(
                'Legal & Privacy consent recorded successfully.'
            );
            setTimeout(() => { if (mountedRef.current) setAccepted(false); }, 1500);
        } catch (e) {
            if (!mountedRef.current) return;
            // §12: never enter on failure, keep the ticked boxes, say exactly why.
            setError(e?.response?.data?.error || SUBMIT_ERROR_MESSAGE);
        } finally {
            if (mountedRef.current) setSaving(false);
        }
    };

    const tick = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

    const renderCard = (doc, { checkbox }) => (
        <View key={doc.id} style={styles.card}>
            <View style={styles.cardHead}>
                <Icon
                    name={doc.doc_type === 'PRIVACY' ? 'shield' : doc.doc_type === 'LOCATION_TRACKING' ? 'map-pin' : 'file-text'}
                    size={20}
                    color={colors.primary}
                />
                {/* §3/§5: the document name itself opens the published text. */}
                <TouchableOpacity onPress={() => setViewing(doc)} accessibilityRole="link"
                    accessibilityLabel={`Open ${DOC_LABEL[doc.doc_type] || doc.title}`}
                    style={styles.cardTitleBtn}>
                    <Text style={[styles.cardTitle, styles.cardTitleLink]}>
                        {DOC_LABEL[doc.doc_type] || doc.title} (v{doc.version})
                    </Text>
                </TouchableOpacity>
                {doc.acknowledged ? (
                    <View style={styles.badge}>
                        <Icon name="check-circle" size={12} color={colors.success || '#059669'} />
                        <Text style={styles.badgeText}>Acknowledged</Text>
                    </View>
                ) : null}
            </View>
            {!!doc.effective_date && <Text style={styles.meta}>Effective {doc.effective_date}</Text>}
            <TouchableOpacity onPress={() => setViewing(doc)} accessibilityRole="link"
                accessibilityLabel={`View ${DOC_LABEL[doc.doc_type] || doc.title}`}>
                <Text style={styles.link}>View {DOC_LABEL[doc.doc_type] || doc.title}</Text>
            </TouchableOpacity>
            {checkbox ? (
                <TouchableOpacity style={styles.checkRow} activeOpacity={0.7}
                    onPress={() => tick(doc.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!checked[doc.id] }}
                    accessibilityLabel={CHECK_TEXT[doc.doc_type] || `I acknowledge ${DOC_LABEL[doc.doc_type] || doc.title}.`}>
                    <Icon name={checked[doc.id] ? 'check-square' : 'square'} size={22}
                        color={checked[doc.id] ? colors.primary : colors.textMuted} />
                    <Text style={styles.checkText}>
                        {CHECK_TEXT[doc.doc_type] || `I acknowledge ${DOC_LABEL[doc.doc_type] || doc.title}.`}
                    </Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );

    // ── fail-closed loading / error (app area never renders in these states) ──
    if (pending === null) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.center}>
                    {error ? (
                        <View style={styles.errorBox}>
                            <Icon name="alert-circle" size={22} color={colors.error} />
                            <Text style={styles.error}>{error}</Text>
                            <TouchableOpacity style={styles.retryBtn} onPress={refresh}
                                accessibilityRole="button" accessibilityLabel="Retry">
                                <Icon name="refresh-cw" size={16} color="#fff" />
                                <Text style={styles.retryText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <ActivityIndicator color={colors.primary} />
                            <Text style={styles.loadingText}>Checking policy status…</Text>
                        </>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    if (pending.length === 0 && !accepted) return children;

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Icon name="file-text" size={28} color={colors.primary} />
                    <Text style={styles.title} accessibilityRole="header">{GATE_TITLE}</Text>
                    <Text style={styles.sub}>{subtitle}</Text>
                </View>

                {accepted ? (
                    <View style={styles.successBox}>
                        <Icon name="check-circle" size={30} color={colors.success || '#059669'} />
                        <Text style={styles.successText}>{SUCCESS_MESSAGE}</Text>
                    </View>
                ) : null}

                {(pending || []).map((d) => renderCard(d, { checkbox: true }))}
                {optionalDocs.map((d) => renderCard(d, { checkbox: false }))}
                {alreadyAcked.map((d) => renderCard(d, { checkbox: false }))}

                {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

                {(pending || []).length > 0 ? (
                    <TouchableOpacity
                        style={[styles.btn, (!allChecked || saving) && styles.btnOff]}
                        disabled={!allChecked || saving}
                        onPress={submit}
                        accessibilityRole="button"
                        accessibilityLabel={ACCEPT_LABEL}
                        accessibilityState={{ disabled: !allChecked || saving, checked: allChecked }}>
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>{ACCEPT_LABEL}</Text>}
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity onPress={logout} accessibilityRole="button">
                    <Text style={[styles.link, { textAlign: 'center', marginTop: spacing.md }]}>Log out</Text>
                </TouchableOpacity>
            </ScrollView>

            <Modal visible={!!viewing} animationType="slide" onRequestClose={() => setViewing(null)}>
                <SafeAreaView style={styles.screen}>
                    <View style={styles.modalHead}>
                        <Text style={styles.modalTitle}>{viewing?.title}</Text>
                        <TouchableOpacity onPress={() => setViewing(null)} accessibilityLabel="Close"
                            accessibilityRole="button">
                            <Icon name="x" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.content}>
                        {viewing ? <DocumentText doc={viewing} /> : null}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

export default LegalGate;

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    loadingText: { color: colors.textMuted, marginTop: spacing.sm, fontSize: 13 },
    content: { padding: spacing.lg, paddingTop: spacing.xl * 2 },
    header: { alignItems: 'center', marginBottom: spacing.lg },
    title: { fontSize: 21, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' },
    sub: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center', lineHeight: 20 },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#E2E8F0' },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { flex: 1, fontWeight: '700', color: colors.textPrimary, fontSize: 15 },
    cardTitleBtn: { flex: 1 },
    cardTitleLink: { textDecorationLine: 'underline' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    badgeText: { color: colors.success || '#059669', fontSize: 11, fontWeight: '700' },
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md, gap: spacing.sm },
    checkText: { flex: 1, color: colors.textPrimary, lineHeight: 20 },
    link: { color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },
    error: { color: colors.error, marginBottom: spacing.md, marginTop: spacing.sm },
    errorBox: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.error,
        paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
    retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    successBox: { alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', borderRadius: 12,
        padding: spacing.md, marginBottom: spacing.md },
    successText: { color: '#065F46', fontWeight: '600' },
    btn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: spacing.sm },
    btnOff: { opacity: 0.4 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    meta: { color: colors.textMuted, marginBottom: spacing.sm, fontSize: 12 },
    body: { color: colors.textPrimary, lineHeight: 20 },
});
