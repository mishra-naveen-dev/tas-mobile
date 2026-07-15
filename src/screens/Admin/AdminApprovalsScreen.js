import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const AdminApprovalsScreen = ({ navigation }) => {
    const [allowances, setAllowances] = useState([]);
    const [corrections, setCorrections] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('AdminDashboard');
        }
    };

const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            console.log('[AdminApprovals] Fetching...');
            
            // Fetch corrections
            const correctionRes = await api.get('/attendance/correction-requests/');
            const correctionData = correctionRes?.data || [];
            const correctionsList = Array.isArray(correctionData) ? correctionData : (correctionData?.results || []);
            
            console.log('[AdminApprovals] Corrections:', correctionsList.length);
            
            // Fetch allowances
            const allowanceRes = await api.get('/allowance/requests/');
            const allowanceList = allowanceRes?.data || [];
            const allowancesData = Array.isArray(allowanceList) ? allowanceList : (allowanceList?.results || []);
            
            // Fetch devices
            const deviceRes = await api.get('/organization/devices/');
            const deviceList = deviceRes?.data || [];
            const devicesData = Array.isArray(deviceList) ? deviceList : (deviceList?.results || []);
            
            // Filter pending for display
            const pendingCorrections = correctionsList.filter(c => c.status === 'PENDING');
            const pendingAllowances = allowancesData.filter(a => a.status === 'PENDING');
            const pendingDevices = devicesData.filter(d => d.status === 'PENDING');
            
            setCorrections(pendingCorrections);
            setAllowances(pendingAllowances);
            setDevices(pendingDevices);
            
            console.log('[AdminApprovals] Pending corrections:', pendingCorrections.length);
        } catch (err) {
            console.log('[AdminApprovals] Error:', err);
            Alert.alert('Error', 'Failed to load');
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

const handleApprove = async (type, id) => {
        try {
            if (type === 'allowance') {
                await api.approveAllowance(id, 'APPROVED');
            } else if (type === 'correction') {
                await api.reviewCorrection(id, 'APPROVE');
            } else if (type === 'device') {
                await api.approveDevice(id, 'APPROVED');
            }
            Alert.alert('Success', 'Approved successfully');
            fetchData();
        } catch (err) {
            Alert.alert('Error', 'Failed to approve');
        }
    };

    const handleReject = async (type, id) => {
        Alert.prompt(
            'Reject Request',
            'Please provide a reason for rejection:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async (reason) => {
                        try {
                            if (type === 'allowance') {
                                await api.approveAllowance(id, 'REJECTED');
                            } else if (type === 'correction') {
                                await api.reviewCorrection(id, 'REJECT', reason || '');
                            } else if (type === 'device') {
                                await api.approveDevice(id, 'REJECTED');
                            }
                            Alert.alert('Success', 'Rejected successfully');
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to reject');
                        }
                    }
                }
            ],
            'plain-default'
        );
    };

    const renderCorrectionItem = ({ item }) => {
        console.log('[AdminApprovals] Rendering correction item:', item);
        return (
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>
                        {item.employee_name || item.employee?.first_name || 'Employee'}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                        {item.correction_type} Punch | {item.correction_date} {item.correction_time}
                    </Text>
                    <Text style={styles.detailText}>
                        📍 From: {item.from_address || 'N/A'}
                    </Text>
                    {item.to_address ? (
                        <Text style={styles.detailText}>
                            📍 To: {item.to_address}
                        </Text>
                    ) : null}
                    <Text style={styles.detailText}>
                        📏 Distance: {item.calculated_distance || 0} km
                    </Text>
                    {item.reason ? (
                        <Text style={styles.detailText}>
                            📝 Reason: {item.reason}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleApprove('correction', item.id)}
                    >
                        <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleReject('correction', item.id)}
                    >
                        <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderItem = ({ item, type }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>
                    {type === 'allowance' ? `${item.employee_name} - ₹${item.total_amount}` :
                     type === 'correction' ? `${item.employee_name} - ${item.correction_type}` :
                      `${item.username} - ${item.device_name}`}
                </Text>
                <Text style={styles.cardSubtitle}>
                    {type === 'allowance' ? `${item.total_distance} km | ${item.travel_date}` :
                     type === 'correction' ? `${item.correction_date} | ${item.from_address}` :
                      `${item.platform} | ${item.browser} on ${item.os}`}
                </Text>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleApprove(type, item.id)}
                >
                    <Text style={styles.actionBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleReject(type, item.id)}
                >
                    <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const tabs = [
        { title: 'Allowances', count: allowances.length },
        { title: 'Corrections', count: corrections.length },
        { title: 'Devices', count: devices.length }
    ];

    const currentData = activeTab === 0 ? allowances : activeTab === 1 ? corrections : devices;
    const currentType = activeTab === 0 ? 'allowance' : activeTab === 1 ? 'correction' : 'device';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Pending Approvals</Text>
                    <Text style={styles.headerSubtitle}>Review and take action</Text>
                </View>
                <View style={styles.headerRight} />
            </View>

            <View style={styles.tabContainer}>
                {tabs.map((tab, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.tab, activeTab === index && styles.activeTab]}
                        onPress={() => setActiveTab(index)}
                    >
                        <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>
                            {tab.title} ({tab.count})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading && currentData.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={currentData}
                    keyExtractor={(item, index) => item?.id ? String(item.id) : String(index)}
                    renderItem={({ item }) => {
                        if (currentType === 'correction') {
                            return renderCorrectionItem({ item });
                        }
                        return renderItem({ item, type: currentType });
                    }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="check-circle" size={48} color={colors.success} />
                            <Text style={styles.emptyText}>No pending items</Text>
                            <Text style={styles.emptySubtext}>All caught up!</Text>
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
    header: {
        backgroundColor: colors.primaryDark,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        paddingTop: spacing.lg,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: typography.sizes.sm,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    headerRight: {
        width: 44,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
        marginHorizontal: 4,
    },
    activeTab: {
        backgroundColor: colors.primary,
    },
    tabText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textMuted,
    },
    activeTabText: {
        color: colors.white,
        fontWeight: typography.weights.bold,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: colors.surface,
        marginBottom: spacing.md,
        padding: spacing.md,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardContent: {
        marginBottom: spacing.md,
    },
    cardTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    cardSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    approveBtn: {
        backgroundColor: colors.success,
    },
    rejectBtn: {
        backgroundColor: colors.danger,
    },
    actionBtnText: {
        color: colors.white,
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.sm,
    },
    emptyContainer: {
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
});

export default AdminApprovalsScreen;
