import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { serverStatus } from '../../utils/serverStatus';
import { subscribe as subscribeOfflineQueue, syncNow, QUEUE_STATUS } from '../../services/OfflineQueue';

/**
 * Compact sync/connectivity status chip — rendered as a position:absolute
 * overlay (see RootNavigator.js) rather than a layout element that pushes
 * screen content down. That's deliberate, not just a style choice: every
 * screen already reserves its own top inset via its own
 * `<SafeAreaView edges={['top']}>` (see ScreenHeader/HeroHeader usage), so
 * a sibling banner that ALSO adds `insets.top` padding while occupying
 * real layout height double-counts the status bar height the moment it's
 * visible — that was the cause of the "big blank gap under the status bar"
 * bug. An absolute overlay never participates in that layout at all, so
 * this component can appear and disappear freely without ever affecting
 * any screen's header position.
 *
 * Only ever shows for the two states that need the user's live attention:
 * a replay actually in flight right now (SYNCING), or no connectivity at
 * all. It does NOT show for "items merely queued/waiting on a backoff
 * timer" (automatic retry keeps working silently in the background — see
 * OfflineQueue.processQueue) and it does NOT show dead-lettered
 * (FAILED_PERMANENT) items — those already have a permanent, better home:
 * the "Pending Sync" section on Home (ActivityCard's per-item Retry
 * affordance) plus the one-shot toast App.jsx's onSyncComplete fires via
 * NotificationProvider. Duplicating that here as a second, ever-present
 * banner was the other half of the bug report.
 */
export default function OfflineBanner() {
    const [status, setStatus] = useState({ online: serverStatus._online, cachedAt: serverStatus._cachedAt });
    const [queueItems, setQueueItems] = useState([]);
    const insets = useSafeAreaInsets();

    useEffect(() => serverStatus.subscribe(setStatus), []);
    useEffect(() => subscribeOfflineQueue(setQueueItems), []);

    const isSyncing = queueItems.some((item) => item.status === QUEUE_STATUS.SYNCING);

    // Nothing worth interrupting the user for — online and nothing actively
    // syncing right now. Render nothing at all, not just a hidden/zero-height
    // view, so the space is fully reclaimed.
    if (status.online && !isSyncing) return null;

    const offline = !status.online;
    const queuedCount = queueItems.length;

    return (
        <View style={[styles.overlay, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
            <TouchableOpacity
                style={[styles.pill, offline ? styles.offlinePill : styles.syncingPill]}
                onPress={() => syncNow()}
                activeOpacity={0.8}
            >
                {offline ? (
                    <Icon name="wifi-off" size={12} color="#fff" />
                ) : (
                    <ActivityIndicator size="small" color="#fff" />
                )}
                <Text style={styles.pillText} numberOfLines={1}>
                    {offline
                        ? (queuedCount > 0 ? `Offline · ${queuedCount} queued` : 'Offline')
                        : 'Syncing…'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        paddingRight: 12,
        zIndex: 30,
        elevation: 30,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        maxWidth: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    offlinePill: {
        backgroundColor: '#92400E',
    },
    syncingPill: {
        backgroundColor: '#166534',
    },
    pillText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        flexShrink: 1,
    },
});
