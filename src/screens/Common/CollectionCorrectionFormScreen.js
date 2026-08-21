import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import api from '../../api/api';
import LocationService from '../../services/LocationService';
import { enqueue, registerReplayer, isNetworkError } from '../../services/OfflineQueue';

import { colors, typography, spacing } from '../../theme/tokens';

// Registering this at module load (as before) only guarantees the
// replayer exists once this screen has been opened at least once this
// session. If the app is killed with a COLLECTION_CORRECTION item still
// queued and relaunched straight into a drain attempt without the user
// ever revisiting this screen, OfflineQueue.processQueue() would find no
// replayer for it and leave it (and everything queued behind it) stuck.
// App.jsx now calls this explicitly at startup instead, exactly like
// registerCollectionVisitOfflineReplayer(), so the replayer is always
// registered regardless of navigation history.
export function registerCollectionCorrectionOfflineReplayer() {
    registerReplayer('COLLECTION_CORRECTION', async (payload) => {
        const fd = new FormData();
        fd.append('collection_record', payload.collectionRecordId);
        fd.append('requested_amount', payload.amount);
        fd.append('reason', payload.reason);
        if (payload.remarks) fd.append('remarks', payload.remarks);
        if (payload.latitude) fd.append('latitude', String(payload.latitude));
        if (payload.longitude) fd.append('longitude', String(payload.longitude));
        if (payload.document) {
            fd.append('supporting_document', {
                uri: payload.document.uri,
                type: payload.document.type || 'image/jpeg',
                name: payload.document.fileName || 'correction_document.jpg',
            });
        }
        await api.createCollectionCorrection(fd);
    });
}

const REASON_MIN_LENGTH = 10;

const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

