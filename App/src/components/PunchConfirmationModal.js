import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, typography, spacing } from '../theme/tokens';

const PunchConfirmationModal = ({ 
    visible, 
    onConfirm, 
    onCancel, 
    type = 'OUT',
    totalDistance = 0,
    totalDuration = 0,
    totalVisits = 0,
    isLoading = false 
}) => {
    const isPunchOut = type === 'OUT';

    const formatDuration = (minutes) => {
        if (!minutes) return '0 min';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins} min`;
    };

    const formatDistance = (km) => {
        if (!km) return '0 km';
        if (km < 1) {
            return `${Math.round(km * 1000)} m`;
        }
        return `${km.toFixed(2)} km`;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <View style={[styles.iconContainer, { backgroundColor: isPunchOut ? `${colors.danger}15` : `${colors.primary}15` }]}>
                        <Icon 
                            name={isPunchOut ? 'log-out' : 'log-in'} 
                            size={32} 
                            color={isPunchOut ? colors.danger : colors.primary} 
                        />
                    </View>

                    <Text style={styles.title}>
                        {isPunchOut ? 'Punch Out?' : 'Punch In?'}
                    </Text>

                    <Text style={styles.subtitle}>
                        {isPunchOut 
                            ? 'Record your punch out and end tracking?' 
                            : 'Record your punch in and start tracking?'}
                    </Text>

                    {isPunchOut && (
                        <View style={styles.summaryContainer}>
                            <View style={styles.summaryItem}>
                                <Icon name="navigation" size={18} color={colors.info} />
                                <Text style={styles.summaryValue}>{formatDistance(totalDistance)}</Text>
                                <Text style={styles.summaryLabel}>Distance</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Icon name="clock" size={18} color={colors.warning} />
                                <Text style={styles.summaryValue}>{formatDuration(totalDuration)}</Text>
                                <Text style={styles.summaryLabel}>Duration</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Icon name="map-pin" size={18} color={colors.success} />
                                <Text style={styles.summaryValue}>{totalVisits}</Text>
                                <Text style={styles.summaryLabel}>Visits</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onCancel}
                            disabled={isLoading}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.button, 
                                styles.confirmButton,
                                { backgroundColor: isPunchOut ? colors.danger : colors.primary }
                            ]}
                            onPress={onConfirm}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            {isLoading ? (
                                <Text style={styles.confirmButtonText}>Processing...</Text>
                            ) : (
                                <Text style={styles.confirmButtonText}>
                                    {isPunchOut ? 'Punch Out' : 'Punch In'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modal: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    summaryContainer: {
        flexDirection: 'row',
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: spacing.md,
        width: '100%',
        marginBottom: spacing.lg,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: colors.border,
        marginHorizontal: spacing.sm,
    },
    summaryValue: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginTop: spacing.xs,
    },
    summaryLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: colors.background,
        marginRight: spacing.sm,
    },
    cancelButtonText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
    },
    confirmButton: {
        marginLeft: spacing.sm,
    },
    confirmButtonText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
    },
});

export default PunchConfirmationModal;
