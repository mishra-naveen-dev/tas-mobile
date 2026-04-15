import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../api/api';
import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';

const PunchHistoryScreen = ({ navigation }) => { // ✅ added navigation

    const [punches, setPunches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.getPunchHistory();
                const data = res.data?.results || res.data || [];
                setPunches(data);
            } catch (err) {
                console.log("Punch History Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const renderItem = ({ item }) => (
        <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>

                <View style={styles.typeBadge}>
                    <Icon
                        name={item.visit_type === 'COLLECTION' ? 'dollar-sign' : 'map-pin'}
                        size={14}
                        color="#FFF"
                    />
                    <Text style={styles.typeText}>
                        {item.visit_type || 'NORMAL'}
                    </Text>
                </View>

                <Text style={styles.timeText}>
                    {new Date(item.punched_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </Text>
            </View>

            <View style={styles.detailRow}>
                <Icon name="calendar" size={16} color={colors.textMuted} />
                <Text style={styles.detailText}>
                    {new Date(item.punch_date).toDateString()}
                </Text>
            </View>

            <View style={styles.detailRow}>
                <Icon name="navigation" size={16} color={colors.textMuted} />
                <Text style={styles.detailText}>
                    {item.latitude}, {item.longitude}
                </Text>
            </View>

            <View style={styles.distanceBox}>
                <Text style={styles.distanceLabel}>Distance from last:</Text>
                <Text style={styles.distanceValue}>
                    {item.distance_from_last || 0} km
                </Text>
            </View>
        </GlassCard>
    );

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

                <Text style={styles.headerTitle}>Punch History</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>

            ) : punches.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>No punches found.</Text>
                </View>

            ) : (
                <FlatList
                    data={punches}
                    keyExtractor={(item, index) =>
                        item.id ? item.id.toString() : index.toString()
                    } // ✅ safe fallback
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </SafeAreaView>
    );
};

export default PunchHistoryScreen;


// ================= STYLES =================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background
    },

    header: {
        flexDirection: 'row',              // ✅ NEW
        alignItems: 'center',              // ✅ NEW
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

    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },

    emptyText: {
        color: colors.textMuted,
        fontSize: typography.sizes.md
    },

    listContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl
    },

    card: {
        marginBottom: spacing.md,
        padding: spacing.md
    },

    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm
    },

    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12
    },

    typeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4
    },

    timeText: {
        fontSize: typography.sizes.sm,
        fontWeight: 'bold',
        color: colors.textDark
    },

    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6
    },

    detailText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginLeft: 8
    },

    distanceBox: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between'
    },

    distanceLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted
    },

    distanceValue: {
        fontSize: typography.sizes.sm,
        fontWeight: 'bold',
        color: colors.textDark
    }
});