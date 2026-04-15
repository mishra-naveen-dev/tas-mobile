


import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import GlassCard from '../components/GlassCard';
import { colors, typography, spacing } from '../theme/tokens';
import SkeletonLoader from '../components/SkeletonLoader';

const HistoryHubScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1200);
        return () => clearTimeout(timer);
    }, []);

    const modules = [
        {
            title: "Punch History",
            subtitle: "View all your past coordinate pings",
            icon: "map-pin",
            color: colors.primary,
            route: "PunchHistory"
        },
        {
            title: "Allowance History",
            subtitle: "Track the status of your travel claims",
            icon: "dollar-sign",
            color: colors.success,
            route: "AllowanceHistory"
        },
        {
            title: "Daily Summaries",
            subtitle: "Extract past metrics dynamically",
            icon: "bar-chart-2",
            color: colors.warning,
            route: "DailySummary"
        }
    ];

    const handleNavigation = (route) => {
        try {
            const state = navigation.getState();
            if (state && state.routes) {
                const routeExists = state.routes.some(r => r.name === route);
                if (routeExists) {
                    navigation.navigate(route);
                } else {
                    navigation.navigate(route);
                }
            } else {
                navigation.navigate(route);
            }
        } catch (err) {
            console.log("Navigation Error:", err);
            try {
                navigation.navigate(route);
            } catch (e) {
                console.log("Alternative navigation also failed:", e);
            }
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <SkeletonLoader width={140} height={24} borderRadius={6} />
                        <SkeletonLoader width={200} height={14} borderRadius={4} style={{ marginTop: 8 }} />
                    </View>
                    <View style={styles.scrollContent}>
                        {[1, 2, 3].map((item) => (
                            <SkeletonLoader key={item} height={90} borderRadius={16} style={{ marginBottom: 12 }}>
                                <View style={styles.skeletonCard}>
                                    <SkeletonLoader width={56} height={56} borderRadius={16} />
                                    <View style={styles.skeletonText}>
                                        <SkeletonLoader width="50%" height={16} borderRadius={4} />
                                        <SkeletonLoader width="70%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
                                    </View>
                                </View>
                            </SkeletonLoader>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* HEADER */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>History Hub</Text>
                <Text style={styles.headerSubtitle}>
                    Select an option to view data
                </Text>
            </View>

            {/* CONTENT */}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {modules.map((mod, i) => (
                    <TouchableOpacity
                        key={i}
                        activeOpacity={0.7}
                        onPress={() => handleNavigation(mod.route)}
                    >
                        <GlassCard style={styles.moduleCard}>
                            {/* ICON */}
                            <View
                                style={[
                                    styles.iconBox,
                                    { backgroundColor: mod.color + '20' }
                                ]}
                            >
                                <Icon
                                    name={mod.icon}
                                    size={28}
                                    color={mod.color}
                                />
                            </View>

                            {/* TEXT */}
                            <View style={styles.moduleText}>
                                <Text style={styles.moduleTitle}>
                                    {mod.title}
                                </Text>
                                <Text style={styles.moduleSubtitle}>
                                    {mod.subtitle}
                                </Text>
                            </View>

                            {/* ARROW */}
                            <Icon
                                name="chevron-right"
                                size={24}
                                color={colors.textMuted}
                            />
                        </GlassCard>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
};

export default HistoryHubScreen;


// ================= STYLES =================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    header: {
        padding: spacing.xl,
        paddingTop: Platform.OS === 'android' ? spacing.lg : spacing.md,
        backgroundColor: colors.primaryDark,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        marginBottom: spacing.lg,
    },

    headerTitle: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: '#FFF',
    },

    headerSubtitle: {
        fontSize: typography.sizes.md,
        color: 'rgba(255,255,255,0.8)',
        marginTop: spacing.xs,
    },

    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 120,
    },
    skeletonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
    },
    skeletonText: {
        flex: 1,
        marginLeft: spacing.md,
    },
    moduleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        marginBottom: spacing.md,
    },

    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },

    moduleText: {
        flex: 1,
    },

    moduleTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: 4,
    },

    moduleSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
});
