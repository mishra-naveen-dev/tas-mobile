import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ActivityIcon from './ActivityIcon';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';
import ActivityPresenter from '../presenters/ActivityPresenter';

const ActivityCard = ({ activity, onPress, showTime = true }) => {
    const config = useMemo(() => 
        ActivityPresenter.getActivityConfig(activity.type),
        [activity.type]
    );

    const title = useMemo(() => 
        ActivityPresenter.formatActivityTitle(activity),
        [activity]
    );

    const subtitle = useMemo(() => 
        ActivityPresenter.formatActivitySubtitle(activity),
        [activity]
    );

    const time = useMemo(() => 
        ActivityPresenter.formatTime(activity.timestamp),
        [activity.timestamp]
    );

    const amount = useMemo(() => 
        ActivityPresenter.getActivityAmount(activity),
        [activity]
    );

    const isCollection = activity.type === 'COLLECTION';
    const isDebit = activity.type === 'DISBURSEMENT';

    return (
        <TouchableOpacity 
            style={styles.container} 
            onPress={onPress}
            activeOpacity={0.7}
        >
            <ActivityIcon type={activity.type} size="md" />
            
            <View style={styles.content}>
                <View style={styles.leftContent}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    {subtitle && (
                        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                    )}
                </View>

                <View style={styles.rightContent}>
                    {amount ? (
                        <View style={styles.amountContainer}>
                            <Text style={[
                                styles.amount,
                                isCollection && styles.amountCredit,
                                isDebit && styles.amountDebit,
                            ]}>
                                {isCollection ? '+' : isDebit ? '-' : ''}{amount.prefix}{amount.value.toLocaleString()}
                            </Text>
                            {showTime && <Text style={styles.time}>{time}</Text>}
                        </View>
                    ) : showTime ? (
                        <Text style={styles.time}>{time}</Text>
                    ) : null}
                </View>
            </View>

            <View style={[styles.statusIndicator, { backgroundColor: config.color }]} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
        borderRadius: borderRadius.md,
        ...shadows.xs,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: spacing.sm,
    },
    leftContent: {
        flex: 1,
    },
    rightContent: {
        alignItems: 'flex-end',
        marginLeft: spacing.sm,
    },
    title: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    time: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    amountContainer: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: typography.sizes.base,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    amountCredit: {
        color: '#10B981',
    },
    amountDebit: {
        color: '#8B5CF6',
    },
    statusIndicator: {
        width: 4,
        height: 32,
        borderRadius: 2,
        marginLeft: spacing.xs,
    },
});

export default ActivityCard;
