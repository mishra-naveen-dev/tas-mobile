import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Alert,
    TextInput,
    Modal,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { usePunch } from '../context/PunchContext';
import { colors, typography, spacing } from '../theme/tokens';

const VISIT_TYPES = [
    { value: 'COLLECTION', label: 'Collection' },
    { value: 'DISBURSEMENT', label: 'Disbursement' },
    { value: 'OTHER', label: 'Other' },
];

const PAYMENT_MODES = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CHEQUE', label: 'Cheque' },
];

const TRAVEL_WITH = [
    { value: 'ALONE', label: 'Alone' },
    { value: 'WITH_EMPLOYEE', label: 'With Employee' },
];

const EmployeePunchScreen = ({ navigation }) => {
    const auth = useAuth();
    const { 
        isActive, 
        isIdle, 
        isCompleted,
        punchStartTime, 
        getTotalDistance, 
        getTrackingDuration,
        punchIn,
        punchOut,
        isLoading: punchLoading,
        refreshPunches
    } = usePunch();

    const [showModal, setShowModal] = useState(false);
    const [todayPunches, setTodayPunches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState('');

    const [formData, setFormData] = useState({
        latitude: null,
        longitude: null,
        current_address: '',
        customer_address: '',
        reason: '',
        visit_type: '',
        loan_id: '',
        amount: '',
        payment_mode: '',
        upi_ref: '',
        cheque_no: '',
        customer_name: '',
        travel_with: 'ALONE',
        co_employee_id: '',
        co_employee_name: '',
    });

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        loadTodayPunches();
    }, []);

    useEffect(() => {
        if (isActive) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isActive, pulseAnim]);

    const loadTodayPunches = async () => {
        try {
            const res = await api.getTodayPunches();
            const punches = res.data?.results || res.data || [];
            setTodayPunches(punches);
        } catch (err) {
            console.log('Error loading punches:', err);
        }
    };

    const getCurrentLocation = async () => {
        setLocationLoading(true);
        setLocationError('');

        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                setLocationError('Geolocation not supported');
                setLocationLoading(false);
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                        );
                        const result = await response.json();
                        const address = result.display_name || '';
                        
                        resolve({ latitude, longitude, address });
                    } catch (err) {
                        resolve({ latitude, longitude, address: '' });
                    }
                },
                (error) => {
                    let errorMsg = 'Failed to get location';
                    switch (error.code) {
                        case 1:
                            errorMsg = 'Permission denied. Enable location.';
                            break;
                        case 2:
                            errorMsg = 'Location unavailable. Turn on GPS.';
                            break;
                        case 3:
                            errorMsg = 'Location timeout.';
                            break;
                    }
                    setLocationError(errorMsg);
                    reject(new Error(errorMsg));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }
            );
        }).finally(() => {
            setLocationLoading(false);
        });
    };

    const handleOpenPunch = async () => {
        if (isActive) {
            setShowModal(true);
            return;
        }

        try {
            const location = await getCurrentLocation();
            setFormData(prev => ({
                ...prev,
                latitude: location.latitude,
                longitude: location.longitude,
                current_address: location.address,
                customer_address: '',
                reason: '',
                visit_type: '',
                loan_id: '',
                amount: '',
                payment_mode: '',
                upi_ref: '',
                cheque_no: '',
                customer_name: '',
                travel_with: 'ALONE',
                co_employee_id: '',
                co_employee_name: '',
            }));
            setShowModal(true);
        } catch (err) {
            Alert.alert('Location Error', err.message);
        }
    };

    const handlePunchPress = () => {
        if (punchLoading) return;

        if (isIdle) {
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
            ]).start();

            handleOpenPunch();
        } else if (isActive) {
            setShowModal(true);
        }
    };

    const updateForm = (key, value) => {
        setFormData(prev => {
            const updated = { ...prev, [key]: value };
            
            if (key === 'visit_type') {
                updated.loan_id = '';
                updated.amount = '';
                updated.payment_mode = '';
            }
            
            if (key === 'travel_with') {
                updated.co_employee_id = '';
                updated.co_employee_name = '';
            }
            
            return updated;
        });
    };

    const handleSubmitPunch = async () => {
        if (!formData.visit_type) {
            Alert.alert('Required', 'Please select a visit type');
            return;
        }

        if ((formData.visit_type === 'COLLECTION' || formData.visit_type === 'DISBURSEMENT') && 
            (!formData.loan_id || !formData.amount)) {
            Alert.alert('Required', 'Loan ID and Amount are required');
            return;
        }

        if (formData.visit_type === 'COLLECTION' && !formData.payment_mode) {
            Alert.alert('Required', 'Payment mode is required for Collection');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                punch_type: isActive ? 'PUNCH_OUT' : 'PUNCH_IN',
                latitude: formData.latitude || null,
                longitude: formData.longitude || null,
                current_address: formData.current_address || '',
                customer_address: formData.customer_address || '',
                reason: formData.reason || '',
                visit_type: formData.visit_type,
                loan_id: formData.loan_id || '',
                amount: formData.amount ? parseFloat(formData.amount) : null,
                payment_mode: formData.payment_mode || '',
                upi_ref: formData.upi_ref || '',
                cheque_no: formData.cheque_no || '',
                customer_name: formData.customer_name || '',
                travel_with: formData.travel_with,
                co_employee_id: formData.co_employee_id || '',
                co_employee_name: formData.co_employee_name || '',
                notes: formData.reason || '',
            };

            await api.createPunchRecord(payload);
            
            if (isActive) {
                await punchOut();
            } else {
                await punchIn();
            }
            
            await loadTodayPunches();
            await refreshPunches();
            
            setShowModal(false);
            
            Alert.alert('Success', isActive ? 'Punched out successfully!' : 'Punched in successfully!');
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to submit punch');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setLocationError('');
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    };

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

    const getPunchIcon = (type) => {
        switch (type) {
            case 'PUNCH_IN': return 'log-in';
            case 'PUNCH_OUT': return 'log-out';
            case 'COLLECTION': return 'dollar-sign';
            case 'DISBURSEMENT': return 'trending-up';
            default: return 'map-pin';
        }
    };

    const getPunchColor = (type) => {
        switch (type) {
            case 'PUNCH_IN': return colors.success;
            case 'PUNCH_OUT': return colors.danger;
            case 'COLLECTION': return colors.success;
            case 'DISBURSEMENT': return colors.warning;
            default: return colors.primary;
        }
    };

    const duration = getTrackingDuration();
    const distance = getTotalDistance();

    const visitCount = todayPunches.filter(p => 
        p.visit_type && ['COLLECTION', 'DISBURSEMENT', 'OTHER'].includes(p.visit_type)
    ).length;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backBtn} 
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Punch</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.mainCard}>
                    <Animated.View style={[
                        styles.statusIndicator,
                        { 
                            backgroundColor: isActive ? `${colors.success}15` : isCompleted ? `${colors.textMuted}15` : `${colors.primary}15` ,
                            transform: [{ scale: pulseAnim }]
                        }
                    ]}>
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: isActive ? colors.success : isCompleted ? colors.textMuted : colors.primary }
                        ]} />
                        <Text style={[
                            styles.statusText,
                            { color: isActive ? colors.success : isCompleted ? colors.textMuted : colors.primary }
                        ]}>
                            {isActive ? 'Tracking Active' : isCompleted ? 'Day Completed' : 'Ready to Punch'}
                        </Text>
                    </Animated.View>

                    {isActive && punchStartTime && (
                        <Text style={styles.startTimeText}>
                            Punched in at {formatTime(punchStartTime)}
                        </Text>
                    )}

                    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                        <TouchableOpacity
                            style={[
                                styles.mainButton,
                                { 
                                    backgroundColor: isActive ? colors.success : isCompleted ? colors.textMuted : colors.primary
                                }
                            ]}
                            onPress={handlePunchPress}
                            disabled={punchLoading || isCompleted}
                            activeOpacity={0.8}
                        >
                            <Icon 
                                name={isActive ? 'log-out' : 'map-pin'} 
                                size={48} 
                                color="#FFFFFF" 
                            />
                        </TouchableOpacity>
                    </Animated.View>

                    <Text style={styles.mainButtonLabel}>
                        {isActive ? 'Tap to Punch Out' : isCompleted ? 'Come back tomorrow' : 'Tap to Punch In'}
                    </Text>
                </View>

                {isActive && (
                    <View style={styles.trackingStats}>
                        <Text style={styles.sectionTitle}>Live Tracking</Text>
                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <Icon name="navigation" size={24} color={colors.info} />
                                <Text style={styles.statValue}>{formatDistance(distance)}</Text>
                                <Text style={styles.statLabel}>Distance</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Icon name="clock" size={24} color={colors.warning} />
                                <Text style={styles.statValue}>{formatDuration(duration)}</Text>
                                <Text style={styles.statLabel}>Duration</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Icon name="map-pin" size={24} color={colors.success} />
                                <Text style={styles.statValue}>{visitCount}</Text>
                                <Text style={styles.statLabel}>Visits</Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.activitySection}>
                    <Text style={styles.sectionTitle}>Today's Activity</Text>
                    {todayPunches.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Icon name="inbox" size={48} color={colors.textLight} />
                            <Text style={styles.emptyText}>No activity recorded yet</Text>
                        </View>
                    ) : (
                        todayPunches.map((punch, index) => (
                            <View key={punch.id || index} style={styles.activityItem}>
                                <View style={[
                                    styles.activityIcon,
                                    { backgroundColor: `${getPunchColor(punch.visit_type || punch.punch_type)}15` }
                                ]}>
                                    <Icon 
                                        name={getPunchIcon(punch.visit_type || punch.punch_type)} 
                                        size={20} 
                                        color={getPunchColor(punch.visit_type || punch.punch_type)} 
                                    />
                                </View>
                                <View style={styles.activityContent}>
                                    <Text style={styles.activityType}>
                                        {String(punch.visit_type || punch.punch_type || 'Punch').replace(/_/g, ' ')}
                                    </Text>
                                    <Text style={styles.activityTime}>
                                        {formatTime(punch.punched_at)}
                                    </Text>
                                    {punch.current_address && (
                                        <Text style={styles.activityAddress} numberOfLines={1}>
                                            {punch.current_address}
                                        </Text>
                                    )}
                                </View>
                                {punch.distance_from_last > 0 && (
                                    <Text style={styles.distanceText}>
                                        {punch.distance_from_last.toFixed(2)} km
                                    </Text>
                                )}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={handleCloseModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Punch Details</Text>
                            <TouchableOpacity onPress={handleCloseModal} style={styles.closeBtn}>
                                <Icon name="x" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {locationError ? (
                                <View style={styles.locationError}>
                                    <Icon name="alert-circle" size={20} color={colors.danger} />
                                    <Text style={styles.locationErrorText}>{locationError}</Text>
                                </View>
                            ) : locationLoading ? (
                                <View style={styles.locationLoading}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text style={styles.locationLoadingText}>Getting location...</Text>
                                </View>
                            ) : formData.current_address ? (
                                <View style={styles.addressDisplay}>
                                    <Icon name="map-pin" size={16} color={colors.success} />
                                    <Text style={styles.addressText} numberOfLines={2}>
                                        {formData.current_address}
                                    </Text>
                                </View>
                            ) : null}

                            <Text style={styles.fieldLabel}>Reason</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.reason}
                                onChangeText={(text) => updateForm('reason', text)}
                                placeholder="Enter reason"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={styles.fieldLabel}>Visit Type *</Text>
                            <View style={styles.selectContainer}>
                                {VISIT_TYPES.map((type) => (
                                    <TouchableOpacity
                                        key={type.value}
                                        style={[
                                            styles.selectOption,
                                            formData.visit_type === type.value && styles.selectOptionActive
                                        ]}
                                        onPress={() => updateForm('visit_type', type.value)}
                                    >
                                        <Text style={[
                                            styles.selectOptionText,
                                            formData.visit_type === type.value && styles.selectOptionTextActive
                                        ]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {(formData.visit_type === 'COLLECTION' || formData.visit_type === 'DISBURSEMENT') && (
                                <View style={styles.financialSection}>
                                    <Text style={styles.fieldLabel}>Loan ID *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.loan_id}
                                        onChangeText={(text) => updateForm('loan_id', text)}
                                        placeholder="Enter Loan ID"
                                        placeholderTextColor={colors.textMuted}
                                    />

                                    <Text style={styles.fieldLabel}>Amount *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.amount}
                                        onChangeText={(text) => updateForm('amount', text)}
                                        placeholder="Enter Amount"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="numeric"
                                    />

                                    {formData.visit_type === 'COLLECTION' && (
                                        <>
                                            <Text style={styles.fieldLabel}>Payment Mode *</Text>
                                            <View style={styles.selectContainer}>
                                                {PAYMENT_MODES.map((mode) => (
                                                    <TouchableOpacity
                                                        key={mode.value}
                                                        style={[
                                                            styles.selectOption,
                                                            formData.payment_mode === mode.value && styles.selectOptionActive
                                                        ]}
                                                        onPress={() => updateForm('payment_mode', mode.value)}
                                                    >
                                                        <Text style={[
                                                            styles.selectOptionText,
                                                            formData.payment_mode === mode.value && styles.selectOptionTextActive
                                                        ]}>
                                                            {mode.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            {formData.payment_mode === 'UPI' && (
                                                <>
                                                    <Text style={styles.fieldLabel}>UPI Reference ID</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={formData.upi_ref}
                                                        onChangeText={(text) => updateForm('upi_ref', text)}
                                                        placeholder="Enter UPI Reference ID"
                                                        placeholderTextColor={colors.textMuted}
                                                    />
                                                </>
                                            )}

                                            {formData.payment_mode === 'CHEQUE' && (
                                                <>
                                                    <Text style={styles.fieldLabel}>Cheque Number</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={formData.cheque_no}
                                                        onChangeText={(text) => updateForm('cheque_no', text)}
                                                        placeholder="Enter Cheque Number"
                                                        placeholderTextColor={colors.textMuted}
                                                    />
                                                </>
                                            )}
                                        </>
                                    )}
                                </View>
                            )}

                            <Text style={styles.fieldLabel}>Customer Address</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.customer_address}
                                onChangeText={(text) => updateForm('customer_address', text)}
                                placeholder="Enter customer address"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={styles.fieldLabel}>Travel With</Text>
                            <View style={styles.selectContainer}>
                                {TRAVEL_WITH.map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.selectOption,
                                            formData.travel_with === option.value && styles.selectOptionActive
                                        ]}
                                        onPress={() => updateForm('travel_with', option.value)}
                                    >
                                        <Text style={[
                                            styles.selectOptionText,
                                            formData.travel_with === option.value && styles.selectOptionTextActive
                                        ]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {formData.travel_with === 'WITH_EMPLOYEE' && (
                                <>
                                    <Text style={styles.fieldLabel}>Employee ID</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.co_employee_id}
                                        onChangeText={(text) => updateForm('co_employee_id', text)}
                                        placeholder="Enter Employee ID"
                                        placeholderTextColor={colors.textMuted}
                                    />

                                    <Text style={styles.fieldLabel}>Employee Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.co_employee_name}
                                        onChangeText={(text) => updateForm('co_employee_name', text)}
                                        placeholder="Enter Employee Name"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={handleCloseModal}
                                disabled={loading}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: isActive ? colors.danger : colors.primary }]}
                                onPress={handleSubmitPunch}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.submitBtnText}>
                                        {isActive ? 'Punch Out' : 'Punch In'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    placeholder: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 140,
    },
    mainCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.xl,
        alignItems: 'center',
        marginTop: spacing.lg,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        marginBottom: spacing.md,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: spacing.sm,
    },
    statusText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
    },
    startTimeText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    mainButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    mainButtonLabel: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
        marginTop: spacing.lg,
    },
    trackingStats: {
        marginTop: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.md,
        alignItems: 'center',
        marginHorizontal: spacing.xxs,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    statValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginTop: spacing.sm,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    activitySection: {
        marginTop: spacing.xl,
    },
    emptyState: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    activityIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    activityContent: {
        flex: 1,
    },
    activityType: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    activityTime: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    activityAddress: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    distanceText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.info,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        padding: spacing.lg,
    },
    modalFooter: {
        flexDirection: 'row',
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    locationError: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.dangerLight,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
    },
    locationErrorText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.danger,
        marginLeft: spacing.sm,
    },
    locationLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
    },
    locationLoadingText: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        marginLeft: spacing.sm,
    },
    addressDisplay: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.successLight,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
    },
    addressText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.success,
        marginLeft: spacing.sm,
    },
    fieldLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: spacing.sm,
        marginTop: spacing.md,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: spacing.md,
        fontSize: typography.sizes.base,
        color: colors.textDark,
    },
    selectContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    selectOption: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.background,
        borderRadius: 20,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
    },
    selectOptionActive: {
        backgroundColor: colors.primary,
    },
    selectOptionText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    selectOptionTextActive: {
        color: '#FFFFFF',
        fontWeight: typography.weights.semibold,
    },
    financialSection: {
        marginTop: spacing.sm,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        marginRight: spacing.sm,
    },
    cancelBtnText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
    },
    submitBtn: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.sm,
    },
    submitBtnText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
    },
});

export default EmployeePunchScreen;
