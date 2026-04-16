import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

const Header = ({
    title,
    subtitle,
    showBack = false,
    onBackPress,
    rightComponent,
    variant = 'default',
    style,
}) => {
    const isDark = variant === 'dark';

    return (
        <View style={[styles.wrapper, isDark && styles.darkWrapper, style]}>
            <SafeAreaView edges={['top']}>
                <View style={[styles.container, isDark && styles.darkContainer]}>
                    {showBack ? (
                        <TouchableOpacity 
                            onPress={onBackPress} 
                            style={styles.backButton}
                            activeOpacity={0.7}
                        >
                            <Icon 
                                name="arrow-left" 
                                size={24} 
                                color={isDark ? '#FFFFFF' : colors.textDark} 
                            />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.spacer} />
                    )}

                    <View style={styles.titleContainer}>
                        {title && (
                            <Text 
                                style={[
                                    styles.title,
                                    isDark && styles.darkTitle
                                ]}
                                numberOfLines={1}
                            >
                                {title}
                            </Text>
                        )}
                        {subtitle && (
                            <Text 
                                style={[
                                    styles.subtitle,
                                    isDark && styles.darkSubtitle
                                ]}
                                numberOfLines={1}
                            >
                                {subtitle}
                            </Text>
                        )}
                    </View>

                    {rightComponent ? (
                        rightComponent
                    ) : (
                        <View style={styles.spacer} />
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: colors.surface,
    },
    darkWrapper: {
        backgroundColor: colors.primaryDark,
        borderBottomLeftRadius: borderRadius.xl,
        borderBottomRightRadius: borderRadius.xl,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        minHeight: 56,
    },
    darkContainer: {
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : colors.divider,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spacer: {
        width: 44,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        textAlign: 'center',
    },
    darkTitle: {
        color: '#FFFFFF',
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    darkSubtitle: {
        color: 'rgba(255,255,255,0.8)',
    },
});

export default Header;
