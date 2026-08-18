import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { serverStatus } from '../../utils/serverStatus';
import { subscribe as subscribeOfflineQueue } from '../../services/OfflineQueue';

function ago(ts) {
    if (!ts) return '';
    const ms = Date.now() - ts;
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return ' · just now';
    if (mins < 60) return ` · ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? ` · ${hrs}h ago` : ` · ${Math.floor(hrs / 24)}d ago`;
}

export default function OfflineBanner() {
    const [status, setStatus] = useState({ online: serverStatus._online, cachedAt: serverStatus._cachedAt });
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => serverStatus.subscribe(setStatus), []);
    useEffect(() => subscribeOfflineQueue((items) => setPendingCount(items.length)), []);

    if (status.online) {
        // Still show a (green) banner while items are mid-sync/waiting to
        // retry, even though connectivity itself is back — otherwise a
        // queued visit/punch/correction silently disappears from view
        // between "offline" and "synced" with no feedback in between.
        if (pendingCount === 0) return null;
        return (
            <View style={[styles.banner, styles.syncingBanner]}>
                <Icon name="upload-cloud" size={13} color="#fff" />
                <Text style={styles.text}>
                    {pendingCount === 1
                        ? 'Syncing 1 saved item…'
                        : `Syncing ${pendingCount} saved items…`}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.banner}>
            <Icon name="wifi-off" size={13} color="#fff" />
            <Text style={styles.text}>
                {'Offline — showing cached data'}
                {ago(status.cachedAt)}
                {pendingCount > 0 && (pendingCount === 1 ? ' · 1 item queued to sync' : ` · ${pendingCount} items queued to sync`)}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        backgroundColor: '#92400E',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 7,
        gap: 7,
    },
    syncingBanner: {
        backgroundColor: '#166534',
    },
    text: {
        color: '#FEF3C7',
        fontSize: 12,
        fontWeight: '600',
        flexShrink: 1,
    },
});
