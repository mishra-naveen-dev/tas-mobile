import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import DashboardScreen from '../screens/Common/DashboardScreen';
import CollectionsScreen from '../screens/Common/CollectionsScreen';
import PunchCorrectionScreen from '../screens/Common/PunchCorrectionScreen';
import HistoryHubScreen from '../screens/Common/HistoryHubScreen';
import EmployeePunchScreen from '../screens/Employee/EmployeePunchScreen';

import CustomTabBar from './CustomTabBar';
import { colors } from '../theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
                <Tab.Screen name="Collections" component={CollectionsScreen} />
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

export const MainStackNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen name="Punch" component={EmployeePunchScreen} />
        </Stack.Navigator>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
});

export default MainTabNavigator;