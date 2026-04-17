import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';

const ReportsScreen = ({ navigation }) => {
    const [selectedPeriod, setSelectedPeriod] = useState('today');

    const reportTypes = [
        {
            id: 'attendance',
            title: 'Attendance Report',
            description: 'Daily attendance summary and punch details',
            icon: 'clock',
            color: colors.primary,
        },
        {
            id: 'travel',
            title: 'Travel & Allowance',
            description: 'Travel distance and allowance claims',
            icon: 'navigation',
            color: colors.info,
        },
        {
            id: 'collection',
            title: 'Collection Report',
            description: 'Collection and disbursement details',
            icon: 'dollar-sign',
            color: colors.success,
        },
        {
            id: 'tracking',
            title: 'Route Tracking',
            description: 'Employee route and location history',
            icon: 'map-pin',
            color: colors.warning,
        },
        {
            id: 'performance',
            title: 'Performance Summary',
            description: 'Employee performance metrics',
            icon: 'trending-up',
            color: colors.danger,
        },
        {
            id: 'summary',
            title: 'Organization Summary',
            description: 'Overall organization statistics',
            icon: 'bar-chart-2',
            color: colors.secondary,
        },
    ];

    const periods = [
        { id: 'today', label: 'Today' },
        { id: 'week', label: 'This Week' },
        { id: 'month', label: 'This Month' },
        { id: 'custom', label: 'Custom' },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Reports"
                subtitle="Generate and view reports"
                navigation={navigation}
            />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.periodContainer}>
                    <Text style={styles.sectionTitle}>Select Period</Text>
                    <View style={styles.periodTabs}>
                        {periods.map((period) => (
                            <TouchableOpacity
                                key={period.id}
                                style={[
                                    styles.periodTab,
                                    selectedPeriod === period.id && styles.periodTabActive
                                ]}
                                onPress={() => setSelectedPeriod(period.id)}
                            >
                                <Text style={[
                                    styles.periodText,
                                    selectedPeriod === period.id && styles.periodTextActive
                                ]}>
                                    {period.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.reportsContainer}>
                    <Text style={styles.sectionTitle}>Available Reports</Text>
                    {reportTypes.map((report) => (
                        <TouchableOpacity
                            key={report.id}
                            style={styles.reportCard}
                            onPress={() => {
                                // TODO: Navigate to specific report
                            }}
                        >
                            <View style={[styles.reportIcon, { backgroundColor: report.color + '20' }]}>
                                <Icon name={report.icon} size={24} color={report.color} />
                            </View>
                            <View style={styles.reportInfo}>
                                <Text style={styles.reportTitle}>{report.title}</Text>
                                <Text style={styles.reportDescription}>{report.description}</Text>
                            </View>
                            <Icon name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    periodContainer: {
        marginBottom: spacing.lg,
    },
    periodTabs: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.xs,
    },
    periodTab: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
    },
    periodTabActive: {
        backgroundColor: colors.primary,
    },
    periodText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: typography.weights.medium,
    },
    periodTextActive: {
        color: '#FFFFFF',
        fontWeight: typography.weights.bold,
    },
    reportsContainer: {
        marginBottom: spacing.lg,
    },
    reportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        elevation: 2,
    },
    reportIcon: {
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reportInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    reportTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    reportDescription: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
});

export default ReportsScreen;
