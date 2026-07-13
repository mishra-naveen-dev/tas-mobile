import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { serverStatus } from '../../utils/serverStatus';

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

    useEffect(() => serverStatus.subscribe(setStatus), []);

    if (status.online) return null;

    return (
        <View style={styles.banner}>
            <Icon name="wifi-off" size={13} color="#fff" />
            <Text style={styles.text}>
                {'Offline — showing cached data'}
                {ago(status.cachedAt)}
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
    text: {
        color: '#FEF3C7',
        fontSize: 12,
        fontWeight: '600',
        flexShrink: 1,
    },
});
