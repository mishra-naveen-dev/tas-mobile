import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { isPhone } from '../../common/helpers/validationHelpers';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const STATUS_META = {
    PENDING:  { label: 'Pending Review', color: colors.warning, bg: colors.warningLight, icon: 'clock' },
    APPROVED: { label: 'Approved',       color: colors.success, bg: colors.successLight, icon: 'check-circle' },
    REJECTED: { label: 'Rejected',       color: colors.danger,  bg: colors.dangerLight,  icon: 'x-circle' },
};

const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '';

const ProfileUpdateRequestScreen = ({ navigation }) => {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [phone, setPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const res = await api.getProfileUpdateRequests();
            const data = res.data;
            const list = Array.isArray(data) ? data : (data?.results || []);
            // Newest first, regardless of what order the server returns.
            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setRequests(list);
        } catch (err) {
            Alert.alert('Error', 'Could not load your profile update requests.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const pendingRequest = requests.find(r => r.status === 'PENDING');
    const history = requests.filter(r => r.status !== 'PENDING');

    const handleSubmit = async () => {
        if (!phone.trim()) {
            Alert.alert('Required', 'Please enter the phone number you want on file.');
            return;
        }
        if (!isPhone(phone)) {
            Alert.alert('Invalid', 'Enter a valid 10-digit phone number.');
            return;
        }
        setSubmitting(true);
        try {
            await api.createProfileUpdateRequest({ phone: phone.trim() });
            setPhone('');
            Alert.alert('Submitted', 'Your profile update request has been sent for approval.');
            load();
        } catch (err) {
            const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Failed to submit request.';
            Alert.alert('Error', Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile Update Request</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}
            >
                {loading ? (
                    <View style={{ marginTop: spacing.md }}>
                        {[1, 2].map(i => <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />)}
                    </View>
                ) : pendingRequest ? (
                    <View style={styles.pendingCard}>
                        <View style={[styles.statusChip, { backgroundColor: STATUS_META.PENDING.bg, alignSelf: 'flex-start' }]}>
                            <Icon name={STATUS_META.PENDING.icon} size={13} color={STATUS_META.PENDING.color} />
                            <Text style={[styles.statusChipText, { color: STATUS_META.PENDING.color }]}>Pending Review</Text>
                        </View>
                        <Text style={styles.pendingTitle}>You already have a request awaiting approval</Text>
                        {!!pendingRequest.phone && (
                            <Text style={styles.pendingDetail}>Requested phone: {pendingRequest.phone}</Text>
                        )}
                        <Text style={styles.pendingDetail}>Submitted {fmtDateTime(pendingRequest.created_at)}</Text>
                        <Text style={styles.pendingHint}>You can submit a new request once this one is reviewed.</Text>
                    </View>
                ) : (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Request a Phone Number Update</Text>
                        <Text style={styles.formSub}>
                            Current on file: {user?.phone || 'Not set'}
                        </Text>
                        <Text style={styles.fieldLabel}>New Phone Number *</Text>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                            placeholder="10-digit mobile number"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                            maxLength={10}
                            editable={!submitting}
                        />
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.85}
                        >
                            {submitting ? <ActivityIndicator size="small" color="#fff" /> : (
                                <>
                                    <Icon name="send" size={16} color="#fff" />
                                    <Text style={styles.submitBtnText}>Submit Request</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {history.length > 0 && (
                    <>
                        <Text style={styles.historyTitle}>Request History</Text>
                        {history.map((r) => {
                            const meta = STATUS_META[r.status] || STATUS_META.REJECTED;
                            return (
                                <View key={r.id} style={styles.historyCard}>
                                    <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
                                    <View style={styles.historyBody}>
                                        <View style={styles.historyHeader}>
                                            <Text style={styles.historyPhone}>{r.phone || 'Profile change'}</Text>
                                            <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
                                                <Icon name={meta.icon} size={12} color={meta.color} />
                                                <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.historyMeta}>Submitted {fmtDateTime(r.created_at)}</Text>
                                        {r.status !== 'PENDING' && !!r.updated_at && (
                                            <Text style={styles.historyMeta}>
                                                {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} {fmtDateTime(r.updated_at)}
                                                {r.approved_by_name ? ` by ${r.approved_by_name}` : ''}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: '#fff' },
    headerSpacer: { width: 38 },
    scrollContent: { padding: spacing.md, paddingBottom: 100 },

    formCard: {
        backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md,
        borderLeftWidth: 4, borderLeftColor: colors.primary, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
    },
    formTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark },
    formSub: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 4, marginBottom: spacing.sm },
    fieldLabel: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.textMedium, marginBottom: spacing.xs },
    input: {
        borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: typography.sizes.md, color: colors.textDark,
    },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm, marginTop: spacing.md,
    },
    submitBtnDisabled: { opacity: 0.7 },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.sizes.md },

    pendingCard: {
        backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md,
        borderLeftWidth: 4, borderLeftColor: colors.warning, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
    },
    pendingTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark, marginTop: spacing.sm },
    pendingDetail: { fontSize: typography.sizes.sm, color: colors.textMedium, marginTop: 4 },
    pendingHint: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: spacing.sm },

    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.md },
    statusChipText: { fontSize: 11, fontWeight: '700' },

    historyTitle: {
        fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, color: colors.textMuted,
        textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm,
    },
    historyCard: {
        flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12,
        marginBottom: spacing.sm, overflow: 'hidden', elevation: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2,
    },
    cardAccent: { width: 4 },
    historyBody: { flex: 1, padding: spacing.sm },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyPhone: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.textDark },
    historyMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
});

export default ProfileUpdateRequestScreen;
