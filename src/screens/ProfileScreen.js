import React, { useState, useContext, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing, typography } from '../theme/tokens';
import SkeletonLoader, { SkeletonMenuItem } from '../components/SkeletonLoader';

const ProfileScreen = ({ navigation }) => {
    const { user, logout } = useContext(AuthContext) || {};
    const currentUser = user || {};
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    const getInitials = () => {
        const first = currentUser.first_name || '';
        const last = currentUser.last_name || '';
        return (first.charAt(0) + last.charAt(0)).toUpperCase() || 'U';
    };

    const handleLogout = useCallback(() => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', onPress: logout, style: 'destructive' }
            ]
        );
    }, [logout]);

    const menuItems = [
        {
            icon: 'user',
            title: 'Personal Information',
            subtitle: 'View your profile details',
            onPress: () => {},
            disabled: true
        },
        {
            icon: 'lock',
            title: 'Change Password',
            subtitle: 'Update your password',
            onPress: () => navigation.navigate('ChangePassword'),
            color: colors.primary
        },
        {
            icon: 'smartphone',
            title: 'My Devices',
            subtitle: 'Manage registered devices',
            onPress: () => navigation.navigate('MyDevices'),
            color: colors.primary
        },
        {
            icon: 'bell',
            title: 'Notifications',
            subtitle: 'Manage notification preferences',
            onPress: () => {},
            disabled: true
        },
        {
            icon: 'settings',
            title: 'Settings',
            subtitle: 'App preferences',
            onPress: () => {},
            disabled: true
        },
    ];

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {/* Header Skeleton */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <View style={styles.headerTop}>
                                <View style={styles.backBtnPlaceholder} />
                                <SkeletonLoader width={44} height={44} borderRadius={12} />
                            </View>
                            <View style={styles.profileSection}>
                                <SkeletonLoader width={100} height={100} borderRadius={50} />
                                <SkeletonLoader width={160} height={20} borderRadius={6} style={{ marginTop: 16 }} />
                                <SkeletonLoader width={120} height={14} borderRadius={4} style={{ marginTop: 8 }} />
                                <SkeletonLoader width={80} height={24} borderRadius={12} style={{ marginTop: 12 }} />
                            </View>
                        </View>
                    </View>

                    {/* Info Card Skeleton */}
                    <View style={styles.infoSection}>
                        <SkeletonLoader width={120} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
                        <SkeletonLoader height={120} borderRadius={16} />
                    </View>

                    {/* Menu Items Skeleton */}
                    <View style={styles.menuSection}>
                        <SkeletonLoader width={100} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
                        {[1, 2, 3, 4, 5].map((item) => (
                            <SkeletonMenuItem key={item} style={{ marginBottom: 10 }} />
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* HEADER */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View style={styles.headerTop}>
                            <View style={styles.backBtnPlaceholder} />
                            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                                <Icon name="log-out" size={24} color={colors.danger} />
                            </TouchableOpacity>
                        </View>
                        
                        {/* PROFILE AVATAR */}
                        <View style={styles.profileSection}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{getInitials()}</Text>
                            </View>
                            <Text style={styles.userName}>
                                {currentUser.first_name} {currentUser.last_name}
                            </Text>
                            <Text style={styles.userEmail}>
                                {currentUser.email || currentUser.username || 'No email'}
                            </Text>
                            <View style={styles.roleBadge}>
                                <Text style={styles.roleText}>
                                    {currentUser.role?.name || currentUser.role_name || 'EMPLOYEE'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* INFO CARDS */}
                <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Account Information</Text>
                    
                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <View style={styles.infoItem}>
                                <Icon name="user" size={20} color={colors.textMuted} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Employee ID</Text>
                                    <Text style={styles.infoValue}>
                                        {currentUser.employee_id || currentUser.id || 'N/A'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.infoItem}>
                                <Icon name="hash" size={20} color={colors.textMuted} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Username</Text>
                                    <Text style={styles.infoValue}>
                                        {currentUser.username || 'N/A'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.infoRow}>
                            <View style={styles.infoItem}>
                                <Icon name="phone" size={20} color={colors.textMuted} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Phone</Text>
                                    <Text style={styles.infoValue}>
                                        {currentUser.phone || currentUser.mobile || 'Not provided'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.infoItem}>
                                <Icon name="map-pin" size={20} color={colors.textMuted} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Location</Text>
                                    <Text style={styles.infoValue}>
                                        {currentUser.location?.name || currentUser.city || 'Not set'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {currentUser.force_password_change && (
                            <>
                                <View style={styles.divider} />
                                <View style={styles.warningBanner}>
                                    <Icon name="alert-triangle" size={20} color={colors.warning} />
                                    <Text style={styles.warningText}>
                                        You must change your password before continuing
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* MENU ITEMS */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Settings</Text>
                    
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
                            onPress={item.onPress}
                            disabled={item.disabled}
                            activeOpacity={item.disabled ? 1 : 0.7}
                        >
                            <View style={[styles.menuIcon, item.color && { backgroundColor: item.color + '15' }]}>
                                <Icon 
                                    name={item.icon} 
                                    size={22} 
                                    color={item.disabled ? colors.textMuted : (item.color || colors.textDark)} 
                                />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={[styles.menuTitle, item.disabled && styles.menuTitleDisabled]}>
                                    {item.title}
                                </Text>
                                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
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

                {/* FOOTER */}
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
    header: {
        backgroundColor: colors.surface,
        paddingTop: Platform.OS === 'android' ? 16 : 8,
        paddingBottom: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    headerContent: {
        marginTop: 8,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backBtnPlaceholder: {
        width: 44,
        height: 44,
    },
    logoutBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.danger + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileSection: {
        alignItems: 'center',
        marginTop: 8,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    avatarText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    userName: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: 4,
    },
    userEmail: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: 12,
    },
    roleBadge: {
        backgroundColor: colors.primary + '15',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    roleText: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
    },
    infoSection: {
        paddingHorizontal: 16,
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: 12,
        marginLeft: 4,
    },
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
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
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    infoTextContainer: {
        marginLeft: 12,
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
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 16,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warningLight,
        padding: 12,
        borderRadius: 12,
    },
    warningText: {
        flex: 1,
        marginLeft: 10,
        fontSize: typography.sizes.sm,
        color: colors.warning,
        fontWeight: '500',
    },
    menuSection: {
        paddingHorizontal: 16,
        marginTop: 24,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
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
    menuItemDisabled: {
        opacity: 0.7,
    },
    menuIcon: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    menuContent: {
        flex: 1,
    },
    menuTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: 2,
    },
    menuTitleDisabled: {
        color: colors.textMuted,
    },
    menuSubtitle: {
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
        paddingVertical: 32,
    },
    footerText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: 4,
    },
    copyrightText: {
        fontSize: typography.sizes.xs,
        color: colors.textLight,
    },
    bottomPadding: {
        height: 140,
    },
});

export default ProfileScreen;
