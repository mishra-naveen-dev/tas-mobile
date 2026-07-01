import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

const { width } = Dimensions.get('window');

const TAB_LEFT = [
    { name: 'Home', label: 'Home', icon: 'home' },
    { name: 'Correction', label: 'Correction', icon: 'edit-3' },
];

const TAB_RIGHT = [
    { name: 'Collections', label: 'Collections', icon: 'dollar-sign' },
    { name: 'More', label: 'More', icon: 'grid' },
];

const MENU_ITEMS = [
    { id: 'profile', label: 'Profile', icon: 'user', color: colors.primary },
    { id: 'devices', label: 'My Devices', icon: 'smartphone', color: '#059669' },
    { id: 'history', label: 'History', icon: 'clock', color: '#D97706' },
    { id: 'settings', label: 'Settings', icon: 'settings', color: '#64748B' },
    { id: 'support', label: 'Support', icon: 'headphones', color: '#7C3AED' },
    { id: 'logout', label: 'Logout', icon: 'log-out', color: colors.danger },
];

const TabItem = React.memo(({ label, icon, isActive, onPress }) => (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
        <Icon name={icon} size={22} color={isActive ? colors.primary : colors.textMuted} />
        <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.textMuted }]} numberOfLines={1}>
            {label}
        </Text>
    </TouchableOpacity>
));

const MenuItem = React.memo(({ item, onPress }) => (
    <TouchableOpacity style={styles.menuItem} onPress={() => onPress(item)} activeOpacity={0.7}>
        <View style={[styles.menuIconContainer, { backgroundColor: item.color + '15' }]}>
            <Icon name={item.icon} size={22} color={item.color} />
        </View>
        <Text style={styles.menuLabel} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
));

const CustomTabBar = ({ state, descriptors, navigation, onPunchPress }) => {
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const getRouteIndex = useCallback((routeName) => {
        const allRoutes = [...TAB_LEFT.map(t => t.name), ...TAB_RIGHT.map(t => t.name)];
        return allRoutes.indexOf(routeName);
    }, []);

    const handleMenuItemPress = useCallback((item) => {
        setShowMoreMenu(false);
        const routeMap = {
            logout: 'ChangePassword',
            profile: 'ChangePassword',
            history: 'PunchHistory',
            devices: 'ChangePassword',
            settings: 'ChangePassword',
            support: 'ChangePassword',
        };
        const route = routeMap[item.id];
        if (route) navigation.navigate(route);
    }, [navigation]);

    return (
        <>
            {/* Main Tab Bar Container */}
            <View style={styles.container}>
                {/* Floating Punch Button */}
                <TouchableOpacity style={styles.fabButton} onPress={onPunchPress} activeOpacity={0.85}>
                    <Icon name="map-pin" size={24} color="#FFFFFF" />
                    <Text style={styles.fabText}>Punch</Text>
                </TouchableOpacity>

                {/* Tab Bar */}
                <View style={styles.tabBar}>
                    {/* Left Tabs */}
                    <View style={styles.leftTabs}>
                        {TAB_LEFT.map((tab) => {
                            const routeIndex = getRouteIndex(tab.name);
                            const isFocused = state.index === routeIndex;
                            return (
                                <TabItem
                                    key={tab.name}
                                    label={tab.label}
                                    icon={tab.icon}
                                    isActive={isFocused}
                                    onPress={() => navigation.navigate(tab.name)}
                                />
                            );
                        })}
                    </View>

                    {/* Center Spacer for FAB */}
                    <View style={styles.centerSpacer} />

                    {/* Right Tabs */}
                    <View style={styles.rightTabs}>
                        {TAB_RIGHT.map((tab) => {
                            const routeIndex = getRouteIndex(tab.name);
                            const isFocused = state.index === routeIndex;
                            const onPress = tab.name === 'More'
                                ? () => setShowMoreMenu(true)
                                : () => navigation.navigate(tab.name);
                            return (
                                <TabItem
                                    key={tab.name}
                                    label={tab.label}
                                    icon={tab.icon}
                                    isActive={isFocused}
                                    onPress={onPress}
                                />
                            );
                        })}
                    </View>
                </View>
            </View>

            {/* More Menu Modal */}
            <Modal visible={showMoreMenu} transparent animationType="slide" onRequestClose={() => setShowMoreMenu(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMoreMenu(false)}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>More Options</Text>
                                <TouchableOpacity onPress={() => setShowMoreMenu(false)}>
                                    <Icon name="x" size={24} color={colors.textDark} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.menuGrid}>
                                {MENU_ITEMS.map((item) => (
                                    <MenuItem key={item.id} item={item} onPress={handleMenuItemPress} />
                                ))}
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    fabButton: {
        position: 'absolute',
        bottom: 28,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.info,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        ...shadows.lg,
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    fabText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        height: 65,
        width: '100%',
        ...shadows.md,
    },
    leftTabs: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    rightTabs: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    centerSpacer: {
        width: 60,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xxs,
        minWidth: 60,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 3,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    modalContent: {
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    menuItem: {
        width: (width - spacing.lg * 2 - spacing.md) / 3,
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    menuIconContainer: {
        width: 52,
        height: 52,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    menuLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default CustomTabBar;
