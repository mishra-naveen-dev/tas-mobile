import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../theme/tokens';
import { usePunch } from '../context/PunchContext';

const CustomTabBar = ({ state, descriptors, navigation }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const { isActive: isPunchActive, punchState } = usePunch();
    const isCurrentPunchTab = state.routes[state.index]?.name === 'EmployeePunch';

    useEffect(() => {
        let animation;
        if (isPunchActive) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
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
        { name: 'EmployeePunch', label: '', icon: '' },
        { name: 'EmployeeAllowance', label: 'Allowance', icon: 'dollar-sign' },
        { name: 'EmployeeMore', label: 'More', icon: 'menu' },
    ];

    const getIconName = (routeName) => {
        const tab = tabs.find(t => t.name === routeName);
        return tab?.icon || 'circle';
    };

    const isPunchTab = (routeName) => routeName === 'EmployeePunch';

    const getPunchButtonContent = () => {
        if (isPunchActive) {
            return (
                <View style={styles.punchButtonInner}>
                    <Icon name="square" size={20} color="#FFFFFF" style={styles.stopIcon} />
                    <Text style={styles.punchButtonText}>STOP</Text>
                </View>
            );
        }
        return (
            <View style={styles.punchButtonInner}>
                <Icon name="log-in" size={24} color="#FFFFFF" style={styles.punchIcon} />
                <Text style={styles.punchButtonText}>PUNCH</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const isFocused = state.index === index;
                    const tab = tabs.find(t => t.name === route.name);
                    const label = tab?.label || route.name;
                    const iconName = getIconName(route.name);

                    if (isPunchTab(route.name)) {
                        return (
                            <View key={route.key} style={styles.punchTabContainer}>
                                <Animated.View style={[styles.punchButtonOuter, { transform: [{ scale: pulseAnim }] }]}>
                                    <TouchableOpacity
                                        style={[
                                            styles.punchButton,
                                            { backgroundColor: isPunchActive ? '#DC2626' : colors.punchBlue }
                                        ]}
                                        onPress={() => navigation.navigate(route.name)}
                                        activeOpacity={0.85}
                                    >
                                        {getPunchButtonContent()}
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
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        paddingTop: 12,
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
        justifyContent: 'flex-start',
        marginTop: -45,
    },
    punchButtonOuter: {
        transformOrigin: 'center',
    },
    punchButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
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
    punchButtonInner: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    punchIcon: {
        marginBottom: 2,
    },
    stopIcon: {
        marginBottom: 2,
    },
    punchButtonText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 2,
    },
});

export default CustomTabBar;
