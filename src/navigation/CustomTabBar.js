import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, shadows } from '../theme/tokens';

const { width } = Dimensions.get('window');

const TAB_LEFT = [
    { name: 'Home', label: 'Home', icon: 'home' },
    { name: 'Correction', label: 'Correction', icon: 'edit-3' },
];

const TAB_RIGHT = [
    { name: 'Allowance', label: 'Allowance', icon: 'file-text' },
    { name: 'More', label: 'More', icon: 'grid' },
];

const MENU_ITEMS = [
    { id: 'profile', label: 'Profile', icon: 'user', color: '#DC2626' },
    { id: 'devices', label: 'My Devices', icon: 'smartphone', color: '#059669' },
    { id: 'history', label: 'History', icon: 'clock', color: '#D97706' },
    { id: 'settings', label: 'Settings', icon: 'settings', color: '#64748B' },
    { id: 'support', label: 'Support', icon: 'headphones', color: '#7C3AED' },
    { id: 'logout', label: 'Logout', icon: 'log-out', color: '#DC2626' },
];

const TabItem = React.memo(({ label, icon, isActive, onPress }) => (
    <TouchableOpacity
        style={styles.tabItem}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Icon
            name={icon}
            size={24}
            color={isActive ? colors.primary : colors.textMuted}
        />
        <Text
            style={[
                styles.tabLabel,
                { color: isActive ? colors.primary : colors.textMuted }
            ]}
        >
            {label}
        </Text>
    </TouchableOpacity>
));

const MenuItem = React.memo(({ item, onPress }) => (
    <TouchableOpacity
        style={styles.menuItem}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
    >
        <View style={[styles.menuIconContainer, { backgroundColor: item.color + '20' }]}>
            <Icon name={item.icon} size={24} color={item.color} />
        </View>
        <Text style={styles.menuLabel}>{item.label}</Text>
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
        if (item.id === 'logout' || item.id === 'profile') {
            navigation.navigate('ChangePassword');
        } else if (item.id === 'history') {
            navigation.navigate('PunchHistory');
        } else if (item.id === 'devices') {
            navigation.navigate('ChangePassword');
        } else if (item.id === 'settings') {
            navigation.navigate('ChangePassword');
        } else if (item.id === 'support') {
            navigation.navigate('ChangePassword');
        }
    }, [navigation]);

    const renderLeftTabs = () => (
        <View style={styles.leftTabsContainer}>
            {TAB_LEFT.map((tab, index) => {
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
    );

    const renderRightTabs = () => (
        <View style={styles.rightTabsContainer}>
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
    );

    return (
        <>
            {/* Tab Bar Container with FAB floating above */}
            <View style={styles.tabBarWrapper}>
                {/* Floating Punch Button - positioned above tab bar */}
                <View style={styles.fabContainer}>
                    <TouchableOpacity
                        style={styles.fabButton}
                        onPress={onPunchPress}
                        activeOpacity={0.8}
                    >
                        <Icon name="map-pin" size={26} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.fabLabel}>Punch</Text>
                </View>

                {/* Tab Bar */}
                <View style={styles.tabBar}>
                    {renderLeftTabs()}
                    <View style={styles.centerSpacer} />
                    {renderRightTabs()}
                </View>
            </View>

            {/* More Menu Modal */}
            <Modal
                visible={showMoreMenu}
                transparent
                animationType="slide"
                onRequestClose={() => setShowMoreMenu(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMoreMenu(false)}
                >
                    <SafeAreaView style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>More Options</Text>
                                <TouchableOpacity onPress={() => setShowMoreMenu(false)}>
                                    <Icon name="x" size={24} color={colors.textDark} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.menuGrid}>
                                {MENU_ITEMS.map((item) => (
                                    <MenuItem
                                        key={item.id}
                                        item={item}
                                        onPress={handleMenuItemPress}
                                    />
                                ))}
                            </View>
                        </View>
                    </SafeAreaView>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    tabBarWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        height: 70,
        width: '100%',
        ...shadows.medium,
    },
    leftTabsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    rightTabsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    centerSpacer: {
        width: 60,
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        minWidth: 70,
        flex: 1,
    },
    tabLabel: {
        fontSize: typography.sizes.xs,
        fontWeight: '600',
        marginTop: 4,
    },
    fabContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: -10,
        zIndex: 10,
    },
    fabButton: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: colors.surface,
        ...shadows.floating,
    },
    fabLabel: {
        fontSize: typography.sizes.xs,
        fontWeight: '700',
        color: colors.primary,
        marginTop: spacing.xs,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: spacing.xl,
    },
    modalContent: {
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.sm,
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
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
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    menuLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default CustomTabBar;
