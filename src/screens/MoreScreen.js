import React, { useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { colors, spacing, typography } from '../theme/tokens';

const MoreScreen = ({ navigation }) => {
    const menuSections = [
        {
            title: 'Account',
            items: [
                { 
                    key: 'profile', 
                    label: 'Profile', 
                    icon: 'user', 
                    color: colors.primary,
                    description: 'View your profile details',
                    onPress: () => navigation.navigate('ProfileTab', { screen: 'ProfileHome' })
                },
                { 
                    key: 'devices', 
                    label: 'My Devices', 
                    icon: 'smartphone', 
                    color: colors.info,
                    description: 'Manage registered devices',
                    onPress: () => navigation.navigate('ProfileTab', { screen: 'ProfileHome' })
                },
            ]
        },
        {
            title: 'Records',
            items: [
                { 
                    key: 'history', 
                    label: 'History', 
                    icon: 'clock', 
                    color: colors.success,
                    description: 'View punch history & claims',
                    onPress: () => navigation.navigate('HistoryTab', { screen: 'HistoryHub' })
                },
                { 
                    key: 'punchHistory', 
                    label: 'Punch History', 
                    icon: 'map-pin', 
                    color: colors.warning,
                    description: 'All coordinate pings',
                    onPress: () => navigation.navigate('HistoryTab', { screen: 'PunchHistory' })
                },
                { 
                    key: 'allowanceHistory', 
                    label: 'Allowance Claims', 
                    icon: 'dollar-sign', 
                    color: colors.success,
                    description: 'Track travel allowance status',
                    onPress: () => navigation.navigate('HistoryTab', { screen: 'AllowanceHistory' })
                },
            ]
        },
        {
            title: 'Preferences',
            items: [
                { 
                    key: 'settings', 
                    label: 'Settings', 
                    icon: 'settings', 
                    color: colors.textMuted,
                    description: 'App preferences',
                    disabled: true,
                    onPress: () => {}
                },
                { 
                    key: 'help', 
                    label: 'Help & Support', 
                    icon: 'help-circle', 
                    color: colors.textMuted,
                    description: 'Get help with the app',
                    disabled: true,
                    onPress: () => {}
                },
            ]
        },
        {
            title: 'Session',
            items: [
                { 
                    key: 'logout', 
                    label: 'Logout', 
                    icon: 'log-out', 
                    color: colors.danger,
                    description: 'Sign out of your account',
                    danger: true,
                    onPress: () => {
                        Alert.alert(
                            'Logout',
                            'Are you sure you want to logout?',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { 
                                    text: 'Logout', 
                                    style: 'destructive',
                                    onPress: () => {
                                        // Handle logout via AuthContext
                                        try {
                                            const { logout } = require('../context/AuthContext');
                                            if (logout) logout();
                                        } catch (e) {
                                            console.log('Logout error:', e);
                                        }
                                    }
                                }
                            ]
                        );
                    }
                },
            ]
        },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView 
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>More</Text>
                        <Text style={styles.subtitle}>Quick access to all features</Text>
                    </View>
                </View>

                {/* Menu Sections */}
                {menuSections.map((section, sectionIndex) => (
                    <View key={sectionIndex} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <View style={styles.sectionCard}>
                            {section.items.map((item, itemIndex) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[
                                        styles.menuItem,
                                        itemIndex < section.items.length - 1 && styles.menuItemBorder
                                    ]}
                                    onPress={item.onPress}
                                    disabled={item.disabled}
                                    activeOpacity={item.disabled ? 1 : 0.7}
                                >
                                    <View style={[styles.menuIconContainer, { backgroundColor: item.color + '15' }]}>
                                        <Icon 
                                            name={item.icon} 
                                            size={22} 
                                            color={item.disabled ? colors.textLight : item.color} 
                                        />
                                    </View>
                                    <View style={styles.menuContent}>
                                        <Text style={[
                                            styles.menuLabel,
                                            item.danger && styles.menuLabelDanger,
                                            item.disabled && styles.menuLabelDisabled
                                        ]}>
                                            {item.label}
                                        </Text>
                                        <Text style={styles.menuDescription}>{item.description}</Text>
                                    </View>
                                    {!item.disabled && (
                                        <Icon name="chevron-right" size={20} color={colors.textMuted} />
                                    )}
                                    {item.disabled && (
                                        <View style={styles.comingSoonBadge}>
                                            <Text style={styles.comingSoonText}>Soon</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Powered by Naveen Mishra</Text>
                    <Text style={styles.copyrightText}>All Copyrights Reserved @ 2026</Text>
                </View>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    header: {
        backgroundColor: colors.surface,
        paddingTop: Platform.OS === 'android' ? spacing.md : spacing.sm,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    headerContent: {
        alignItems: 'center',
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    section: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    menuIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    menuContent: {
        flex: 1,
    },
    menuLabel: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: 2,
    },
    menuLabelDanger: {
        color: colors.danger,
    },
    menuLabelDisabled: {
        color: colors.textLight,
    },
    menuDescription: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    comingSoonBadge: {
        backgroundColor: colors.textMuted + '20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    comingSoonText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        fontWeight: '500',
    },
    footer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        marginTop: spacing.lg,
    },
    footerText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    copyrightText: {
        fontSize: typography.sizes.xs,
        color: colors.textLight,
        marginTop: 4,
    },
    bottomPadding: {
        height: 40,
    },
});

export default MoreScreen;
