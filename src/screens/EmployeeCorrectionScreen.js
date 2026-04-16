import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    FlatList,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import HeroHeader from '../components/HeroHeader';
import { colors, typography, spacing } from '../theme/tokens';

const EmployeeCorrectionScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;
    const [corrections, setCorrections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('ALL');

    const fetchCorrections = useCallback(async () => {
        try {
            const res = await api.getMyCorrectionRequests();
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
            setCorrections(data);
        } catch (err) {
            console.log('Error fetching corrections:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        fetchCorrections();
    }, [fetchCorrections]));

    const onRefresh = () => {
        setRefreshing(true);
        fetchCorrections();
    };

    const handleLogout = () => {
        auth.logout();
        if (auth.navigationRef?.current) {
            auth.navigationRef.current.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toUpperCase()) {
            case 'APPROVED': return colors.success;
            case 'REJECTED': return colors.danger;
            case 'PENDING': return colors.warning;
            default: return colors.textMuted;
        }
    };

    const filteredCorrections = corrections.filter(item => {
        if (selectedFilter === 'ALL') return true;
        return item.status?.toUpperCase() === selectedFilter;
    });

    const filters = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderCorrection = ({ item }) => (
        <View style={styles.correctionCard}>
            <View style={styles.correctionHeader}>
                <View style={styles.dateTimeContainer}>
                    <Text style={styles.correctionDate}>{formatDate(item.requested_at)}</Text>
                    <Text style={styles.correctionTime}>{formatTime(item.requested_at)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status || 'PENDING'}
                    </Text>
                </View>
            </View>
            <View style={styles.correctionBody}>
                <View style={styles.infoRow}>
                    <Icon name="clock" size={16} color={colors.textMuted} />
                    <Text style={styles.infoLabel}>Punch Time:</Text>
                    <Text style={styles.infoValue}>{item.punch_time || 'N/A'}</Text>
                </View>
                {item.reason && (
                    <View style={styles.infoRow}>
                        <Icon name="message-circle" size={16} color={colors.textMuted} />
                        <Text style={styles.infoLabel}>Reason:</Text>
                        <Text style={styles.infoValue}>{item.reason}</Text>
                    </View>
                )}
                {item.admin_comment && (
                    <View style={styles.infoRow}>
                        <Icon name="check-circle" size={16} color={colors.textMuted} />
                        <Text style={styles.infoLabel}>Admin Comment:</Text>
                        <Text style={styles.infoValue}>{item.admin_comment}</Text>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <HeroHeader
                user={user}
                role="Employee"
                showStatus={false}
                onLogout={handleLogout}
            />

            <TouchableOpacity 
                style={styles.createBtn}
                onPress={() => navigation.navigate('PunchCorrection')}
                activeOpacity={0.8}
            >
                <Icon name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.createBtnText}>New Correction</Text>
            </TouchableOpacity>

            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {filters.map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
                            onPress={() => setSelectedFilter(filter)}
                        >
                            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredCorrections}
                renderItem={renderCorrection}
                keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="file-text" size={48} color={colors.textLight} />
                        <Text style={styles.emptyText}>
                            {loading ? 'Loading...' : 'No correction requests found'}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    filterContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: 20,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: '500',
    },
    filterTextActive: {
        color: colors.surface,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 140,
    },
    correctionCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.sm,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    correctionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    dateTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    correctionDate: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginRight: spacing.sm,
    },
    correctionTime: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
    },
    correctionBody: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    infoLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginLeft: spacing.xs,
        marginRight: spacing.xs,
    },
    infoValue: {
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        flex: 1,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: 12,
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    createBtnText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        marginLeft: spacing.sm,
    },
});

export default EmployeeCorrectionScreen;
