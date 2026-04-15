import React, { useCallback, useRef, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Animated,
    Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, spacing, typography } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FAB_COLOR = '#2563EB';
const FAB_DARK = '#1D4ED8';

const TAB_CONFIG = {
    items: [
        { key: 'HomeTab', label: 'Home', icon: 'home' },
        { key: 'CorrectionTab', label: 'Correction', icon: 'edit-3' },
        { key: 'AllowanceTab', label: 'Allowance', icon: 'file-text' },
        { key: 'MoreTab', label: 'More', icon: 'grid' },
    ],
    punchButton: {
        key: 'PunchTab',
        label: 'Punch',
        icon: 'map-pin',
    },
    tabBarHeight: 65,
    fabSize: 56,
};

const TabItem = memo(({ item, isFocused, onPress, labelStyle }) => (
    <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.tabItem}
    >
        <Icon
            name={item.icon}
            size={30}
            color={isFocused ? colors.primary : colors.textMuted}
            style={styles.tabIcon}
        />
        <Text style={[styles.tabLabel, labelStyle, isFocused && styles.tabLabelActive]}>
            {item.label}
        </Text>
    </TouchableOpacity>
));

const PunchButton = memo(({ onPress }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            tension: 150,
            friction: 10,
        }).start();
    }, [scaleAnim]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 150,
            friction: 10,
        }).start();
    }, [scaleAnim]);

    return (
        <Animated.View
            style={[styles.fabWrapper, { transform: [{ scale: scaleAnim }] }]}
        >
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                style={({ pressed }) => [
                    styles.fabButton,
                    pressed && styles.fabButtonPressed
                ]}
            >
            <View style={styles.fabInner}>
                <Icon name={TAB_CONFIG.punchButton.icon} size={30} color={colors.white} />
            </View>
            </TouchableOpacity>
            <Text style={styles.fabLabel}>{TAB_CONFIG.punchButton.label}</Text>
        </Animated.View>
    );
});

const CustomTabBar = ({ state, descriptors, navigation }) => {
    const tabWidth = (SCREEN_WIDTH - TAB_CONFIG.fabSize) / TAB_CONFIG.items.length;

    const handleTabPress = useCallback((route, isFocused) => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    }, [navigation]);

    const handlePunchPress = useCallback(() => {
        navigation.navigate('Punch');
    }, [navigation]);

    return (
        <View style={styles.container}>
            {/* FAB - Above Tab Bar */}
            <View style={styles.fabContainer}>
                <PunchButton onPress={handlePunchPress} />
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                <View style={styles.tabBarContent}>
                    {/* Home Tab */}
                    {(() => {
                        const route = state.routes[0];
                        const { options } = descriptors[route.key] || {};
                        const isFocused = state.index === 0;
                        return (
                            <TabItem
                                item={{ ...TAB_CONFIG.items[0], icon: 'home' }}
                                isFocused={isFocused}
                                onPress={() => handleTabPress(route, isFocused)}
                                labelStyle={styles.tabLabelNormal}
                            />
                        );
                    })()}

                    {/* Correction Tab */}
                    {(() => {
                        const route = state.routes[1];
                        const { options } = descriptors[route.key] || {};
                        const isFocused = state.index === 1;
                        return (
                            <TabItem
                                item={TAB_CONFIG.items[1]}
                                isFocused={isFocused}
                                onPress={() => handleTabPress(route, isFocused)}
                                labelStyle={styles.tabLabelNormal}
                            />
                        );
                    })()}

                    {/* Center Spacer */}
                    <View style={styles.centerSpacer} />

                    {/* Allowance Tab */}
                    {(() => {
                        const route = state.routes[2];
                        const { options } = descriptors[route.key] || {};
                        const isFocused = state.index === 2;
                        return (
                            <TabItem
                                item={TAB_CONFIG.items[2]}
                                isFocused={isFocused}
                                onPress={() => handleTabPress(route, isFocused)}
                                labelStyle={styles.tabLabelNormal}
                            />
                        );
                    })()}

                    {/* More Tab */}
                    {(() => {
                        const route = state.routes[3];
                        const { options } = descriptors[route.key] || {};
                        const isFocused = state.index === 3;
                        const moreIcon = isFocused ? 'grid' : 'grid';
                        return (
                            <TabItem
                                item={{ ...TAB_CONFIG.items[3], icon: moreIcon }}
                                isFocused={isFocused}
                                onPress={() => handleTabPress(route, isFocused)}
                                labelStyle={styles.tabLabelNormal}
                            />
                        );
                    })()}
                </View>
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
        backgroundColor: 'transparent',
    },
    fabContainer: {
        position: 'absolute',
        left: SCREEN_WIDTH / 2 - TAB_CONFIG.fabSize / 2,
        bottom: 20,
        zIndex: 101,
        alignItems: 'center',
    },
    fabWrapper: {
        alignItems: 'center',
    },
    fabButton: {
        width: TAB_CONFIG.fabSize,
        height: TAB_CONFIG.fabSize,
        borderRadius: TAB_CONFIG.fabSize / 2,
        backgroundColor: FAB_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: FAB_COLOR,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    fabButtonPressed: {
        transform: [{ scale: 0.95 }],
        backgroundColor: FAB_DARK,
    },
    fabInner: {
        width: TAB_CONFIG.fabSize - 6,
        height: TAB_CONFIG.fabSize - 6,
        borderRadius: (TAB_CONFIG.fabSize - 6) / 2,
        backgroundColor: FAB_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    fabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: FAB_COLOR,
        marginTop: 4,
    },
    tabBar: {
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    tabBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        height: TAB_CONFIG.tabBarHeight,
        paddingHorizontal: spacing.xs,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    tabIcon: {
        marginBottom: 2,
    },
    tabLabelNormal: {
        marginTop: 2,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        color: colors.textMuted,
    },
    tabLabelActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    centerSpacer: {
        width: TAB_CONFIG.fabSize + 8,
    },
});

export default CustomTabBar;
