import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const EmployeeTrackingScreen = ({ navigation, route }) => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/tracking/employees/');
            setEmployees(res.data?.results || res.data || []);
            setError(null);
        } catch (err) {
            setError('Failed to load tracking data. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const formatTime = (time) => {
        if (!time) return 'N/A';
        return new Date(time).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderEmployee = ({ item }) => (
        <TouchableOpacity
            style={[styles.trackingCard, selectedEmployee?.id === item.id && styles.selectedCard]}
            onPress={() => setSelectedEmployee(item)}
        >
            <View style={styles.cardHeader}>
                <View style={styles.employeeInfo}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {(item.name || 'E').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View>
                        <Text style={styles.employeeName}>{item.name}</Text>
                        <Text style={styles.employeeId}>{item.employee_id}</Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.today_punches > 0 ? colors.success + '20' : colors.textMuted + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: item.today_punches > 0 ? colors.success : colors.textMuted }]} />
                    <Text style={[styles.statusText, { color: item.today_punches > 0 ? colors.success : colors.textMuted }]}>
                        {item.today_punches > 0 ? 'Active' : 'Offline'}
                    </Text>
                </View>
            </View>

            <View style={styles.cardStats}>
                <View style={styles.statItem}>
                    <Icon name="map-pin" size={16} color={colors.primary} />
                    <Text style={styles.statValue}>{item.today_punches || 0}</Text>
                    <Text style={styles.statLabel}>Punches</Text>
                </View>
                <View style={styles.statItem}>
                    <Icon name="navigation" size={16} color={colors.info} />
                    <Text style={styles.statValue}>{(parseFloat(item.distance) || 0).toFixed(1)}</Text>
                    <Text style={styles.statLabel}>km</Text>
                </View>
                <View style={styles.statItem}>
                    <Icon name="dollar-sign" size={16} color={colors.success} />
                    <Text style={styles.statValue}>{(parseFloat(item.collection) || 0).toFixed(0)}</Text>
                    <Text style={styles.statLabel}>Collected</Text>
                </View>
            </View>

            {item.last_login && (
                <View style={styles.lastActive}>
                    <Icon name="clock" size={12} color={colors.textMuted} />
                    <Text style={styles.lastActiveText}>Last active: {formatTime(item.last_login)}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Employee Tracking"
                subtitle={`${employees.length} employees tracked`}
                navigation={navigation}
            />

            <View style={styles.infoBar}>
                <Icon name="info" size={16} color={colors.info} />
                <Text style={styles.infoText}>Click on an employee to view their route</Text>
            </View>

            {loading && employees.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={employees}
                    keyExtractor={(item, index) => item.id ? `track_${item.id}` : `track-${index}`}
                    renderItem={renderEmployee}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        error ? (
                            <View style={styles.emptyContainer}>
                                <Icon name="alert-circle" size={48} color={colors.danger} />
                                <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
                                <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
                                    <Text style={styles.retryBtnText}>Try Again</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Icon name="map-pin" size={48} color={colors.textLight} />
                                <Text style={styles.emptyText}>No tracking data available</Text>
                            </View>
                        )
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    infoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.infoLight,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    infoText: {
        fontSize: typography.sizes.sm,
        color: colors.info,
        marginLeft: spacing.sm,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    trackingCard: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
        elevation: 2,
    },
    selectedCard: {
        borderWidth: 2,
        borderColor: colors.primary,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    employeeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    employeeName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    employeeId: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 12,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
    },
    cardStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginTop: 4,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    lastActive: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    lastActiveText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginLeft: spacing.xs,
    },
    emptyContainer: {
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginTop: spacing.md,
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: spacing.md,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: 24,
    },
    retryBtnText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
});

export default EmployeeTrackingScreen;
