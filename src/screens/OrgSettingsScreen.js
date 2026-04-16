import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';

const OrgSettingsScreen = ({ navigation }) => {
    const [settings, setSettings] = useState({
        allowPunchCorrection: true,
        requireLocation: true,
        autoApproval: false,
        enableGeofencing: true,
        allowOfflinePunch: false,
        multiDeviceLogin: false,
    });

    const settingGroups = [
        {
            title: 'Attendance Settings',
            settings: [
                { id: 'requireLocation', label: 'Require Location', icon: 'map-pin', description: 'Punch must have valid GPS coordinates' },
                { id: 'allowOfflinePunch', label: 'Allow Offline Punch', icon: 'wifi-off', description: 'Allow punching without internet' },
                { id: 'allowPunchCorrection', label: 'Allow Punch Correction', icon: 'clock', description: 'Employees can request punch corrections' },
            ],
        },
        {
            title: 'Security Settings',
            settings: [
                { id: 'multiDeviceLogin', label: 'Multi-Device Login', icon: 'smartphone', description: 'Allow login from multiple devices' },
                { id: 'enableGeofencing', label: 'Enable Geofencing', icon: 'target', description: 'Restrict punches to defined areas' },
            ],
        },
        {
            title: 'Approval Settings',
            settings: [
                { id: 'autoApproval', label: 'Auto Approve Small Claims', icon: 'check-circle', description: 'Auto-approve allowances under threshold' },
            ],
        },
    ];

    const toggleSetting = (id) => {
        setSettings(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Organization Settings"
                subtitle="Configure organization preferences"
                navigation={navigation}
            />

            <ScrollView contentContainerStyle={styles.content}>
                {settingGroups.map((group, groupIndex) => (
                    <View key={groupIndex} style={styles.group}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        <View style={styles.settingsCard}>
                            {group.settings.map((setting, settingIndex) => (
                                <View
                                    key={setting.id}
                                    style={[
                                        styles.settingItem,
                                        settingIndex < group.settings.length - 1 && styles.settingItemBorder
                                    ]}
                                >
                                    <View style={styles.settingIcon}>
                                        <Icon name={setting.icon} size={20} color={colors.primary} />
                                    </View>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>{setting.label}</Text>
                                        <Text style={styles.settingDescription}>{setting.description}</Text>
                                    </View>
                                    <Switch
                                        value={settings[setting.id]}
                                        onValueChange={() => toggleSetting(setting.id)}
                                        trackColor={{ false: colors.border, true: colors.primary + '80' }}
                                        thumbColor={settings[setting.id] ? colors.primary : '#f4f3f4'}
                                    />
                                </View>
                            ))}
                        </View>
                    </View>
                ))}

                <View style={styles.group}>
                    <Text style={styles.groupTitle}>Danger Zone</Text>
                    <View style={styles.settingsCard}>
                        <TouchableOpacity style={styles.dangerItem}>
                            <View style={styles.settingIcon}>
                                <Icon name="trash-2" size={20} color={colors.danger} />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingLabel, { color: colors.danger }]}>Reset All Data</Text>
                                <Text style={styles.settingDescription}>Clear all attendance and tracking data</Text>
                            </View>
                            <Icon name="chevron-right" size={20} color={colors.danger} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Organization Settings v1.0</Text>
                    <Text style={styles.footerSubtext}>Last updated: Today</Text>
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
    group: {
        marginBottom: spacing.lg,
    },
    groupTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    settingsCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    settingItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    settingLabel: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
    },
    settingDescription: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    dangerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    footer: {
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    footerText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    footerSubtext: {
        fontSize: typography.sizes.xs,
        color: colors.textLight,
        marginTop: spacing.xs,
    },
});

export default OrgSettingsScreen;
