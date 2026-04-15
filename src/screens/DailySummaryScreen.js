import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    ScrollView
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../api/api';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';
import OfflineService, { CacheKeys } from '../services/OfflineService';

const DailySummaryScreen = ({ navigation }) => {
    const [dateQuery, setDateQuery] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchSummary = async () => {
        if (!dateQuery.match(/^\d{4}-\d{2}-\d{2}$/)) {
            Alert.alert("Error", "Please format date exactly as YYYY-MM-DD");
            return;
        }

        const cacheKey = `${CacheKeys.DAILY_SUMMARY}_${dateQuery}`;

        try {
            setLoading(true);

            // Load cached data first
            const cached = await OfflineService.get(cacheKey);
            if (cached.isCached && cached.data) {
                setSummary(cached.data);
                setLastUpdated(new Date(cached.timestamp));
            }

            // Try to fetch fresh data
            if (await api.isOnline()) {
                const res = await api.getHistoricalSummary(dateQuery);
                const data = res.data;
                
                if (data && Object.keys(data).length > 0) {
                    setSummary(data);
                    setLastUpdated(new Date());
                    setIsOffline(false);
                    await OfflineService.set(cacheKey, data);
                }
            } else {
                setIsOffline(true);
                if (!cached.isCached) {
                    Alert.alert("Offline", "No cached data available for this date. Please connect to internet.");
                    setSummary(null);
                }
            }
        } catch (err) {
            console.log("Daily Summary Error:", err);
            
            // Fallback to cached data
            const cacheKey = `${CacheKeys.DAILY_SUMMARY}_${dateQuery}`;
            const cached = await OfflineService.get(cacheKey);
            
            if (cached.isCached && cached.data) {
                setSummary(cached.data);
                setLastUpdated(new Date(cached.timestamp));
                setIsOffline(true);
            } else {
                Alert.alert("Error", "Failed to load summary. Please try again.");
                setSummary(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const getTimeAgo = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return date.toLocaleDateString();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-IN', { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        } catch {
            return dateStr;
        }
    };

    const handleGoBack = () => {
        const state = navigation.getState();
        if (state && state.routes.length <= 1) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
            });
        } else {
            navigation.goBack();
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={handleGoBack}
                    style={styles.backBtn}
                >
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                    Daily Summary
                </Text>

                <TouchableOpacity
                    onPress={fetchSummary}
                    style={styles.refreshBtn}
                    disabled={loading}
                >
                    <Icon 
                        name="refresh-cw" 
                        size={20} 
                        color={loading ? colors.textMuted : colors.primary}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* OFFLINE BANNER */}
                {isOffline && (
                    <View style={styles.offlineBanner}>
                        <Icon name="wifi-off" size={16} color="#FFF" />
                        <Text style={styles.offlineText}>
                            Offline - Showing cached data
                        </Text>
                    </View>
                )}

                {/* FORM */}
                <GlassCard style={styles.formCard}>
                    <Text style={styles.formTitle}>Select Date</Text>
                    <Text style={styles.description}>
                        Enter a date to extract travel metrics from the archive.
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
                        style={{ marginTop: spacing.md }}
                    />

                    {lastUpdated && (
                        <View style={styles.lastUpdatedContainer}>
                            <Icon name="clock" size={12} color={colors.textMuted} />
                            <Text style={styles.lastUpdatedText}>
                                Last fetched: {getTimeAgo(lastUpdated)}
                            </Text>
                        </View>
                    )}
                </GlassCard>

                {/* RESULTS */}
                {loading && !summary ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading summary...</Text>
                    </View>
                ) : summary ? (
                    <>
                        <Text style={styles.resultDate}>{formatDate(summary.date || dateQuery)}</Text>

                        <GlassCard style={styles.heroCard}>
                            <View style={styles.heroMetric}>
                                <Icon name="map" size={24} color={colors.primary} />
                                <Text style={styles.heroValue}>
                                    {summary.total_distance_today || 0}
                                </Text>
                                <Text style={styles.heroUnit}>km</Text>
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
                                <View style={styles.detailLeft}>
                                    <Icon name="arrow-up-circle" size={18} color={colors.danger} />
                                    <Text style={styles.detailLabel}>Disbursements</Text>
                                </View>
                                <Text style={styles.detailValue}>
                                    ₹{summary.total_disbursement || 0}
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.detailRow}>
                                <View style={styles.detailLeft}>
                                    <Icon name="clock" size={18} color={colors.info} />
                                    <Text style={styles.detailLabel}>Time Tracked</Text>
                                </View>
                                <Text style={styles.detailValue}>
                                    {summary.duration || "0h 0m"}
                                </Text>
                            </View>
                        </GlassCard>

                        {/* Additional Info */}
                        <GlassCard style={styles.infoCard}>
                            <Text style={styles.infoTitle}>Summary</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Date:</Text>
                                <Text style={styles.infoValue}>{formatDate(summary.date)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Punches Recorded:</Text>
                                <Text style={styles.infoValue}>{summary.punch_count || 0}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Total Distance:</Text>
                                <Text style={styles.infoValue}>{summary.total_distance_today || 0} km</Text>
                            </View>
                        </GlassCard>
                    </>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Icon name="file-text" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>
                            Enter a date and tap "Extract Data" to view summary
                        </Text>
                    </View>
                )}
            </ScrollView>
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
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        marginRight: spacing.md,
    },
    refreshBtn: {
        marginLeft: 'auto',
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.md,
    },
    offlineText: {
        color: '#FFF',
        fontSize: typography.sizes.sm,
        marginLeft: spacing.sm,
    },
    formCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    formTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.xs,
    },
    description: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.md,
        lineHeight: 20
    },
    lastUpdatedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
    },
    lastUpdatedText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginLeft: spacing.xs,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textMuted,
    },
    resultDate: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    heroCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xl,
        marginBottom: spacing.md,
    },
    heroMetric: {
        flex: 1,
        alignItems: 'center',
    },
    heroValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginTop: spacing.sm,
    },
    heroUnit: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    heroLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        textAlign: 'center',
    },
    heroDivider: {
        width: 1,
        backgroundColor: colors.border,
        height: '80%',
        alignSelf: 'center',
    },
    detailCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    detailLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginLeft: spacing.sm,
    },
    detailValue: {
        fontSize: typography.sizes.md,
        fontWeight: 'bold',
        color: colors.textDark,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.xs,
    },
    infoCard: {
        padding: spacing.lg,
    },
    infoTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
    },
    infoLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    infoValue: {
        fontSize: typography.sizes.sm,
        fontWeight: '500',
        color: colors.textDark,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: typography.sizes.md,
        marginTop: spacing.md,
        textAlign: 'center',
        paddingHorizontal: spacing.lg,
    }
});
