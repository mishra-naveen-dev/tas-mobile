import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Image,
    Dimensions,
    StatusBar,
} from 'react-native';

const { width } = Dimensions.get('window');

const SplashScreen = () => {
    // Individual animation values for staggered entrance
    const logoScale   = useRef(new Animated.Value(0.4)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoGlow    = useRef(new Animated.Value(0)).current;

    const nameFadeY   = useRef(new Animated.Value(28)).current;
    const nameFade    = useRef(new Animated.Value(0)).current;

    const dividerW    = useRef(new Animated.Value(0)).current;

    const subFade     = useRef(new Animated.Value(0)).current;
    const subFadeY    = useRef(new Animated.Value(14)).current;

    const footerFade  = useRef(new Animated.Value(0)).current;

    // Looping shimmer on logo border
    const shimmer     = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        StatusBar.setBarStyle('light-content');
        StatusBar.setBackgroundColor('#C62828');

        Animated.sequence([
            // 1. Logo springs in
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    tension: 55,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]),
            // 2. Company name slides up
            Animated.delay(80),
            Animated.parallel([
                Animated.timing(nameFade, {
                    toValue: 1,
                    duration: 420,
                    useNativeDriver: true,
                }),
                Animated.spring(nameFadeY, {
                    toValue: 0,
                    tension: 70,
                    friction: 9,
                    useNativeDriver: true,
                }),
            ]),
            // 3. Divider expands
            Animated.delay(60),
            Animated.timing(dividerW, {
                toValue: 1,
                duration: 380,
                useNativeDriver: false,
            }),
            // 4. Subsidiary text fades in
            Animated.delay(40),
            Animated.parallel([
                Animated.timing(subFade, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.spring(subFadeY, {
                    toValue: 0,
                    tension: 70,
                    friction: 9,
                    useNativeDriver: true,
                }),
            ]),
            // 5. Footer
            Animated.delay(80),
            Animated.timing(footerFade, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }),
        ]).start();

        // Continuous shimmer on logo ring
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, { toValue: 1, duration: 1800, useNativeDriver: true }),
                Animated.timing(shimmer, { toValue: 0, duration: 1800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const shimmerOpacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.25, 0.55],
    });

    const dividerInterp = dividerW.interpolate({
        inputRange: [0, 1],
        outputRange: [0, width * 0.55],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#C62828" />

            {/* ── Radial glow behind logo ── */}
            <View style={styles.glowRing} />

            {/* ── Centre content ── */}
            <View style={styles.center}>

                {/* Logo */}
                <Animated.View
                    style={[
                        styles.logoWrap,
                        { opacity: logoOpacity, transform: [{ scale: logoScale }] },
                    ]}
                >
                    {/* Shimmer ring */}
                    <Animated.View style={[styles.shimmerRing, { opacity: shimmerOpacity }]} />
                    <View style={styles.logoBg}>
                        <Image
                            source={require('../image/Namralogo.jpeg')}
                            style={styles.logoImg}
                            resizeMode="contain"
                        />
                    </View>
                </Animated.View>

                {/* Company name */}
                <Animated.Text
                    style={[
                        styles.company,
                        { opacity: nameFade, transform: [{ translateY: nameFadeY }] },
                    ]}
                >
                    Namra Finance Ltd.
                </Animated.Text>

                {/* Animated divider */}
                <Animated.View style={[styles.divider, { width: dividerInterp }]} />

                {/* Subsidiary line */}
                <Animated.View
                    style={[
                        styles.subWrap,
                        { opacity: subFade, transform: [{ translateY: subFadeY }] },
                    ]}
                >
                    <Text style={styles.subLine1}>A wholly owned subsidiary of</Text>
                    <Text style={styles.subLine2}>Arman Financial Services Ltd.</Text>
                </Animated.View>

            </View>

            {/* ── Footer ── */}
            <Animated.View style={[styles.footer, { opacity: footerFade }]}>
                <View style={styles.footerDot} />
                <Text style={styles.footerText}>Traveling Allowance System</Text>
                <View style={styles.footerDot} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#C62828',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Soft radial glow circle behind logo
    glowRing: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(255,255,255,0.05)',
        top: '50%',
        marginTop: -150,
    },

    center: {
        alignItems: 'center',
        paddingHorizontal: 32,
    },

    // Logo
    logoWrap: {
        marginBottom: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shimmerRing: {
        position: 'absolute',
        width: 128,
        height: 128,
        borderRadius: 34,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    logoBg: {
        width: 112,
        height: 112,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
    },
    logoImg: {
        width: 100,
        height: 100,
    },

    // Company name
    company: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.4,
        textAlign: 'center',
        marginBottom: 14,
    },

    // Divider
    divider: {
        height: 2,
        borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.35)',
        marginBottom: 16,
    },

    // Subsidiary
    subWrap: {
        alignItems: 'center',
        gap: 4,
    },
    subLine1: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    subLine2: {
        fontSize: 14,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.9)',
        letterSpacing: 0.3,
        textAlign: 'center',
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    footerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    footerText: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
});

export default SplashScreen;
