import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors } from '../theme/tokens';

const ErrorView = ({ 
    message = 'Something went wrong', 
    onRetry,
    icon = 'alert-circle',
    style 
}) => {
    return (
        <View style={[styles.container, style]}>
            <Icon name={icon} size={56} color={colors.danger} />
            <Text style={styles.message}>{message}</Text>
            {onRetry && (
                <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
                    <Icon name="refresh-cw" size={18} color="#FFFFFF" />
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        marginHorizontal: 16,
    },
    message: {
        fontSize: 16,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
        lineHeight: 24,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default ErrorView;
