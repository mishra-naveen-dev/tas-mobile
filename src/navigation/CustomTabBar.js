import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, shadows } from '../theme/tokens';

const { width } = Dimensions.get('window');

const TAB_CONFIG = [
    { name: 'Home', label: 'Home', icon: 'home' },
    { name: 'Correction', label: 'Correction', icon: 'edit-3' },
    { name: 'Allowance', label: 'Allowance', icon: 'file-text' },
    { name: 'More', label: 'More', icon: 'grid' },
];

const MENU_ITEMS = [
    { id: 'profile', label: 'Profile', icon: 'user', color: '#4F46E5' },
    { id: 'devices', label: 'My Devices', icon: 'smartphone', color: '#059669' },
    { id: 'history', label: 'History', icon: 'clock', color: '#D97706' },
    { id: 'settings', label: 'Settings', icon: 'settings', color: '#64748B' },
    { id: 'support', label: 'Support', icon: 'headphones', color: '#7C3AED' },
    { id: 'logout', label: 'Logout', icon: 'log-out', color: '#DC2626' },
];

const CustomTabBar = ({ state, descriptors, navigation, onPunchPress }) => {
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const getIconName = (routeName) => {
        const icons = {
            Home: 'home',
            Correction: 'edit-3',
            Allowance: 'file-text',
            More: 'grid',
        };
        return icons[routeName] || 'circle';
    };

    const handleMenuPress = () => {
        setShowMoreMenu(true);
    };

    const handleMenuItemPress = (item) => {
        setShowMoreMenu(false);
        if (item.id === 'logout') {
            navigation.navigate('ChangePassword');
        } else if (item.id === 'profile') {
            navigation.navigate('ChangePassword');
        } else if (item.id === 'history') {
            navigation.navigate('PunchHistory');
        } else if (item.id === 'devices') {
            navigation.navigate('ChangePassword');
        }
    };

    return (
        <>
            <View style={styles.tabBarContainer}>
                <View style={styles.tabBar}>
                    {/* Left Tabs */}
                    <View style={styles.leftTabs}>
                        {TAB_CONFIG.slice(0, 2).map((tab, index) => {
                            const isFocused = state.index === index;
                            return (
                                <TouchableOpacity
                                    key={tab.name}
                                    style={styles.tabItem}
                                    onPress={() => navigation.navigate(tab.name)}
                                    activeOpacity={0.7}
                                >
                                    <Icon
                                        name={getIconName(tab.name)}
                                        size={22}
                                        color={isFocused ? colors.primary : colors.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.tabLabel,
                                            { color: isFocused ? colors.primary : colors.textMuted }
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Center Floating Punch Button */}
                    <View style={styles.punchButtonContainer}>
                        <TouchableOpacity
                            style={styles.punchButton}
                            onPress={onPunchPress}
                            activeOpacity={0.8}
                        >
                            <Icon name="map-pin" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.punchLabel}>Punch</Text>
                    </View>

                    {/* Right Tabs */}
                    <View style={styles.rightTabs}>
                        {TAB_CONFIG.slice(2, 4).map((tab, index) => {
                            const actualIndex = index + 2;
                            const isFocused = state.index === actualIndex;
                            return (
                                <TouchableOpacity
                                    key={tab.name}
                                    style={styles.tabItem}
                                    onPress={() => tab.name === 'More' ? handleMenuPress() : navigation.navigate(tab.name)}
                                    activeOpacity={0.7}
                                >
                                    <Icon
                                        name={getIconName(tab.name)}
                                        size={22}
                                        color={isFocused ? colors.primary : colors.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.tabLabel,
                                            { color: isFocused ? colors.primary : colors.textMuted }
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
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
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.menuItem}
                                        onPress={() => handleMenuItemPress(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.menuIconContainer, { backgroundColor: item.color + '20' }]}>
                                            <Icon name={item.icon} size={24} color={item.color} />
                                        </View>
                                        <Text style={styles.menuLabel}>{item.label}</Text>
                                    </TouchableOpacity>
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
    tabBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        ...shadows.medium,
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
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        minWidth: 70,
    },
    tabLabel: {
        fontSize: typography.sizes.xs,
        fontWeight: '600',
        marginTop: 4,
    },
    punchButtonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
        zIndex: 10,
    },
    punchButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: -20,
        ...shadows.floating,
        borderWidth: 4,
        borderColor: colors.surface,
    },
    punchLabel: {
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
