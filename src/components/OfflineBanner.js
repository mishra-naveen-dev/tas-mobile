// src/components/OfflineBanner.js

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import NetInfo from '@react-native-community/netinfo';
import { colors, typography, spacing } from '../theme/tokens';

const OfflineBanner = ({ 
    position = 'top',
    style = {},
    text = 'No Internet Connection - Working Offline'
}) => {
    const [isOffline, setIsOffline] = useState(false);
    const [slideAnim] = useState(new Animated.Value(-100));

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const offline = !state.isConnected || state.isInternetReachable === false;
            
            if (offline !== isOffline) {
                setIsOffline(offline);
                
                Animated.timing(slideAnim, {
                    toValue: offline ? 0 : -100,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            }
        });

        return () => unsubscribe();
    }, [isOffline]);

    if (!isOffline) return null;

    const bannerStyle = position === 'top' 
        ? [styles.banner, styles.topBanner, { transform: [{ translateY: slideAnim }] }]
        : [styles.banner, styles.bottomBanner, { transform: [{ translateY: slideAnim }] }];

    return (
        <Animated.View style={[bannerStyle, style]}>
            <Icon name="wifi-off" size={16} color="#FFF" />
            <Text style={styles.text}>{text}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8961E',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        zIndex: 9999,
        elevation: 10,
    },
    topBanner: {
        top: 0,
    },
    bottomBanner: {
        bottom: 0,
    },
    text: {
        color: '#FFF',
        fontSize: typography.sizes.sm,
        fontWeight: '500',
        marginLeft: spacing.sm,
    },
});

export default OfflineBanner;
