import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../theme/tokens';
import { usePunch } from '../context/PunchContext';

const CustomTabBar = ({ state, descriptors, navigation }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const { isActive: isPunchActive } = usePunch();
    const isCurrentPunchTab = state.routes[state.index]?.name === 'EmployeePunch';

    useEffect(() => {
        let animation;
        if (isPunchActive) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }

        return () => {
            if (animation) animation.stop();
        };
    }, [isPunchActive]);

    const tabs = [
        { name: 'EmployeeHome', label: 'Home', icon: 'home' },
        { name: 'EmployeeCorrection', label: 'Correction', icon: 'edit' },
        { name: 'EmployeePunch', label: 'Punch', icon: 'map-pin' },
        { name: 'EmployeeAllowance', label: 'Allowance', icon: 'dollar-sign' },
        { name: 'EmployeeMore', label: 'More', icon: 'menu' },
    ];

    const getIconName = (routeName) => {
        const tab = tabs.find(t => t.name === routeName);
        return tab?.icon || 'circle';
    };

    const isPunchTab = (routeName) => routeName === 'EmployeePunch';

    return (
        <View style={styles.container}>
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const isFocused = state.index === index;
                    const label = tabs.find(t => t.name === route.name)?.label || route.name;
                    const iconName = getIconName(route.name);

                    if (isPunchTab(route.name)) {
                        return (
                            <View key={route.key} style={styles.punchTabContainer}>
                                <Animated.View style={[styles.punchButtonWrapper, { transform: [{ scale: pulseAnim }] }]}>
                                    <TouchableOpacity
                                        style={[
                                            styles.punchButton,
                                            { backgroundColor: isPunchActive ? colors.success : colors.punchBlue }
                                        ]}
                                        onPress={() => navigation.navigate(route.name)}
                                        activeOpacity={0.8}
                                    >
                                        <Icon name={iconName} size={26} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            style={styles.tab}
                            onPress={() => {
                                const event = navigation.emit({
                                    type: 'tabPress',
                                    target: route.key,
                                    canPreventDefault: true,
                                });

                                if (!isFocused && !event.defaultPrevented) {
                                    navigation.navigate(route.name);
                                }
                            }}
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
};

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
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
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
        backgroundColor: colors.primaryLight,
    },
    tabLabel: {
        fontSize: typography.sizes.xs,
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
        justifyContent: 'center',
        marginTop: -35,
    },
    punchButtonWrapper: {
        transformOrigin: 'center',
    },
    punchButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: colors.punchBlue,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        borderWidth: 4,
        borderColor: colors.surface,
    },
});

export default CustomTabBar;
