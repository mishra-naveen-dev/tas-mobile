import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import GlassCard from '../../components/GlassCard';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, typography, spacing } from '../../theme/tokens';

const HistoryHubScreen = ({ navigation }) => {

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
            navigation.navigate(route);
        } catch (err) {
            console.log("Navigation Error:", err);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="History Hub"
                subtitle="Select an option"
                navigation={navigation}
                showBack={true}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {modules.map((mod, i) => (
                    <TouchableOpacity
                        key={i}
                        activeOpacity={0.7}
                        onPress={() => handleNavigation(mod.route)}
                    >
                        <GlassCard style={styles.moduleCard}>
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

                            <View style={styles.moduleText}>
                                <Text style={styles.moduleTitle}>
                                    {mod.title}
                                </Text>
                                <Text style={styles.moduleSubtitle}>
                                    {mod.subtitle}
                                </Text>
                            </View>

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: 100,
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

export default HistoryHubScreen;
