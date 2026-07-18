import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import HeroHeader from '../../components/HeroHeader';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing } from '../../theme/tokens';

const SuperAdminMoreScreen = ({ navigation }) => {
    const { user } = useAuth();
    const [userData, setUserData] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadUserData = () => {
        return api.get('/organization/profile-update/')
            .then(res => setUserData(res.data))
            .catch(() => {});
    };

    useEffect(() => {
        loadUserData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadUserData();
        setRefreshing(false);
    };

    const MenuItem = ({ title, subtitle, icon, color, badge, onPress }) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: `${color}15` }]}>
                <Icon name={icon} size={22} color={color} />
            </View>
            <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{title}</Text>
                {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
            </View>
            {badge > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
            )}
            <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
    );

    const SectionTitle = ({ title }) => (
        <Text style={styles.sectionTitle}>{title}</Text>
    );

    return (
        <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={styles.container}>
                <HeroHeader
                    user={userData}
                    role="Super Admin"
                    showStatus={false}
                    onLogout={() => navigation.navigate('Login')}
                />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <TouchableOpacity
                        style={styles.profileCard}
                        onPress={() => navigation.navigate('Profile')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.profileIcon}>
                            <Icon name="user" size={32} color={colors.primary} />
                        </View>
                        <View style={styles.profileContent}>
                            <Text style={styles.profileTitle}>
                                {user?.first_name && user?.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user?.username || 'Admin'}
                            </Text>
                            <Text style={styles.profileSubtitle}>
                                {user?.employee_id || 'Super Admin'}
                            </Text>
                            <Text style={styles.profileTap}>Tap to view full profile →</Text>
                        </View>
                    </TouchableOpacity>

                    <SectionTitle title="Account" />
                    <MenuItem
                        title="My Profile"
                        subtitle="View personal & work details"
                        icon="user"
                        color={colors.primary}
                        onPress={() => navigation.navigate('Profile')}
                    />

                    <SectionTitle title="Management" />
                    <MenuItem
                        title="User Management"
                        subtitle="Manage system users & roles"
                        icon="users"
                        color={colors.primary}
                        onPress={() => navigation.navigate('UserManagement')}
                    />
                    <MenuItem
                        title="Employee List"
                        subtitle="View and manage employees"
                        icon="user-check"
                        color={colors.success}
                        onPress={() => navigation.navigate('EmployeeList')}
                    />
                    <MenuItem
                        title="Create New User"
                        subtitle="Add new employee or admin"
                        icon="user-plus"
                        color={colors.info}
                        onPress={() => navigation.navigate('CreateUser')}
                    />
                    <MenuItem
                        title="Approval Routes"
                        subtitle="Configure approval workflows"
                        icon="git-branch"
                        color={colors.success}
                        onPress={() => navigation.navigate('ApprovalRoutes')}
                    />

                    <SectionTitle title="Settings" />
                    <MenuItem
                        title="Organization Settings"
                        subtitle="Org details & preferences"
                        icon="home"
                        color={colors.primary}
                        onPress={() => navigation.navigate('OrgSettings')}
                    />
                    <MenuItem
                        title="Device Management"
                        subtitle="Configure employee devices"
                        icon="smartphone"
                        color={colors.info}
                        onPress={() => navigation.navigate('AdminDevices')}
                    />
                    <MenuItem
                        title="Employee Tracking"
                        subtitle="Monitor live locations"
                        icon="map-pin"
                        color={colors.warning}
                        onPress={() => navigation.navigate('EmployeeTracking')}
                    />

                    <SectionTitle title="Reports" />
                    <MenuItem
                        title="Daily Activity"
                        subtitle="Distance, punches & collection by date"
                        icon="activity"
                        color={colors.info}
                        onPress={() => navigation.navigate('DailySummary')}
                    />
                    <MenuItem
                        title="View Reports"
                        subtitle="Generate & view reports"
                        icon="file-text"
                        color={colors.warning}
                        onPress={() => navigation.navigate('Reports')}
                    />
                    <MenuItem
                        title="Pending Approvals"
                        subtitle="Review approval requests"
                        icon="check-circle"
                        color={colors.danger}
                        onPress={() => navigation.navigate('AdminApprovals')}
                    />

                    <SectionTitle title="Support" />
                    <MenuItem
                        title="Help & Support"
                        subtitle="Company info, FAQs and IT Technical Support"
                        icon="help-circle"
                        color={colors.info}
                        onPress={() => navigation.navigate('HelpSupport')}
                    />

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Traveling Allowance System</Text>
                        <Text style={styles.footerVersion}>Version 1.0.0</Text>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 100,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    profileIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    profileContent: {
        flex: 1,
    },
    profileTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    profileSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    profileTap: {
        fontSize: typography.sizes.xs,
        color: colors.primary,
        marginTop: 4,
        fontWeight: typography.weights.medium,
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
        marginTop: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.xs,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
    },
    menuIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    menuContent: {
        flex: 1,
    },
    menuTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
    },
    menuSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    badge: {
        backgroundColor: colors.danger,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: spacing.sm,
    },
    badgeText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.surface,
    },
    footer: {
        alignItems: 'center',
        marginTop: spacing.xxl,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    footerText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textMuted,
    },
    footerVersion: {
        fontSize: typography.sizes.xs,
        color: colors.textLight,
        marginTop: 2,
    },
});

export default SuperAdminMoreScreen;
