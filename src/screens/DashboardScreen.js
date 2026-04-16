import React, { useState, useContext, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { AuthContext } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import PrimaryButton from '../components/PrimaryButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, typography, spacing, shadows } from '../theme/tokens';

const DashboardScreen = ({ navigation }) => {
    const { token, user, logout } = useContext(AuthContext);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [summary, setSummary] = useState({});
    const [punches, setPunches] = useState([]);
    const [filterType, setFilterType] = useState('ALL');
    const [showFilter, setShowFilter] = useState(false);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!token) return;

        try {
            if (!isRefresh) setLoading(true);

            // 1. Immediately inject cached resilient offline data first for hyper-fast UX
            try {
                const cachedSummary = await AsyncStorage.getItem('@dashboard_summary');
                const cachedPunches = await AsyncStorage.getItem('@dashboard_punches');
                if (cachedSummary) setSummary(JSON.parse(cachedSummary));
                if (cachedPunches) setPunches(JSON.parse(cachedPunches));
            } catch (cacheErr) {
                console.log("-> Cache read fault:", cacheErr);
            }

            // 2. Fetch Live data from Render Cloud
            const [summaryRes, punchRes] = await Promise.all([
                api.get(`/attendance/punches/daily_summary/?t=${Date.now()}`),
                api.get(`/attendance/punches/today_punches/?t=${Date.now()}`),
            ]);

            const liveSummary = summaryRes?.data || {};
            const livePunches = punchRes?.data?.results || punchRes?.data || [];

            // 3. Render Live Data and securely cache it!
            setSummary(liveSummary);
            setPunches(livePunches);

            AsyncStorage.setItem('@dashboard_summary', JSON.stringify(liveSummary));
            AsyncStorage.setItem('@dashboard_punches', JSON.stringify(livePunches));

        } catch (err) {
            console.log("-> Dashboard network fault (falling back to offline cache):", err?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useFocusEffect(
        useCallback(() => {
            fetchData(false);
        }, [fetchData])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(true);
    };

    const renderActivityItem = ({ item }) => (
        <View style={styles.activityItem}>
            <View style={styles.activityIconWrapper}>
                <Icon
                    name={item?.visit_type?.includes('COLLECT') ? 'dollar-sign' : 'map-pin'}
                    size={20}
                    color={colors.primary}
                />
            </View>
            <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>{item?.visit_type || 'Location Ping'}</Text>
                <Text style={styles.activityTime}>
                    {item?.punched_at ? new Date(item.punched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </Text>
            </View>
        </View>
    );

    // ================= MAP ROUTE EXTRACTION =================
    const validRoutePoints = (punches || [])
        .filter(p => p.latitude && p.longitude)
        .sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at))
        .map(p => ({
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
        }));

    if (loading && !refreshing && Object.keys(summary).length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const filteredPunches = punches.filter(p => {
        if (filterType === 'ALL') return true;
        return p.visit_type === filterType;
    });

    //  REPLACE RETURN BLOCK ONLY

    return (
        <SafeAreaView style={styles.container}>

            <FlatList
                data={filteredPunches}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderActivityItem}
                showsVerticalScrollIndicator={false}

                // ================= HEADER =================
                ListHeaderComponent={
                    <>
                        {/* HEADER */}
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.greeting}>
                                    Hello, {user?.username || 'Officer'}
                                </Text>
                                <Text style={styles.dateText}>
                                    {new Date().toDateString()}
                                </Text>
                            </View>

                            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                                <Icon name="log-out" size={24} color={colors.danger} />
                            </TouchableOpacity>
                        </View>

                        {/* HERO */}
                        <GlassCard style={styles.heroCard}>
                            <View style={styles.heroMetric}>
                                <Icon name="map" size={24} color={colors.primary} />
                                <Text style={styles.heroValue}>
                                    {summary?.total_distance_today || 0} km
                                </Text>
                                <Text style={styles.heroLabel}>Distance</Text>
                            </View>

                            <View style={styles.heroDivider} />

                            <View style={styles.heroMetric}>
                                <Icon name="check-circle" size={24} color={colors.success} />
                                <Text style={styles.heroValue}>
                                    {summary?.punch_count || 0}
                                </Text>
                                <Text style={styles.heroLabel}>Punches</Text>
                            </View>

                            <View style={styles.heroDivider} />

                            <View style={styles.heroMetric}>
                                <Icon name="briefcase" size={24} color={colors.warning} />
                                <Text style={styles.heroValue}>
                                    ₹{summary?.total_collection || 0}
                                </Text>
                                <Text style={styles.heroLabel}>Collected</Text>
                            </View>
                        </GlassCard>

                        {/* BUTTON */}
                        {/* <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
                            <PrimaryButton
                                title="Submit Travel Claim"
                                onPress={() =>
                                    navigation.navigate('Allowance', {
                                        distance: summary?.total_distance_today || 0
                                    })
                                }
                            />
                        </View> */}

                        {/* MAP */}
                        {validRoutePoints.length > 0 && (
                            <TouchableOpacity 
                                style={styles.mapWrap}
                                onPress={() => navigation.navigate('RouteMap')}
                            >
                                <MapView
                                    style={styles.mapEmbed}
                                    initialRegion={{
                                        latitude: validRoutePoints[0]?.latitude || 23.0225,
                                        longitude: validRoutePoints[0]?.longitude || 72.5714,
                                        latitudeDelta: 0.05,
                                        longitudeDelta: 0.05,
                                    }}
                                >
                                    <Marker coordinate={validRoutePoints[0]} pinColor="green" />

                                    {validRoutePoints.length > 1 && (
                                        <>
                                            <Marker
                                                coordinate={validRoutePoints.at(-1)}
                                                pinColor="red"
                                            />
                                            <Polyline
                                                coordinates={validRoutePoints}
                                                strokeWidth={4}
                                                strokeColor="blue"
                                            />
                                        </>
                                    )}
                                </MapView>
                                <View style={styles.mapOverlayButton}>
                                    <Icon name="maximize-2" size={14} color="#fff" />
                                    <Text style={styles.mapOverlayButtonText}>View Full Route</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* SECTION TITLE */}
                        <View style={styles.listHeaderRow}>

                            <Text style={styles.sectionTitle}>
                                Today's Activity
                            </Text>

                            <TouchableOpacity
                                style={styles.filterBtn}
                                onPress={() => setShowFilter(!showFilter)}
                            >
                                <Icon name="filter" size={18} color={colors.primary} />
                                <Text style={styles.filterText}>{filterType}</Text>
                            </TouchableOpacity>

                        </View>

                        {/* FILTER OPTIONS */}
                        {showFilter && (
                            <View style={styles.filterDropdown}>

                                {['ALL', 'COLLECTION', 'DISBURSEMENT'].map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        style={styles.filterItem}
                                        onPress={() => {
                                            setFilterType(type);
                                            setShowFilter(false);
                                        }}
                                    >
                                        <Text style={styles.filterItemText}>{type}</Text>
                                    </TouchableOpacity>
                                ))}

                            </View>
                        )}
                    </>
                }

                // ================= EMPTY STATE =================
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        No activity recorded yet today.
                    </Text>
                }

                // ================= REFRESH =================
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }

                contentContainerStyle={{
                    paddingHorizontal: spacing.md,
                    paddingBottom: 140,
                }}
            />

            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, shadows.floating]}
                onPress={() => navigation.navigate('Punch')}
            >
                <Icon name="plus" size={32} color="#FFF" />
            </TouchableOpacity>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        padding: spacing.lg,
        paddingTop: spacing.md
    },
    greeting: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    dateText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    logoutBtn: {
        padding: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: 12,
        ...shadows.soft,
    },
    heroCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        paddingVertical: spacing.xl,
        backgroundColor: colors.surface,
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
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    heroDivider: {
        width: 1,
        backgroundColor: colors.border,
        height: '80%',
        alignSelf: 'center',
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: spacing.md,
        marginTop: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activityIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    activityDetails: {
        flex: 1,
    },
    activityTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    activityTime: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.lg,
    },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapWrap: {
        height: 180,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        borderRadius: 12,
        overflow: 'hidden',
    },
    mapEmbed: {
        flex: 1,
        width: '100%',
    },
    mapOverlayButton: {
        position: 'absolute',
        bottom: spacing.sm,
        right: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 4,
    },
    mapOverlayButtonText: {
        color: '#fff',
        fontSize: typography.sizes.xs,
        marginLeft: spacing.xs,
    },
    listHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        marginTop: spacing.xl,
    },

    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },

    filterText: {
        marginLeft: 6,
        fontSize: 12,
        color: colors.textDark,
        fontWeight: '600',
    },

    filterDropdown: {
        marginHorizontal: spacing.md,
        marginTop: 6,
        backgroundColor: colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },

    filterItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },

    filterItemText: {
        fontSize: 14,
        color: colors.textDark,
    }
});

export default DashboardScreen;