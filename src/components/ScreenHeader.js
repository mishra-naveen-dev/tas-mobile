import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../theme/tokens';

const ScreenHeader = ({
    title,
    subtitle,
    navigation,
    showBack = true,
    onBackPress,
    rightComponent,
    showLogout = false,
    onLogout,
    style,
}) => {
    const handleBack = () => {
        if (onBackPress) {
            onBackPress();
            return;
        }

        if (navigation?.canGoBack?.()) {
            navigation.goBack();
        } else {
            navigation?.navigate?.('AdminDashboard');
        }
    };

    const handleLogout = () => {
        if (onLogout) {
            onLogout();
        }
    };

    return (
        <View style={[styles.header, style]}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
            <View style={styles.headerContent}>
                {showBack && (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                        activeOpacity={0.7}
                    >
                        <Icon name="arrow-left" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                )}

                <View style={[styles.titleContainer, !showBack && styles.titleContainerFull]}>
                    <Text style={styles.title} numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    )}
                </View>

                {rightComponent ? (
                    rightComponent
                ) : showLogout ? (
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogout}
                        activeOpacity={0.7}
                    >
                        <Icon name="log-out" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.placeholder} />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        backgroundColor: colors.primaryDark,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.md,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: spacing.sm,
    },
    titleContainerFull: {
        alignItems: 'flex-start',
    },
    title: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
        textAlign: 'center',
    },
    logoutButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholder: {
        width: 44,
    },
});

export default ScreenHeader;