// Handles both create (route.params.record = the CollectionRecord being
// corrected) and edit (route.params.editMode + correctionId + existingData
// = the CollectionCorrectionRequest, only reachable while it's
// RETURNED_FOR_CORRECTION — see apps/loans/views.py::edit()).
const CollectionCorrectionFormScreen = ({ navigation, route }) => {
    const editMode = route?.params?.editMode || false;
    const correctionId = route?.params?.correctionId || null;
    const existingData = route?.params?.existingData || null;
    const record = route?.params?.record || null;

    const latestVersion = existingData?.versions?.[existingData.versions.length - 1];

    const [amount, setAmount] = useState(latestVersion ? String(latestVersion.requested_amount) : '');
    const [reason, setReason] = useState(latestVersion?.reason || '');
    const [remarks, setRemarks] = useState(latestVersion?.remarks || '');
    const [editReason, setEditReason] = useState('');
    const [document, setDocument] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const originalAmount = existingData?.original_collected_amount ?? record?.collected_amount;

    const pickDocument = (fromCamera) => {
        const options = { mediaType: 'photo', quality: 0.7, includeBase64: false };
        const cb = (result) => {
            if (result.didCancel || result.errorCode) return;
            const asset = result.assets?.[0];
            if (asset) setDocument(asset);
        };
        if (fromCamera) launchCamera(options, cb);
        else launchImageLibrary(options, cb);
    };

    const validate = () => {
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            setError('Enter a valid corrected amount.');
            return false;
        }
        if (!reason || reason.trim().length < REASON_MIN_LENGTH) {
            setError(`Reason must be at least ${REASON_MIN_LENGTH} characters.`);
            return false;
        }
        if (editMode && (!editReason || editReason.trim().length < 5)) {
            setError('Please explain what changed in this edit.');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        setError('');
        if (!validate()) return;

        setSubmitting(true);
        // Declared outside the outer try block so the catch handler can
        // still queue it for offline sync on a network failure.
        let coords = {};
        try {
            try {
                const loc = await LocationService.getCurrentLocation();
                if (loc?.latitude && loc?.longitude) {
                    coords = { latitude: loc.latitude, longitude: loc.longitude };
                }
            } catch (e) {
                // GPS is best-effort here — never block a correction request over it.
            }

            const fd = new FormData();
            if (!editMode) fd.append('collection_record', record.id);
            fd.append('requested_amount', amount);
            fd.append('reason', reason.trim());
            if (remarks.trim()) fd.append('remarks', remarks.trim());
            if (editMode) fd.append('edit_reason', editReason.trim());
            if (coords.latitude) fd.append('latitude', String(coords.latitude));
            if (coords.longitude) fd.append('longitude', String(coords.longitude));
            if (document) {
                fd.append('supporting_document', {
                    uri: document.uri,
                    type: document.type || 'image/jpeg',
                    name: document.fileName || 'correction_document.jpg',
                });
            }

            if (editMode) {
                await api.editCollectionCorrection(correctionId, fd);
                Alert.alert('Success', `Correction request updated and resubmitted for approval.\n\n${fmtDateTime(new Date())}`, [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } else {
                await api.createCollectionCorrection(fd);
                Alert.alert('Success', `Correction request submitted for approval.\n\n${fmtDateTime(new Date())}`, [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            }
        } catch (err) {
            if (!editMode && isNetworkError(err)) {
                await enqueue('COLLECTION_CORRECTION', {
                    collectionRecordId: record.id,
                    amount,
                    reason: reason.trim(),
                    remarks: remarks.trim(),
                    latitude: coords.latitude || null,
                    longitude: coords.longitude || null,
                    document,
                });
                Alert.alert(
                    'Saved — will sync automatically',
                    "No internet connection right now. Your correction request has been saved on this device and will upload automatically once you're back online."
                        + `\n\n${fmtDateTime(new Date())}`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }],
                );
                return;
            }
            const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Failed to submit correction request.';
            setError(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setSubmitting(false);
        }
    };

    const FieldLabel = ({ children, required }) => (
        <Text style={styles.fieldLabel}>
            {children}{required && <Text style={styles.required}> *</Text>}
        </Text>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{editMode ? 'Edit Correction' : 'Request Correction'}</Text>
                <View style={{ width: 40 }} />
            </View>

            {editMode && (
                <View style={styles.editModeBanner}>
                    <Icon name="corner-up-left" size={14} color={colors.warning} />
                    <Text style={styles.editModeBannerText}>
                        This request was returned for correction — edit and resubmit.
                    </Text>
                </View>
            )}

            {error ? (
                <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={20} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {(record || existingData) && (
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLoan}>Loan ID: {record?.loan_id || existingData?.loan_id}</Text>
                        <Text style={styles.summaryCustomer}>{record?.customer_name || existingData?.customer_name}</Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Original Collected Amount</Text>
                            <Text style={styles.summaryValue}>
                                ₹{Number(originalAmount || 0).toLocaleString('en-IN')}
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <FieldLabel required>Corrected Amount (₹)</FieldLabel>
                    <TextInput
                        style={[styles.input, submitting && styles.inputDisabled]}
                        value={amount}
                        onChangeText={(t) => { setAmount(t.replace(/[^0-9.]/g, '')); setError(''); }}
                        placeholder="Enter the correct amount"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        editable={!submitting}
                    />
                </View>

                <View style={styles.section}>
                    <FieldLabel required>Reason for Correction</FieldLabel>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={reason}
                        onChangeText={(t) => { setReason(t); setError(''); }}
                        placeholder={`Explain why this correction is needed (min ${REASON_MIN_LENGTH} characters)`}
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        editable={!submitting}
                    />
                    <Text style={styles.charCount}>{reason.length} / {REASON_MIN_LENGTH} characters minimum</Text>
                </View>

                <View style={styles.section}>
                    <FieldLabel>Remarks (Optional)</FieldLabel>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={remarks}
                        onChangeText={setRemarks}
                        placeholder="Any additional notes for the approver"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={!submitting}
                    />
                </View>

                {editMode && (
                    <View style={styles.section}>
                        <FieldLabel required>What changed in this edit?</FieldLabel>
                        <TextInput
                            style={[styles.input, submitting && styles.inputDisabled]}
                            value={editReason}
                            onChangeText={(t) => { setEditReason(t); setError(''); }}
                            placeholder="e.g. Attached proof requested by manager"
                            placeholderTextColor={colors.textMuted}
                            editable={!submitting}
                        />
                    </View>
                )}

                <View style={styles.section}>
                    <FieldLabel>Supporting Document (Optional)</FieldLabel>
                    {document ? (
                        <View style={styles.documentPreview}>
                            <Image source={{ uri: document.uri }} style={styles.documentImage} />
                            <TouchableOpacity style={styles.removeDocBtn} onPress={() => setDocument(null)}>
                                <Icon name="x-circle" size={20} color={colors.danger} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.docButtonRow}>
                            <TouchableOpacity style={styles.docBtn} onPress={() => pickDocument(true)} disabled={submitting}>
                                <Icon name="camera" size={18} color={colors.primary} />
                                <Text style={styles.docBtnText}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.docBtn} onPress={() => pickDocument(false)} disabled={submitting}>
                                <Icon name="image" size={18} color={colors.primary} />
                                <Text style={styles.docBtnText}>Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.8}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Icon name={editMode ? 'send' : 'send'} size={20} color="#FFFFFF" />
                            <Text style={styles.submitBtnText}>{editMode ? 'Resubmit for Approval' : 'Submit Request'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    editModeBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#FFF8E1', borderBottomWidth: 1, borderBottomColor: '#FFE082',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    editModeBannerText: { flex: 1, fontSize: typography.sizes.sm, color: '#F57F17', fontWeight: '600' },
    errorBanner: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerLight,
        padding: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: 12,
    },
    errorText: { flex: 1, fontSize: typography.sizes.sm, color: colors.danger, marginLeft: spacing.sm },
    scrollView: { flex: 1 },
    scrollContent: { padding: spacing.md, paddingBottom: 100 },
    summaryCard: {
        backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    summaryLoan: { fontSize: typography.sizes.sm, color: colors.textMuted },
    summaryCustomer: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark, marginTop: 2 },
    summaryRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    },
    summaryLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
    summaryValue: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textDark },
    section: { marginBottom: spacing.lg },
    fieldLabel: { fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing.xs },
    required: { color: colors.danger },
    input: {
        backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
        fontSize: typography.sizes.md, color: colors.textDark,
    },
    inputDisabled: { opacity: 0.5 },
    textArea: { height: 100, textAlignVertical: 'top' },
    charCount: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
    docButtonRow: { flexDirection: 'row', gap: spacing.sm },
    docBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: colors.surface, borderRadius: 12, paddingVertical: spacing.md,
        borderWidth: 1.5, borderColor: colors.primary,
    },
    docBtnText: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.primary },
    documentPreview: { position: 'relative', alignSelf: 'flex-start' },
    documentImage: { width: 120, height: 120, borderRadius: 12 },
    removeDocBtn: {
        position: 'absolute', top: -8, right: -8, backgroundColor: colors.surface, borderRadius: 12,
    },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary, padding: spacing.md, borderRadius: 12, marginTop: spacing.md,
        elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    submitBtnDisabled: { opacity: 0.7 },
    submitBtnText: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: '#FFFFFF', marginLeft: spacing.sm },
});

export default CollectionCorrectionFormScreen;
