import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, borderRadius, spacing } from '../theme/tokens';

const ActivityIcon = ({ type, size = 'md' }) => {
    const iconConfigs = {
        PUNCH_IN: { icon: 'log-in', color: '#10B981', bgColor: '#D1FAE5' },
        PUNCH_OUT: { icon: 'log-out', color: '#EF4444', bgColor: '#FEE2E2' },
        VISIT: { icon: 'map-pin', color: '#2563EB', bgColor: '#DBEAFE' },
        COLLECTION: { icon: 'dollar-sign', color: '#F59E0B', bgColor: '#FEF3C7' },
        DISBURSEMENT: { icon: 'trending-up', color: '#8B5CF6', bgColor: '#EDE9FE' },
        TRAVEL: { icon: 'navigation', color: '#64748B', bgColor: '#F1F5F9' },
        OTHER: { icon: 'activity', color: '#64748B', bgColor: '#F1F5F9' },
    };

    const config = iconConfigs[type] || iconConfigs.OTHER;
    const sizeConfig = {
        sm: { wrapper: 32, icon: 14 },
        md: { wrapper: 40, icon: 18 },
        lg: { wrapper: 48, icon: 22 },
    };

    const { wrapper, icon } = sizeConfig[size] || sizeConfig.md;

    return (
        <View style={[
            styles.wrapper,
            { 
                width: wrapper, 
                height: wrapper, 
                borderRadius: wrapper / 3,
                backgroundColor: config.bgColor 
            }
        ]}>
            <Icon name={config.icon} size={icon} color={config.color} />
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ActivityIcon;
