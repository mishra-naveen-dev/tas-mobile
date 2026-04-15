import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
    TouchableOpacity // ✅ NEW
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../api/api';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';

const DailySummaryScreen = ({ navigation }) => { // ✅ navigation added

    const [dateQuery, setDateQuery] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchSummary = async () => {
        if (!dateQuery.match(/^\d{4}-\d{2}-\d{2}$/)) {
            Alert.alert("Error", "Please format date exactly as YYYY-MM-DD");
            return;
        }

        try {
            setLoading(true);
            const res = await api.getHistoricalSummary(dateQuery);
            setSummary(res.data);
        } catch (err) {
            const msg =
                err.response?.data?.error || "Failed to load summary.";
            Alert.alert("Error", msg);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>

            {/* ✅ UPDATED HEADER WITH BACK BUTTON */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                >
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                    Daily Summary Extraction
                </Text>
            </View>

            {/* FORM */}
            <View style={styles.formPanel}>
                <Text style={styles.description}>
                    Target a specific Date to mathematically extrapolate all tracker metrics from the archive.
                </Text>

                <InputField
                    icon="calendar"
                    placeholder="YYYY-MM-DD"
                    value={dateQuery}
                    onChangeText={setDateQuery}
                />

                <PrimaryButton
                    title="Extract Data"
                    onPress={fetchSummary}
                    loading={loading}
                    style={{ marginTop: spacing.xs }}
                />
            </View>

            {/* LOADING */}
            {loading ? (
                <ActivityIndicator
                    size="large"
                    color={colors.primary}
                    style={{ marginTop: spacing.xl }}
                />

            ) : summary ? (

                /* RESULTS */
                <View style={styles.resultsPanel}>

                    <GlassCard style={styles.heroCard}>
                        <View style={styles.heroMetric}>
                            <Icon name="map" size={24} color={colors.primary} />
                            <Text style={styles.heroValue}>
                                {summary.total_distance_today || 0}
                                <Text style={styles.heroUnit}> km</Text>
                            </Text>
                            <Text style={styles.heroLabel}>Total Distance</Text>
                        </View>

                        <View style={styles.heroDivider} />

                        <View style={styles.heroMetric}>
                            <Icon name="check-circle" size={24} color={colors.success} />
                            <Text style={styles.heroValue}>
                                {summary.punch_count || 0}
                            </Text>
                            <Text style={styles.heroLabel}>Total Visits</Text>
                        </View>

                        <View style={styles.heroDivider} />

                        <View style={styles.heroMetric}>
                            <Icon name="briefcase" size={24} color={colors.warning} />
                            <Text style={styles.heroValue}>
                                ₹{summary.total_collection || 0}
                            </Text>
                            <Text style={styles.heroLabel}>Collected</Text>
                        </View>
                    </GlassCard>

                    <GlassCard style={styles.detailCard}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Disbursements:</Text>
                            <Text style={styles.detailValue}>
                                ₹{summary.total_disbursement || 0}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Total Time Tracked:</Text>
                            <Text style={styles.detailValue}>
                                {summary.duration || "0h 0m"}
                            </Text>
                        </View>
                    </GlassCard>

                </View>

            ) : null}

        </SafeAreaView>
    );
};

export default DailySummaryScreen;


// ================= STYLES =================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background
    },

    header: {
        flexDirection: 'row',           // ✅ NEW
        alignItems: 'center',           // ✅ NEW
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },

    backBtn: {
        marginRight: spacing.md,
    },

    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark
    },

    formPanel: {
        padding: spacing.lg
    },

    description: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.md,
        lineHeight: 20
    },

    resultsPanel: {
        paddingHorizontal: spacing.lg
    },

    heroCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xl,
        marginBottom: spacing.md
    },

    heroMetric: {
        flex: 1,
        alignItems: 'center'
    },

    heroValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginTop: spacing.sm
    },

    heroUnit: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted
    },

    heroLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2
    },

    heroDivider: {
        width: 1,
        backgroundColor: colors.border
    },

    detailCard: {
        padding: spacing.lg
    },

    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm
    },

    detailLabel: {
        fontSize: typography.sizes.md,
        color: colors.textMuted
    },

    detailValue: {
        fontSize: typography.sizes.md,
        fontWeight: 'bold',
        color: colors.textDark
    }
});