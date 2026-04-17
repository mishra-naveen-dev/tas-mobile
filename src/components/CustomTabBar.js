import React, { useRef, useEffect, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors } from '../theme/tokens';

const CustomTabBar = memo(({ state, navigation }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.12,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [pulseAnim]);

    const tabs = [
        { name: 'EmployeeHome', label: 'Home', icon: 'home' },
        { name: 'EmployeeCorrection', label: 'Correction', icon: 'edit' },
        { name: 'EmployeePunch', label: 'Punch', icon: 'map-pin' },
        { name: 'EmployeeAllowance', label: 'Allowance', icon: 'dollar-sign' },
        { name: 'EmployeeMore', label: 'More', icon: 'menu' },
    ];

    const isPunchTab = (routeName) => routeName === 'EmployeePunch';

    const handleTabPress = (route, isFocused) => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.tabBar}>
                {state.routes.map((route) => {
                    const isFocused = state.index === state.routes.findIndex(r => r.key === route.key);
                    const tab = tabs.find(t => t.name === route.name);
                    const label = tab?.label || route.name;
                    const iconName = tab?.icon || 'circle';

                    if (isPunchTab(route.name)) {
                        return (
                            <View key={route.key} style={styles.punchTabContainer}>
                                <Animated.View style={[styles.punchButtonOuter, { transform: [{ scale: pulseAnim }] }]}>
                                    <TouchableOpacity
                                        style={styles.punchButton}
                                        onPress={() => handleTabPress(route, isFocused)}
                                        activeOpacity={0.85}
                                    >
                                        <Icon name="map-pin" size={26} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </Animated.View>
                                <Text style={styles.punchLabel}>Punch</Text>
                            </View>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            style={styles.tab}
                            onPress={() => handleTabPress(route, isFocused)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconContainer, isFocused && styles.iconContainerActive]}>
                                <Icon
                                    name={iconName}
                                    size={22}
                                    color={isFocused ? colors.primary : colors.textMuted}
                                />
                            </View>
                            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        paddingBottom: Platform.OS === 'ios' ? 28 : 14,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    iconContainer: {
        width: 36,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
    },
    iconContainerActive: {
        backgroundColor: '#FEE2E2',
    },
    tabLabel: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 4,
        fontWeight: '500',
    },
    tabLabelActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    punchTabContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: -42,
    },
    punchButtonOuter: {
        transformOrigin: 'center',
    },
    punchButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.punchBlue,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: colors.punchBlue,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        borderWidth: 4,
        borderColor: colors.surface,
    },
    punchLabel: {
        fontSize: 10,
        color: colors.punchBlue,
        fontWeight: '700',
        marginTop: 6,
    },
});

export default CustomTabBar;
