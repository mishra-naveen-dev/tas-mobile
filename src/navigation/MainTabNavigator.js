import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import ApplyAllowanceScreen from '../screens/ApplyAllowanceScreen';
import PunchCorrectionScreen from '../screens/PunchCorrectionScreen';
import HistoryHubScreen from '../screens/HistoryHubScreen';

import { colors } from '../theme/tokens';

// Try to import icon, fallback to text if not available
let TabIcon;
try {
    const FeatherIcon = require('react-native-vector-icons/Feather').default;
    TabIcon = ({ name, color, size }) => (
        <FeatherIcon name={name} size={size} color={color} />
    );
} catch (e) {
    TabIcon = ({ name, color, size }) => (
        <Text style={{ fontSize: size - 6, color }}>{name[0].toUpperCase()}</Text>
    );
}

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ color, size }) => {
                    let iconName;
                    
                    switch (route.name) {
                        case 'Home':
                            iconName = 'home';
                            break;
                        case 'Allowance':
                            iconName = 'file-text';
                            break;
                        case 'Correction':
                            iconName = 'edit-3';
                            break;
                        case 'History':
                            iconName = 'clock';
                            break;
                        default:
                            iconName = 'circle';
                    }

                    return <TabIcon name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: colors.primary || '#667eea',
                tabBarInactiveTintColor: colors.textMuted || '#999',
                tabBarStyle: {
                    backgroundColor: colors.surface || '#fff',
                    borderTopWidth: 1,
                    borderTopColor: colors.border || '#ddd',
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
            <Tab.Screen 
                name="Home" 
                component={DashboardScreen}
                options={{ tabBarLabel: 'Home' }}
            />
            <Tab.Screen 
                name="Allowance" 
                component={ApplyAllowanceScreen}
                options={{ tabBarLabel: 'Allowance' }}
            />
            <Tab.Screen 
                name="Correction" 
                component={PunchCorrectionScreen}
                options={{ tabBarLabel: 'Correction' }}
            />
            <Tab.Screen 
                name="History" 
                component={HistoryHubScreen}
                options={{ tabBarLabel: 'History' }}
            />
        </Tab.Navigator>
    );
};

export default MainTabNavigator;