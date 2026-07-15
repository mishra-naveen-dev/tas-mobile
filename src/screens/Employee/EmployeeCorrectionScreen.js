import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    FlatList,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import HeroHeader from '../../components/HeroHeader';
import { colors, typography, spacing } from '../../theme/tokens';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const MAX_EDITS = 3;

const EmployeeCorrectionScreen = ({ navigation }) => {
    const auth = useAuth();
    const user = auth?.user;
    const [corrections, setCorrections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('ALL');
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    const fetchCorrections = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const res = await api.get('/attendance/correction-requests/');
            if (Array.isArray(res.data)) {
                setCorrections(res.data);
            } else if (Array.isArray(res.data?.results)) {
                setCorrections(res.data.results);
            } else {
                setCorrections([]);
            }
        } catch (err) {
            setError('Failed to load corrections');
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

    const handleEdit = (item) => {
        navigation.navigate('PunchCorrection', {
            editMode: true,
            correctionId: item.id,
            existingData: item,
            editsLeft: MAX_EDITS - (item.edit_count || 0),
        });
    };

    const handleDelete = (item) => {
        Alert.alert(
            'Delete Request',
            'Are you sure you want to delete this correction request? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => confirmDelete(item.id),
                },
            ]
        );
    };

    const confirmDelete = async (id) => {
        setDeletingId(id);
        try {
            await api.deleteCorrectionRequest(id);
            setCorrections(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to delete request.';
            Alert.alert('Error', msg);
        } finally {
            setDeletingId(null);
        }
    };

    const getStatusColor = (status) => {
        if (status?.includes('APPROVED')) return colors.success;
        if (status?.includes('REJECTED')) return colors.danger;
        if (status === 'PENDING') return colors.warning;
        return colors.textMuted;
    };

    const getStatusLabel = (status) => {
        if (status === 'PENDING') return 'Pending';
        if (status === 'APPROVED') return 'Approved';
        if (status === 'REJECTED') return 'Rejected';
        if (status === 'ADMIN_APPROVED') return 'Approved by Admin';
        if (status === 'ADMIN_REJECTED') return 'Rejected by Admin';
        if (status === 'SUPERADMIN_APPROVED') return 'Approved';
        if (status === 'SUPERADMIN_REJECTED') return 'Rejected';
        return status || 'Unknown';
    };

    const filteredCorrections = corrections.filter(item => {
        if (selectedFilter === 'ALL') return true;
        if (selectedFilter === 'APPROVED') return item.status?.includes('APPROVED');
        if (selectedFilter === 'REJECTED') return item.status?.includes('REJECTED');
        return item.status === 'PENDING';
    });

    const filters = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        // Handle both "HH:MM:SS" and ISO strings
        if (timeString.includes('T')) {
            return new Date(timeString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        }
        const [h, m] = timeString.split(':');
        const d = new Date();
        d.setHours(+h, +m);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const renderCorrection = ({ item }) => {
        const isPending = item.status === 'PENDING';
        const editCount = item.edit_count || 0;
        const canEdit = isPending && editCount < MAX_EDITS;
        const canDelete = isPending;
        const isDeleting = deletingId === item.id;

        return (
            <View style={styles.correctionCard}>
                {/* Header row */}
                <View style={styles.correctionHeader}>
                    <View style={styles.dateTimeContainer}>
                        <Text style={styles.correctionDate}>{formatDate(item.correction_date)}</Text>
                        <Text style={styles.correctionTime}>{formatTime(item.correction_time)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {getStatusLabel(item.status)}
                        </Text>
                    </View>
                </View>

                {/* Body */}
                <View style={styles.correctionBody}>
                    <View style={styles.infoRow}>
                        <Icon name="edit-3" size={14} color={colors.textMuted} />
                        <Text style={styles.infoLabel}>Type:</Text>
                        <Text style={styles.infoValue}>{item.correction_type || 'N/A'}</Text>
                    </View>
                    {item.from_address ? (
                        <View style={styles.infoRow}>
                            <Icon name="map-pin" size={14} color={colors.textMuted} />
                            <Text style={styles.infoLabel}>From:</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{item.from_address}</Text>
                        </View>
                    ) : null}
                    {item.to_address ? (
                        <View style={styles.infoRow}>
                            <Icon name="map-pin" size={14} color={colors.primary} />
                            <Text style={styles.infoLabel}>To:</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{item.to_address}</Text>
                        </View>
                    ) : null}
                    {item.calculated_distance > 0 && (
                        <View style={styles.infoRow}>
                            <Icon name="navigation" size={14} color={colors.textMuted} />
                            <Text style={styles.infoLabel}>Distance:</Text>
                            <Text style={styles.infoValue}>{item.calculated_distance} km</Text>
                        </View>
                    )}
                    {item.reason ? (
                        <View style={styles.infoRow}>
                            <Icon name="message-circle" size={14} color={colors.textMuted} />
                            <Text style={styles.infoLabel}>Reason:</Text>
                            <Text style={styles.infoValue} numberOfLines={2}>{item.reason}</Text>
                        </View>
                    ) : null}
                    {item.reviewed_by_name ? (
                        <View style={styles.infoRow}>
                            <Icon name="user-check" size={14} color={colors.textMuted} />
                            <Text style={styles.infoLabel}>Reviewed by:</Text>
                            <Text style={styles.infoValue}>{item.reviewed_by_name}</Text>
                        </View>
                    ) : null}
                    {item.review_comment ? (
                        <View style={styles.infoRow}>
                            <Icon name="message-square" size={14} color={colors.textMuted} />
                            <Text style={styles.infoLabel}>Comment:</Text>
                            <Text style={styles.infoValue}>{item.review_comment}</Text>
                        </View>
                    ) : null}

                    {/* Edit count badge for pending items */}
                    {isPending && (
                        <View style={styles.editCountRow}>
                            <Icon name="edit" size={12} color={editCount >= MAX_EDITS ? colors.danger : colors.textMuted} />
                            <Text style={[styles.editCountText, editCount >= MAX_EDITS && styles.editCountExhausted]}>
                                Edits used: {editCount}/{MAX_EDITS}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Action buttons — only for PENDING */}
                {(canEdit || canDelete) && (
                    <View style={styles.actionRow}>
                        {canEdit && (
                            <TouchableOpacity
                                style={styles.editBtn}
                                onPress={() => handleEdit(item)}
                                disabled={isDeleting}
                            >
                                <Icon name="edit-2" size={14} color={colors.primary} />
                                <Text style={styles.editBtnText}>
                                    Edit ({MAX_EDITS - editCount} left)
                                </Text>
                            </TouchableOpacity>
                        )}
                        {canDelete && (
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={() => handleDelete(item)}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color={colors.danger} />
                                ) : (
                                    <>
                                        <Icon name="trash-2" size={14} color={colors.danger} />
                                        <Text style={styles.deleteBtnText}>Delete</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <HeroHeader
                user={user}
                role="Employee"
                showStatus={false}
                onLogout={auth?.logout}
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

            {error ? (
                <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={15} color={colors.danger} />
                    <Text style={styles.errorBannerText}>{error}</Text>
                    <TouchableOpacity onPress={fetchCorrections}>
                        <Text style={styles.retryLink}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {loading && filteredCorrections.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={filteredCorrections}
                    renderItem={renderCorrection}
                    keyExtractor={(item, index) => String(item?.id || index)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="file-text" size={48} color={colors.textLight} />
                            <Text style={styles.emptyText}>No correction requests found</Text>
                        </View>
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
        gap: spacing.xs,
    },
    correctionDate: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
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
        gap: 4,
    },
    infoLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginRight: 2,
    },
    infoValue: {
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        flex: 1,
    },
    editCountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: spacing.xs,
    },
    editCountText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    editCountExhausted: {
        color: colors.danger,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    editBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}10`,
    },
    editBtnText: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        color: colors.primary,
    },
    deleteBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.danger,
        backgroundColor: `${colors.danger}10`,
    },
    deleteBtnText: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        color: colors.danger,
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
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        borderRadius: 10,
        padding: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
        gap: 8,
    },
    errorBannerText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.danger,
    },
    retryLink: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        fontWeight: '600',
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
