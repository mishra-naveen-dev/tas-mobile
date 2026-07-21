import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing } from '../../theme/tokens';
import { parseApiError } from '../../core/error/AppErrorHandler';
import { SkeletonAvatar, SkeletonText, SkeletonCard } from '../../components/SkeletonComponents';

// ─── Avatar ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    '#DC2626', '#D97706', '#059669', '#0891B2',
    '#7C3AED', '#DB2777', '#2563EB', '#16A34A',
];

const getAvatarColor = (name = '') => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const Avatar = ({ name, size = 88 }) => {
    const initials = name
        ? name.trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2)
        : '?';
    const bg = getAvatarColor(name);
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
            <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
        </View>
    );
};

// ─── Info row ────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, last }) => {
    if (!value) return null;
    return (
        <View style={[styles.infoRow, last && styles.infoRowLast]}>
            <View style={styles.infoIconWrap}>
                <Icon name={icon} size={15} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );
};

// ─── Action row (tappable) ───────────────────────────────────────────────────
const ActionRow = ({ icon, label, sublabel, iconBg, iconColor, labelColor, onPress, last, showArrow = true }) => (
    <TouchableOpacity
        style={[styles.infoRow, last && styles.infoRowLast]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[styles.infoIconWrap, { backgroundColor: iconBg || colors.primaryLight }]}>
            <Icon name={icon} size={15} color={iconColor || colors.primary} />
        </View>
        <View style={styles.infoContent}>
            <Text style={[styles.actionLabel, labelColor && { color: labelColor }]}>{label}</Text>
            {sublabel ? <Text style={styles.infoLabel}>{sublabel}</Text> : null}
        </View>
        {showArrow && <Icon name="chevron-right" size={16} color={colors.textMuted} />}
    </TouchableOpacity>
);

