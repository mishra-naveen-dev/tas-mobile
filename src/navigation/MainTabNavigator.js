import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Feather';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import ApplyAllowanceScreen from '../screens/ApplyAllowanceScreen';
import PunchCorrectionScreen from '../screens/PunchCorrectionScreen';
import HistoryHubScreen from '../screens/HistoryHubScreen';

import { colors, fonts } from '../theme/tokens';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ color, size }) => {
                    let iconName;

                    if (route.name === 'Home') {
                        iconName = 'home';
                    } else if (route.name === 'Allowance') {
                        iconName = 'file-text';
                    } else if (route.name === 'Correction') {
                        iconName = 'file-text';
                    }
                    else if (route.name === 'History') {
                        iconName = 'clock';
                    }

                    return <Icon name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingBottom: 5,
                    paddingTop: 5,
                    height: 60,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                }
            })}
        >
            <Tab.Screen name="Home" component={DashboardScreen} />
            <Tab.Screen name="Allowance" component={ApplyAllowanceScreen} />
            <Tab.Screen name="Correction" component={PunchCorrectionScreen} />
            <Tab.Screen name="History" component={HistoryHubScreen} />
        </Tab.Navigator>
    );
};

export default MainTabNavigator;
