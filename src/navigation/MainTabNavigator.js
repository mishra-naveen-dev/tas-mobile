import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';

import DashboardScreen from '../screens/DashboardScreen';
import ApplyAllowanceScreen from '../screens/ApplyAllowanceScreen';
import PunchCorrectionScreen from '../screens/PunchCorrectionScreen';
import HistoryHubScreen from '../screens/HistoryHubScreen';

import CustomTabBar from './CustomTabBar';
import { colors } from '../theme/tokens';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
    const navigation = useNavigation();

    const handlePunchPress = () => {
        navigation.navigate('Punch');
    };

    return (
        <View style={styles.container}>
            <Tab.Navigator
                tabBar={(props) => (
                    <CustomTabBar {...props} onPunchPress={handlePunchPress} />
                )}
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Tab.Screen name="Home" component={DashboardScreen} />
                <Tab.Screen name="Correction" component={PunchCorrectionScreen} />
                <Tab.Screen name="Allowance" component={ApplyAllowanceScreen} />
                <Tab.Screen name="History" component={HistoryHubScreen} />
                <Tab.Screen 
                    name="More" 
                    component={DashboardScreen}
                    listeners={{
                        tabPress: (e) => e.preventDefault(),
                    }}
                />
            </Tab.Navigator>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
});

export default MainTabNavigator;
