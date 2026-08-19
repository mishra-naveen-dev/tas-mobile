import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ActivityIcon from './ActivityIcon';
import ActivityPresenter from '../presenters/ActivityPresenter';
import LocationService from '../services/LocationService';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

const Row = ({ icon, label, value }) => {
    if (!value) return null;
    return (
        <View style={styles.row}>
            <Icon name={icon} size={16} color={colors.textMuted} style={styles.rowIcon} />
            <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
            </View>
        </View>
    );
};

const ActivityDetailModal = ({ activity, visible, onClose }) => {
    const title = useMemo(
        () => activity ? ActivityPresenter.formatActivityTitle(activity) : '',
        [activity],
    );
    const amount = useMemo(
        () => activity ? ActivityPresenter.getActivityAmount(activity) : null,
        [activity],
    );

    if (!activity) return null;

    const raw = activity.raw || {};
    const fullDateTime = new Date(activity.timestamp).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const lat = raw.latitude;
    const lng = raw.longitude;
    const hasGps = lat != null && lng != null;
    const loanId = raw.loan_id;
    const customerPhone = raw.customer_phone;
    const address = activity.location;
    const companion = raw.travel_type === 'WITH_EMPLOYEE'
        ? (raw.companion_name || 'Companion not named')
        : (raw.travel_type === 'ALONE' ? 'Alone' : null);
    const isCollection = activity.type === 'COLLECTION';
    const isDebit = activity.type === 'DISBURSEMENT';

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />

                    <View style={styles.header}>
                        <ActivityIcon type={activity.type} size="lg" />
                        <View style={styles.headerText}>
                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.subtitle}>{fullDateTime}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                            <Icon name="x" size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {amount && (
                        <View style={styles.amountBanner}>
                            <Text style={[
                                styles.amountText,
                                isCollection && styles.amountCredit,
                                isDebit && styles.amountDebit,
                            ]}>
                                {isCollection ? '+' : isDebit ? '-' : ''}{amount.prefix}{amount.value.toLocaleString()}
                            </Text>
                        </View>
                    )}

                    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                        <Row icon="user" label="Customer" value={activity.clientName} />
                        <Row icon="map-pin" label="Address" value={address} />
                        <Row icon="phone" label="Phone" value={customerPhone} />
                        <Row icon="credit-card" label="Loan ID" value={loanId} />
                        <Row icon="users" label="Travel" value={companion} />
                        <Row
                            icon="navigation"
                            label="Distance since last punch"
                            value={activity.distance_from_last > 0 ? `${parseFloat(activity.distance_from_last).toFixed(2)} km` : null}
                        />
                        <Row icon="message-square" label="Reason / Notes" value={activity.notes} />
                        <Row icon="tag" label="Status" value={raw.status_display || activity.status} />

                        {hasGps && (
                            <View style={styles.gpsBlock}>
                                <View style={styles.row}>
                                    <Icon name="crosshair" size={16} color={colors.textMuted} style={styles.rowIcon} />
                                    <View style={styles.rowContent}>
                                        <Text style={styles.rowLabel}>GPS Location</Text>
                                        <Text style={styles.rowValue}>{Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.mapButton}
                                    onPress={() => LocationService.openMaps(lat, lng)}
                                >
                                    <Icon name="map" size={16} color={colors.primary} />
                                    <Text style={styles.mapButtonText}>View on Map</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.lg,
        maxHeight: '80%',
        ...shadows.md,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: 'center',
        marginBottom: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    headerText: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    title: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    amountBanner: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    amountText: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    amountCredit: {
        color: '#10B981',
    },
    amountDebit: {
        color: '#8B5CF6',
    },
    body: {
        marginTop: spacing.xs,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    rowIcon: {
        marginTop: 2,
    },
    rowContent: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    rowLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 2,
    },
    rowValue: {
        fontSize: typography.sizes.base,
        color: colors.textDark,
        fontWeight: typography.weights.medium,
    },
    gpsBlock: {
        paddingTop: spacing.xs,
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    mapButtonText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
    },
});

export default ActivityDetailModal;
