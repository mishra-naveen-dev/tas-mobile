import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity // ✅ NEW
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../api/api';
import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';

const AllowanceHistoryScreen = ({ navigation }) => { // ✅ navigation added

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.getAllowanceHistory();
                const data = res.data?.results || res.data || [];
                setRequests(data);
            } catch (err) {
                console.log("Allowance History Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return colors.success;
            case 'REJECTED': return colors.danger;
            default: return colors.warning;
        }
    };

    const renderItem = ({ item }) => (
        <GlassCard style={styles.card}>

            <View style={styles.cardHeader}>
                <Text style={styles.dateText}>{item.travel_date}</Text>

                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) + '20' }
                    ]}
                >
                    <Text
                        style={[
                            styles.statusText,
                            { color: getStatusColor(item.status) }
                        ]}
                    >
                        {item.status}
                    </Text>
                </View>
            </View>

            <View style={styles.routeBox}>
                <View style={styles.node}>
                    <Icon name="circle" size={12} color={colors.primary} />
                    <Text style={styles.nodeText} numberOfLines={1}>
                        {item.from_location}
                    </Text>
                </View>

                <View style={styles.line} />

                <View style={styles.node}>
                    <Icon name="map-pin" size={12} color={colors.danger} />
                    <Text style={styles.nodeText} numberOfLines={1}>
                        {item.to_location}
                    </Text>
                </View>
            </View>

            <View style={styles.footer}>
                <View>
                    <Text style={styles.label}>Distance</Text>
                    <Text style={styles.value}>
                        {item.total_distance} km
                    </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.label}>Claim Amount</Text>
                    <Text style={[styles.value, { color: colors.success }]}>
                        ₹{item.total_amount}
                    </Text>
                </View>
            </View>

        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container}>

            {/* ✅ UPDATED HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                >
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                    Allowance History
                </Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>

            ) : requests.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>
                        No allowance claims found.
                    </Text>
                </View>

            ) : (
                <FlatList
                    data={requests}
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

export default AllowanceHistoryScreen;


// ================= STYLES =================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background
    },

    header: {
        flexDirection: 'row',          // ✅ NEW
        alignItems: 'center',          // ✅ NEW
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
        padding: spacing.lg
    },

    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md
    },

    dateText: {
        fontSize: typography.sizes.md,
        fontWeight: 'bold',
        color: colors.textDark
    },

    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },

    statusText: {
        fontSize: 10,
        fontWeight: 'bold'
    },

    routeBox: {
        marginBottom: spacing.md
    },

    node: {
        flexDirection: 'row',
        alignItems: 'center'
    },

    nodeText: {
        marginLeft: 8,
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        flex: 1
    },

    line: {
        width: 2,
        height: 16,
        backgroundColor: colors.border,
        marginLeft: 5,
        marginVertical: 2
    },

    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.md
    },

    label: {
        fontSize: 10,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },

    value: {
        fontSize: typography.sizes.md,
        fontWeight: 'bold',
        color: colors.textDark,
        marginTop: 2
    }
});