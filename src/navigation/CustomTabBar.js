import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../theme/tokens';

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
            color={isActive ? '#E53935' : '#9CA3AF'}
        />
        <Text
            style={[
                styles.tabLabel,
                { color: isActive ? '#E53935' : '#9CA3AF' }
            ]}
            numberOfLines={1}
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
        <View style={[styles.menuIconContainer, { backgroundColor: item.color + '15' }]}>
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

    const renderLeftTabs = () => (
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
    );

    const renderRightTabs = () => (
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
    );

    return (
        <>
            <View style={styles.container}>
                {/* Floating Punch Button - ABOVE tab bar */}
                <TouchableOpacity
                    style={styles.fabButton}
                    onPress={onPunchPress}
                    activeOpacity={0.85}
                >
                    <View style={styles.fabInner}>
                        <Icon name="map-pin" size={26} color="#FFFFFF" />
                        <Text style={styles.fabText}>Punch</Text>
                    </View>
                </TouchableOpacity>

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
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingBottom: 34,
    },
    fabButton: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: -33,
        zIndex: 100,
        elevation: 12,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    fabInner: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fabText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 8,
        height: 72,
        width: '100%',
        elevation: 8,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
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
        width: 66,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        minWidth: 70,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 34,
    },
    modalContent: {
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textDark,
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    menuItem: {
        width: (width - 48 - 24) / 3,
        alignItems: 'center',
        marginBottom: 24,
    },
    menuIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    menuLabel: {
        fontSize: 13,
        color: colors.textDark,
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default CustomTabBar;
