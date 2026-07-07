import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { colors, typography, spacing } from '../theme/tokens';

const SplashScreen = () => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                tension: 50,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, scaleAnim]);

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../image/Namralogo.jpeg')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.title}>Namracred</Text>
                <Text style={styles.subtitle}>Traveling Allowance System</Text>
            </Animated.View>

            <View style={styles.footer}>
                <Text style={styles.companyName}>ARMAN FINANCIAL SERVICES LTD</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primaryDark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    logoContainer: {
        width: 110,
        height: 110,
        borderRadius: 26,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
        overflow: 'hidden',
    },
    logoImage: {
        width: 110,
        height: 110,
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        letterSpacing: 1.5,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.sizes.md,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    footer: {
        position: 'absolute',
        bottom: spacing.xxl,
        alignItems: 'center',
    },
    companyName: {
        fontSize: typography.sizes.xs,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
        letterSpacing: 1,
    },
});

export default SplashScreen;
