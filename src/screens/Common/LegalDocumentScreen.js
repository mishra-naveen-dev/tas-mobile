import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/api';
import ScreenHeader from '../../components/ScreenHeader';
import { DOC_LABEL, DocumentText } from '../../components/LegalGate';
import { colors, spacing } from '../../theme/tokens';

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '');

// One screen for the three documents and for "My Acknowledgements" (docType 'MY').
const LegalDocumentScreen = ({ navigation, route }) => {
    const docType = route?.params?.docType;
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);
    // §14: open the exact document version that was acknowledged (may be superseded).
    const [openAck, setOpenAck] = useState(null);

    useEffect(() => {
        const call = docType === 'MY' ? api.getMyAcknowledgements() : api.getLegalDocuments();
        call.then((r) => setData(r?.data || [])).catch(() => { setData([]); setFailed(true); });
    }, [docType]);

    const doc = docType !== 'MY' && data ? data.find((d) => d.doc_type === docType) : null;
    return (
        <SafeAreaView style={styles.screen}>
            <ScreenHeader title={docType === 'MY' ? 'My Acknowledgements' : DOC_LABEL[docType] || 'Legal'} navigation={navigation} />
            {data === null ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
                <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
                    {failed && <Text style={styles.muted}>Could not load. Check your connection.</Text>}
                    {docType !== 'MY' && (doc
                        ? <DocumentText doc={doc} />
                        : !failed && <Text style={styles.muted}>This document has not been published yet.</Text>)}
                    {docType === 'MY' && (data.length === 0 && !failed
                        ? <Text style={styles.muted}>No acknowledgements yet.</Text>
                        : data.map((a, i) => (
                            <View key={i} style={styles.card}>
                                <Text style={styles.name}>{DOC_LABEL[a.doc_type] || a.doc_type}</Text>
                                <Text style={styles.muted}>v{a.version} · Accepted {fmt(a.accepted_at)}</Text>
                                <Text style={styles.muted}>
                                    {a.is_current === false ? 'Accepted · superseded' : 'Accepted'}
                                    {a.app_version ? ` · ${a.platform || ''} ${a.app_version}`.trim() : ''}
                                </Text>
                                <TouchableOpacity style={styles.viewBtn} onPress={() => setOpenAck(openAck === i ? null : i)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`View ${DOC_LABEL[a.doc_type] || a.doc_type} v${a.version}`}>
                                    <Text style={styles.viewText}>{openAck === i ? 'Hide document' : 'View document'}</Text>
                                </TouchableOpacity>
                                {openAck === i && (
                                    <View style={styles.ackedBody}>
                                        <DocumentText doc={a} />
                                    </View>
                                )}
                            </View>
                        )))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

export default LegalDocumentScreen;

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
    name: { fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    muted: { color: colors.textMuted },
    viewBtn: { marginTop: spacing.sm },
    viewText: { color: colors.primary, fontWeight: '600' },
    ackedBody: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: spacing.sm },
});
