import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import { SkeletonListItem } from '../../components/SkeletonComponents';

const AdminDevicesScreen = ({ navigation }) => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [error, setError] = useState(null);

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('AdminDashboard');
        }
    };

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const res = await api.getDevices();
            setDevices(res.data?.results || res.data || []);
        } catch (err) {
            setError('Failed to load devices. Pull down to retry.');
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

    const handleApprove = async (id) => {
        try {
            await api.approveDevice(id);
            Alert.alert('Success', 'Device approved');
            fetchData();
        } catch (err) {
            Alert.alert('Error', 'Failed to approve device');
        }
    };

    const handleReject = async (id) => {
        Alert.alert(
            'Confirm Reject',
            'Are you sure you want to reject this device?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.rejectDevice(id);
                            Alert.alert('Success', 'Device rejected');
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to reject device');
                        }
                    }
                }
            ]
        );
    };

    const handleBlock = async (id) => {
        Alert.alert(
            'Confirm Block',
            'Block this device? The user will not be able to login from this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.blockDevice(id);
                            Alert.alert('Success', 'Device blocked');
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to block device');
                        }
                    }
                }
            ]
        );
    };

    const handleReset = (id, username) => {
        Alert.alert(
            'Change Device',
            `This will remove the registered device for ${username}. They will be able to register a new device on their next login. Continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Change Device',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.resetDevice(id);
                            Alert.alert('Success', `Device reset for ${username}. They can now register a new device.`);
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to reset device');
                        }
                    }
                }
            ]
        );
    };

    const pendingDevices = devices.filter(d => d.status === 'PENDING');
    const approvedDevices = devices.filter(d => d.status === 'APPROVED');
    const blockedDevices = devices.filter(d => d.status === 'BLOCKED');

    const currentDevices = activeTab === 0 ? pendingDevices :
                          activeTab === 1 ? approvedDevices : blockedDevices;

    const renderDevice = ({ item }) => (
        <View style={styles.deviceCard}>
            <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{item.username || item.user_display || 'Unknown'}</Text>
                <Text style={styles.deviceDetail}>{item.device_name || item.device_id}</Text>
                <View style={styles.deviceMeta}>
                    <Text style={styles.metaText}>{item.platform} | {item.browser} on {item.os}</Text>
                    <Text style={styles.metaText}>
                        Last active: {item.last_active ? new Date(item.last_active).toLocaleDateString() : 'N/A'}
                    </Text>
                </View>
            </View>
            <View style={styles.deviceActions}>
                {item.status === 'PENDING' && (
                    <>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.approveBtn]}
                            onPress={() => handleApprove(item.id)}
                        >
                            <Text style={styles.actionBtnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() => handleReject(item.id)}
                        >
                            <Text style={styles.actionBtnText}>Reject</Text>
                        </TouchableOpacity>
                    </>
                )}
                {item.status === 'APPROVED' && (
                    <>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.resetBtn]}
                            onPress={() => handleReset(item.id, item.username || 'this user')}
                        >
                            <Icon name="refresh-cw" size={12} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.actionBtnText}>Change Device</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.blockBtn]}
                            onPress={() => handleBlock(item.id)}
                        >
                            <Text style={styles.actionBtnText}>Block</Text>
                        </TouchableOpacity>
                    </>
                )}
                {item.status === 'BLOCKED' && (
                    <View style={styles.blockedBadge}>
                        <Icon name="slash" size={12} color={colors.danger} />
                        <Text style={styles.blockedText}>Blocked</Text>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Device Management</Text>
                    <Text style={styles.headerSubtitle}>Manage user devices</Text>
                </View>
                <View style={styles.headerRight} />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 0 && styles.activeTab]}
                    onPress={() => setActiveTab(0)}
                >
                    <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
                        Pending ({pendingDevices.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 1 && styles.activeTab]}
                    onPress={() => setActiveTab(1)}
                >
                    <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
                        Approved ({approvedDevices.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 2 && styles.activeTab]}
                    onPress={() => setActiveTab(2)}
                >
                    <Text style={[styles.tabText, activeTab === 2 && styles.activeTabText]}>
                        Blocked ({blockedDevices.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {error ? (
                <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={15} color={colors.danger} />
                    <Text style={styles.errorBannerText}>{error}</Text>
                    <TouchableOpacity onPress={fetchData}>
                        <Text style={styles.retryLink}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {loading && currentDevices.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <SkeletonListItem key={i} style={{ marginBottom: spacing.sm }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={currentDevices}
                    keyExtractor={(item, index) => item.id ? `device_${item.id}` : `device-${index}`}
                    renderItem={renderDevice}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="smartphone" size={48} color={colors.textLight} />
                            <Text style={styles.emptyText}>No devices found</Text>
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
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: typography.weights.medium,
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: typography.weights.bold,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        borderRadius: 10,
        padding: spacing.sm,
        margin: spacing.md,
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
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    deviceCard: {
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
    deviceInfo: {
        marginBottom: spacing.sm,
    },
    deviceName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    deviceDetail: {
        fontSize: typography.sizes.sm,
        color: colors.text,
        marginTop: spacing.xs,
    },
    deviceMeta: {
        marginTop: spacing.xs,
    },
    metaText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    deviceActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
    },
    approveBtn: {
        backgroundColor: colors.success,
    },
    rejectBtn: {
        backgroundColor: colors.danger,
    },
    blockBtn: {
        backgroundColor: colors.warning,
    },
    resetBtn: {
        backgroundColor: colors.primary,
    },
    actionBtnText: {
        color: colors.white,
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.sm,
    },
    blockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        backgroundColor: '#FFF0F0',
        borderRadius: 8,
    },
    blockedText: {
        fontSize: typography.sizes.xs,
        color: colors.danger,
        fontWeight: typography.weights.medium,
    },
    emptyContainer: {
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
});

export default AdminDevicesScreen;
