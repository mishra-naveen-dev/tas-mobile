import React, { useEffect, useRef, useState, Fragment } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

const AnimatedText = ({ value, suffix = '', prefix = '', duration = 800 }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const [displayValue, setDisplayValue] = useState('0');
    const prevValue = useRef(value);

    useEffect(() => {
        if (prevValue.current !== value) {
            prevValue.current = value;
            animatedValue.setValue(0);
            Animated.timing(animatedValue, {
                toValue: value,
                duration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }).start();

            const listener = animatedValue.addListener(({ value: val }) => {
                if (Number.isInteger(value)) {
                    setDisplayValue(Math.round(val).toString());
                } else {
                    setDisplayValue(val.toFixed(1));
                }
            });

            return () => animatedValue.removeListener(listener);
        }
    }, [value, duration, animatedValue]);

    return (
        <Text style={styles.value}>
            {prefix}{displayValue}{suffix}
        </Text>
    );
};

const StatCard = ({ data = [], columns = 2, style }) => {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.grid}>
                {data.map((item, index) => {
                    const isLastInRow = (index + 1) % columns === 0;
                    const isLastRow = index >= data.length - (data.length % columns || columns);
                    
                    return (
                        <Fragment key={item.label}>
                            <View style={styles.statItem}>
                                <View style={[styles.iconWrapper, { backgroundColor: item.bgColor }]}>
                                    <Icon name={item.icon} size={20} color={item.iconColor} />
                                </View>
                                <AnimatedText 
                                    value={item.value} 
                                    suffix={item.suffix || ''} 
                                    prefix={item.prefix || ''} 
                                />
                                <Text style={styles.label}>{item.label}</Text>
                            </View>
                            {!isLastInRow && <View style={styles.verticalDivider} />}
                        </Fragment>
                    );
                })}
            </View>
            {data.length > columns && <View style={styles.horizontalDivider} />}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        ...shadows.md,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    statItem: {
        flex: 1,
        minWidth: '40%',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    value: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    label: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xxs,
    },
    verticalDivider: {
        width: 1,
        backgroundColor: colors.divider,
        marginHorizontal: spacing.sm,
    },
    horizontalDivider: {
        height: 1,
        backgroundColor: colors.divider,
        marginTop: spacing.md,
    },
});

export default StatCard;