// ─── Section card ─────────────────────────────────────────────────────────────
const Section = ({ title, iconName, children }) => (
    <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <Icon name={iconName} size={14} color={colors.primary} />
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <View style={styles.sectionCard}>{children}</View>
    </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
    const { user: authUser, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [loggingOut, setLoggingOut] = useState(false);

    const fetchProfile = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError(null);
            const res = await api.getUserProfile();
            setProfile(res.data);
        } catch (err) {
            const { message } = parseApiError(err);
            setError(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchProfile(); }, []);

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        setLoggingOut(true);
                        try { await logout(); } catch {}
                        setLoggingOut(false);
                    },
                },
            ]
        );
    };

    const handleChangePassword = () => {
        navigation.navigate('ChangePassword');
    };

    // Fall back to cached auth user while profile loads
    const data = profile || authUser;

    const fullName = data?.first_name && data?.last_name
        ? `${data.first_name} ${data.last_name}`.trim()
        : data?.username || 'User';

    const roleLabel = {
        SUPER_ADMIN: 'Super Admin',
        ADMIN: 'Admin',
        EMPLOYEE: 'Employee',
        GUEST: 'Guest',
    }[data?.role_name || data?.role] || (data?.role_name || data?.role || '');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={styles.headerSpacer} />
            </View>

            {loading && !data ? (
                <View style={{ padding: spacing.md }}>
                    <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                        <SkeletonAvatar size={88} />
                        <SkeletonText width={140} height={20} style={{ marginTop: spacing.md }} />
                        <SkeletonText width={100} height={14} style={{ marginTop: spacing.sm }} />
                    </View>
                    <SkeletonCard style={{ marginBottom: spacing.md }} />
                    <SkeletonCard />
                </View>
            ) : error && !data ? (
                <View style={styles.centered}>
                    <Icon name="wifi-off" size={48} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchProfile()}>
                        <Icon name="refresh-cw" size={14} color="#fff" />
                        <Text style={styles.retryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchProfile(true)}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {/* Stale data banner */}
                    {error && data && (
                        <View style={styles.errorBanner}>
                            <Icon name="wifi-off" size={13} color={colors.warning} />
                            <Text style={styles.errorBannerText}>{error} — showing cached data</Text>
                        </View>
                    )}

                    {/* ── Hero card ── */}
                    <View style={styles.heroCard}>
                        <View style={styles.avatarWrap}>
                            <Avatar name={fullName} size={90} />
                        </View>
                        <Text style={styles.heroName}>{fullName}</Text>
                        {data?.designation_name ? (
                            <Text style={styles.heroDesignation}>{data.designation_name}</Text>
                        ) : null}
                        <View style={styles.badgeRow}>
                            {roleLabel ? (
                                <View style={styles.roleBadge}>
                                    <Icon name="shield" size={11} color={colors.primary} />
                                    <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                                </View>
                            ) : null}
                            {data?.department_name ? (
                                <View style={styles.deptBadge}>
                                    <Icon name="layers" size={11} color={colors.info} />
                                    <Text style={styles.deptBadgeText}>{data.department_name}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    {/* ── Personal Info ── */}
                    <Section title="Personal Information" iconName="user">
                        <InfoRow icon="hash"  label="Employee ID" value={data?.employee_id} />
                        <InfoRow icon="phone" label="Phone"       value={data?.phone} />
                        <InfoRow icon="mail"  label="Email"       value={data?.email} last />
                    </Section>

                    {/* ── Work Info ── */}
                    <Section title="Work Information" iconName="briefcase">
                        <InfoRow icon="award"  label="Designation" value={data?.designation_name} />
                        <InfoRow icon="layers" label="Department"  value={data?.department_name} />
                        <InfoRow icon="globe"  label="Zone"        value={data?.zone_name} />
                        <InfoRow icon="home"   label="Centre"      value={data?.center} />
                        <InfoRow icon="map"    label="State"       value={data?.state_name} last />
                    </Section>

                    {/* ── Organization ── */}
                    <Section title="Organization" iconName="git-branch">
                        <InfoRow icon="git-branch" label="Branch" value={data?.branch_name} />
                        <InfoRow icon="grid"       label="Area"   value={data?.area_name} last />
                    </Section>

                    {/* ── Account Settings ── */}
                    <Section title="Account Settings" iconName="settings">
                        <ActionRow
                            icon="lock"
                            label="Change Password"
                            sublabel="Update your login password"
                            iconBg="#FEF3C7"
                            iconColor={colors.warning}
                            onPress={handleChangePassword}
                        />
                        <ActionRow
                            icon="smartphone"
                            label="Device Info"
                            sublabel={`ID: ${data?.employee_id || 'N/A'}`}
                            iconBg={colors.infoLight}
                            iconColor={colors.info}
                            onPress={() => {}}
                            showArrow={false}
                            last
                        />
                    </Section>

                    {/* ── Logout ── */}
                    <View style={styles.section}>
                        <View style={styles.sectionCard}>
                            <TouchableOpacity
                                style={styles.logoutRow}
                                onPress={handleLogout}
                                activeOpacity={0.7}
                                disabled={loggingOut}
                            >
                                {loggingOut ? (
                                    <ActivityIndicator size="small" color={colors.danger} />
                                ) : (
                                    <View style={styles.logoutIconWrap}>
                                        <Icon name="log-out" size={16} color={colors.danger} />
                                    </View>
                                )}
                                <Text style={styles.logoutText}>
                                    {loggingOut ? 'Logging out…' : 'Logout'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.appVersion}>Traveling Allowance System  •  v1.0.0</Text>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    // Header
    header: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    backBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: '#fff',
    },
    headerSpacer: { width: 38 },

    // Loading / error
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    errorText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.sm,
        color: colors.danger,
        textAlign: 'center',
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.lg,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 20,
    },
    retryBtnText: {
        color: '#fff',
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
    },

    // Error banner
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFFBEB',
        borderRadius: 10,
        padding: spacing.sm,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: '#FCD34D',
    },
    errorBannerText: {
        flex: 1,
        fontSize: typography.sizes.xs,
        color: '#92400E',
    },

    // Scroll
    scrollContent: {
        paddingBottom: 40,
    },

    // Hero card
    heroCard: {
        backgroundColor: colors.surface,
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        marginBottom: 2,
    },
    avatarWrap: {
        marginBottom: spacing.md,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    avatar: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    avatarText: {
        color: '#fff',
        fontWeight: typography.weights.bold,
        letterSpacing: 1,
    },
    heroName: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        textAlign: 'center',
    },
    heroDesignation: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 4,
        textAlign: 'center',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 20,
    },
    roleBadgeText: {
        fontSize: typography.sizes.xs,
        color: colors.primary,
        fontWeight: typography.weights.semibold,
    },
    deptBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.infoLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 20,
    },
    deptBadgeText: {
        fontSize: typography.sizes.xs,
        color: colors.info,
        fontWeight: typography.weights.semibold,
    },

    // Section
    section: {
        marginTop: spacing.md,
        marginHorizontal: spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: spacing.xs,
        paddingLeft: 2,
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },

    // Info row
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoRowLast: {
        borderBottomWidth: 0,
    },
    infoIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
    },

    // Action row
    actionLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textDark,
    },

    // Logout
    logoutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: 15,
    },
    logoutIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    logoutText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.danger,
    },

    // Footer
    appVersion: {
        textAlign: 'center',
        fontSize: typography.sizes.xs,
        color: colors.textLight,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
    },
});

export default ProfileScreen;
