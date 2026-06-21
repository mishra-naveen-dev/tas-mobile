import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing } from '../../theme/tokens';
import GeocodingService from '../../services/GeocodingService';

const CORRECTION_TYPES = [
    { value: 'ADD', label: 'Add Punch', color: colors.success, icon: 'plus-circle' },
    { value: 'EDIT', label: 'Edit Punch', color: colors.warning, icon: 'edit' },
    { value: 'DELETE', label: 'Delete Punch', color: colors.danger, icon: 'trash-2' },
];

const PUNCH_TYPES = [
    { value: 'PUNCH_IN', label: 'Punch In', color: colors.success },
    { value: 'PUNCH_OUT', label: 'Punch Out', color: colors.danger },
];

const VISIT_TYPES = [
    { value: 'OFFICE', label: 'Office' },
    { value: 'CLIENT', label: 'Client' },
    { value: 'FIELD', label: 'Field' },
    { value: 'MEETING', label: 'Meeting' },
    { value: 'COLLECTION', label: 'Collection' },
    { value: 'DISBURSEMENT', label: 'Disbursement' },
    { value: 'OTHER', label: 'Other' },
];

const PunchCorrectionScreen = ({ navigation }) => {
    const auth = useAuth();

    const [formData, setFormData] = useState({
        correction_type: 'ADD',
        correction_date: new Date(),
        correction_time: new Date(),
        punch_type: 'PUNCH_IN',
        visit_type: 'OTHER',
        from_address: '',
        pincode: '',
        to_address: '',
        to_pincode: '',
        reason: '',
        loan_id: '',
        amount: '',
        payment_method: 'CASH',
    });

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [distance, setDistance] = useState(0);
    const [calculatingDistance, setCalculatingDistance] = useState(false);

    const updateForm = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
        setError('');
    };

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            updateForm('correction_date', selectedDate);
        }
    };

    const handleTimeChange = (event, selectedTime) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedTime) {
            updateForm('correction_time', selectedTime);
        }
    };

    const handleCalculateDistance = async () => {
        const fromAddress = formData.from_address;
        const toAddress = formData.to_address || formData.from_address;

        if (!fromAddress || fromAddress.length < 5) {
            Alert.alert('Error', 'Please enter from address');
            return;
        }

        setCalculatingDistance(true);
        try {
            console.log('[PunchCorrection] Calculating distance...');
            const calculatedDist = await GeocodingService.calculateDistance(fromAddress, toAddress);
            console.log('[PunchCorrection] Distance result:', calculatedDist);
            
            if (calculatedDist > 0) {
                setDistance(calculatedDist);
            } else {
                Alert.alert('Warning', 'Could not calculate distance. Using default 0.5km');
                setDistance(0.5);
            }
        } catch (err) {
            console.log('[PunchCorrection] Distance error:', err);
            setDistance(0.5);
        } finally {
            setCalculatingDistance(false);
        }
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const validateForm = () => {
        if (!formData.reason || formData.reason.trim().length < 10) {
            setError('Reason must be at least 10 characters');
            return false;
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (formData.correction_date > today) {
            setError('Date cannot be in the future');
            return false;
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setSubmitting(true);
        setError('');

        try {
            const timeStr = formData.correction_time.toTimeString().slice(0, 5);
            
            const payload = {
                correction_type: formData.correction_type,
                correction_date: formData.correction_date.toISOString().split('T')[0],
                correction_time: timeStr,
                punch_type: formData.punch_type,
                visit_type: formData.visit_type,
                from_address: formData.from_address,
                pincode: formData.pincode,
                to_address: formData.to_address,
                to_pincode: formData.to_pincode,
                reason: formData.reason,
                loan_id: formData.loan_id || null,
                amount: formData.amount ? parseFloat(formData.amount) : null,
                payment_method: formData.payment_method,
                punch_sequence: [],
                original_punch_id: null,
                calculated_distance: distance || 0,
            };

            await api.createCorrectionRequest(payload);

            Alert.alert('Success', 'Correction request submitted successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (err) {
            const errMsg = err?.response?.data?.error || err?.response?.data?.detail || 'Failed to submit request';
            setError(Array.isArray(errMsg) ? errMsg.join(', ') : errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const FieldLabel = ({ children, required }) => (
        <Text style={styles.fieldLabel}>
            {children}{required && <Text style={styles.required}> *</Text>}
        </Text>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Punch Correction</Text>
                <View style={{ width: 40 }} />
            </View>

            {error ? (
                <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={20} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <FieldLabel>Correction Type</FieldLabel>
                    <View style={styles.typeGrid}>
                        {CORRECTION_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.typeItem,
                                    formData.correction_type === type.value && {
                                        borderColor: type.color,
                                        backgroundColor: type.color + '15'
                                    }
                                ]}
                                onPress={() => updateForm('correction_type', type.value)}
                            >
                                <Icon 
                                    name={type.icon} 
                                    size={24} 
                                    color={formData.correction_type === type.value ? type.color : colors.textMuted} 
                                />
                                <Text style={[
                                    styles.typeLabel,
                                    formData.correction_type === type.value && { color: type.color }
                                ]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <FieldLabel>Punch Type</FieldLabel>
                    <View style={styles.punchTypeRow}>
                        {PUNCH_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.punchTypeItem,
                                    formData.punch_type === type.value && {
                                        backgroundColor: type.color,
                                        borderColor: type.color
                                    }
                                ]}
                                onPress={() => updateForm('punch_type', type.value)}
                            >
                                <Text style={[
                                    styles.punchTypeText,
                                    formData.punch_type === type.value && styles.punchTypeTextActive
                                ]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <FieldLabel>Visit Type</FieldLabel>
                    <View style={styles.visitTypeGrid}>
                        {VISIT_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.visitTypeItem,
                                    formData.visit_type === type.value && styles.visitTypeItemActive
                                ]}
                                onPress={() => updateForm('visit_type', type.value)}
                            >
                                <Text style={[
                                    styles.visitTypeText,
                                    formData.visit_type === type.value && styles.visitTypeTextActive
                                ]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.dateTimeRow}>
                        <View style={styles.dateTimeItem}>
                            <FieldLabel>Date</FieldLabel>
                            <TouchableOpacity 
                                style={styles.dateTimeBtn}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Icon name="calendar" size={18} color={colors.textMuted} />
                                <Text style={styles.dateTimeText}>{formatDate(formData.correction_date)}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.dateTimeItem}>
                            <FieldLabel>Time</FieldLabel>
                            <TouchableOpacity 
                                style={styles.dateTimeBtn}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Icon name="clock" size={18} color={colors.textMuted} />
                                <Text style={styles.dateTimeText}>{formatTime(formData.correction_time)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        value={formData.correction_date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                    />
                )}

                {showTimePicker && (
                    <DateTimePicker
                        value={formData.correction_time}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChange}
                    />
                )}

                <View style={styles.section}>
                    <FieldLabel>From Address</FieldLabel>
                    <TextInput
                        style={[styles.input, submitting && styles.inputDisabled]}
                        value={formData.from_address}
                        onChangeText={(text) => updateForm('from_address', text)}
                        placeholder="Enter address or location"
                        placeholderTextColor={colors.textMuted}
                        editable={!submitting}
                    />
                </View>

                <View style={styles.section}>
                    <FieldLabel>Pincode (Optional)</FieldLabel>
                    <TextInput
                        style={[styles.input, submitting && styles.inputDisabled]}
                        value={formData.pincode}
                        onChangeText={(text) => updateForm('pincode', text.replace(/[^0-9]/g, '').slice(0, 6))}
                        placeholder="6-digit pincode"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        maxLength={6}
                        editable={!submitting}
                    />
                </View>

                <View style={styles.section}>
                    <FieldLabel>To Address (Optional)</FieldLabel>
                    <TextInput
                        style={[styles.input, submitting && styles.inputDisabled]}
                        value={formData.to_address}
                        onChangeText={(text) => updateForm('to_address', text)}
                        placeholder="Enter destination address"
                        placeholderTextColor={colors.textMuted}
                        editable={!submitting}
                    />
                </View>

                {!!formData.to_address && (
                    <View style={styles.section}>
                        <FieldLabel>To Pincode</FieldLabel>
                        <TextInput
                            style={[styles.input, submitting && styles.inputDisabled]}
                            value={formData.to_pincode}
                            onChangeText={(text) => updateForm('to_pincode', text.replace(/[^0-9]/g, '').slice(0, 6))}
                            placeholder="6-digit destination pincode"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            maxLength={6}
                            editable={!submitting}
                        />
                    </View>
                )}

                {(formData.visit_type === 'COLLECTION' || formData.visit_type === 'DISBURSEMENT') && (
                    <View style={styles.section}>
                        <FieldLabel>Distance</FieldLabel>
                        <View style={styles.distanceRow}>
                            <View style={styles.distanceValue}>
                                <Text style={styles.distanceText}>
                                    {distance > 0 ? `${distance} km` : 'Not calculated'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.calculateBtn, calculatingDistance && styles.calculateBtnDisabled]}
                                onPress={handleCalculateDistance}
                                disabled={calculatingDistance}
                            >
                                {calculatingDistance ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <Icon name="navigation" size={16} color="#FFF" />
                                        <Text style={styles.calculateBtnText}>Calculate</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Financial Details</Text>
                    <View style={styles.financialRow}>
                        <View style={styles.financialItem}>
                            <FieldLabel>Loan ID</FieldLabel>
                            <TextInput
                                style={styles.input}
                                value={formData.loan_id}
                                onChangeText={(text) => updateForm('loan_id', text)}
                                placeholder="Enter Loan ID"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>
                        <View style={styles.financialItem}>
                            <FieldLabel>Amount</FieldLabel>
                            <TextInput
                                style={styles.input}
                                value={formData.amount}
                                onChangeText={(text) => updateForm('amount', text)}
                                placeholder="Enter Amount"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <FieldLabel required>Reason</FieldLabel>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={formData.reason}
                        onChangeText={(text) => updateForm('reason', text)}
                        placeholder="Explain why this correction is needed (min 10 characters)"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                    <Text style={styles.charCount}>
                        {formData.reason.length} / 10 characters minimum
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.8}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Icon name="send" size={20} color="#FFFFFF" />
                            <Text style={styles.submitBtnText}>Submit Request</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
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
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.dangerLight,
        padding: spacing.md,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        borderRadius: 12,
    },
    errorText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.danger,
        marginLeft: spacing.sm,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: spacing.sm,
    },
fieldLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    distanceValue: {
        flex: 1,
    },
    distanceText: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
    },
    calculateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
    },
    calculateBtnDisabled: {
        opacity: 0.6,
    },
    calculateBtnText: {
        color: '#FFF',
        fontWeight: typography.weights.semibold,
        marginLeft: spacing.xs,
    },
    required: {
        color: colors.danger,
    },
    typeGrid: {
        flexDirection: 'row',
    },
    typeItem: {
        flex: 1,
        alignItems: 'center',
        padding: spacing.md,
        marginHorizontal: spacing.xxs,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    typeLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    punchTypeRow: {
        flexDirection: 'row',
    },
    punchTypeItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        marginHorizontal: spacing.xxs,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border,
    },
    punchTypeText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
    },
    punchTypeTextActive: {
        color: '#FFFFFF',
    },
    visitTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -spacing.xxs,
    },
    visitTypeItem: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        margin: spacing.xxs,
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    visitTypeItemActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    visitTypeText: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    visitTypeTextActive: {
        color: '#FFFFFF',
        fontWeight: typography.weights.semibold,
    },
    dateTimeRow: {
        flexDirection: 'row',
    },
    dateTimeItem: {
        flex: 1,
        marginRight: spacing.sm,
    },
    dateTimeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
    },
    dateTimeText: {
        fontSize: typography.sizes.md,
        color: colors.textDark,
        marginLeft: spacing.sm,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        fontSize: typography.sizes.md,
        color: colors.textDark,
    },
    inputDisabled: {
        opacity: 0.5,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: spacing.xs,
        textAlign: 'right',
    },
    financialRow: {
        flexDirection: 'row',
    },
    financialItem: {
        flex: 1,
        marginRight: spacing.sm,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: 12,
        marginTop: spacing.md,
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    submitBtnDisabled: {
        opacity: 0.7,
    },
    submitBtnText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        marginLeft: spacing.sm,
    },
});

export default PunchCorrectionScreen;
