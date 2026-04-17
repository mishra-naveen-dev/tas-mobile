const IS_DEV = __DEV__;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    ScrollView,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import api from '../../api/api';
import LocationService from '../../services/LocationService';
import { useAuth } from '../../context/AuthContext';

import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import GlassCard from '../../components/GlassCard';
import PillSelector from '../../components/PillSelector';
import { colors, typography, spacing } from '../../theme/tokens';

const PUNCH_TYPES = [
    { key: 'VISIT', label: 'Visit', icon: 'map-pin', color: '#2563EB' },
    { key: 'COLLECTION', label: 'Collection', icon: 'dollar-sign', color: '#10B981' },
    { key: 'DISBURSEMENT', label: 'Disbursement', icon: 'trending-up', color: '#F59E0B' },
    { key: 'TRAVEL', label: 'Travel', icon: 'navigation', color: '#8B5CF6' },
    { key: 'OTHER', label: 'Other', icon: 'plus-circle', color: '#6B7280' },
];

const PunchScreen = ({ navigation }) => {
    const auth = useAuth();
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [todayPunches, setTodayPunches] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selectedType, setSelectedType] = useState('VISIT');
    const [currentLocation, setCurrentLocation] = useState(null);
    const isMountedRef = useRef(true);

    const [formData, setFormData] = useState({
        current_address: '',
        latitude: null,
        longitude: null,
        customer_name: '',
        customer_address: '',
        notes: '',
        loan_id: '',
        amount: '',
        payment_mode: '',
        upi_ref: '',
        cheque_no: '',
    });

    useEffect(() => {
        isMountedRef.current = true;
        fetchTodayPunches();
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchTodayPunches = useCallback(async () => {
        try {
            const response = await api.get('/attendance/punches/today_punches/');
            if (!isMountedRef.current) return;

            const rawPunches = Array.isArray(response.data) ? response.data : 
                              Array.isArray(response.data?.results) ? response.data.results : [];
            
            const seen = new Set();
            const uniquePunches = rawPunches.filter(p => {
                if (!p?.id) return true;
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
            });

            setTodayPunches(uniquePunches.sort((a, b) => 
                new Date(b.punched_at) - new Date(a.punched_at)
            ));
        } catch (error) {
            if (IS_DEV) console.log('[PunchScreen] Fetch error:', error);
        }
    }, []);

    const fetchLocation = useCallback(async () => {
        setLocationLoading(true);
        try {
            const result = await LocationService.getCurrentLocation();

            if (result.error) {
                Alert.alert("Location Error", result.error);
                setLocationLoading(false);
                return false;
            }

            const address = result.address || `${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`;
            
            setCurrentLocation({
                latitude: result.latitude,
                longitude: result.longitude,
                address: address,
            });

            setFormData(prev => ({
                ...prev,
                latitude: result.latitude,
                longitude: result.longitude,
                current_address: address,
            }));

            setLocationLoading(false);
            return true;
        } catch (err) {
            if (IS_DEV) console.log('[PunchScreen] Location error:', err);
            Alert.alert("Error", "Failed to get location");
            setLocationLoading(false);
            return false;
        }
    }, []);

    const openAddPunchForm = useCallback(async () => {
        setFormData({
            current_address: '',
            latitude: null,
            longitude: null,
            customer_name: '',
            customer_address: '',
            notes: '',
            loan_id: '',
            amount: '',
            payment_mode: '',
            upi_ref: '',
            cheque_no: '',
        });
        setSelectedType('VISIT');
        
        const locationFetched = await fetchLocation();
        if (locationFetched) {
            setShowForm(true);
        }
    }, [fetchLocation]);

    const handleSubmit = async () => {
        if (!formData.latitude || !formData.longitude) {
            Alert.alert("Error", "Please wait for location to be captured");
            return;
        }

        try {
            setLoading(true);

            const payload = {
                punch_type: selectedType,
                latitude: formData.latitude,
                longitude: formData.longitude,
                current_address: formData.current_address,
                customer_name: formData.customer_name,
                customer_address: formData.customer_address,
                notes: formData.notes,
                loan_id: formData.loan_id || '',
                amount: formData.amount ? parseFloat(formData.amount) : null,
                payment_mode: formData.payment_mode || '',
                upi_ref: formData.upi_ref || '',
                cheque_no: formData.cheque_no || '',
            };

            await api.post('/attendance/punches/', payload);

            Alert.alert("Success", "Punch added successfully!");
            setShowForm(false);
            fetchTodayPunches();
            setFormData({
                current_address: '',
                latitude: null,
                longitude: null,
                customer_name: '',
                customer_address: '',
                notes: '',
                loan_id: '',
                amount: '',
                payment_mode: '',
                upi_ref: '',
                cheque_no: '',
            });

        } catch (err) {
            if (IS_DEV) console.log('[PunchScreen] Submit error:', err);
            const errorMsg = err?.response?.data?.detail || err?.message || "Failed to add punch";
            Alert.alert("Error", typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        } finally {
            setLoading(false);
        }
    };

    const updateFormData = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const getPunchTypeInfo = (type) => {
        return PUNCH_TYPES.find(t => t.key === type) || PUNCH_TYPES[4];
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const renderPunchItem = ({ item }) => {
        const typeInfo = getPunchTypeInfo(item.punch_type);
        return (
            <GlassCard style={styles.punchCard}>
                <View style={styles.punchHeader}>
                    <View style={[styles.typeIcon, { backgroundColor: `${typeInfo.color}20` }]}>
                        <Icon name={typeInfo.icon} size={18} color={typeInfo.color} />
                    </View>
                    <View style={styles.punchInfo}>
                        <Text style={styles.typeLabel}>{typeInfo.label}</Text>
                        <Text style={styles.punchTime}>{formatTime(item.punched_at)}</Text>
                    </View>
                    {item.amount && (
                        <View style={styles.amountBadge}>
                            <Text style={styles.amountText}>₹{Number(item.amount).toLocaleString()}</Text>
                        </View>
                    )}
                </View>
                {item.current_address && (
                    <View style={styles.addressRow}>
                        <Icon name="map-pin" size={12} color={colors.textMuted} />
                        <Text style={styles.addressText} numberOfLines={1}>{item.current_address}</Text>
                    </View>
                )}
            </GlassCard>
        );
    };

    const renderFormField = (label, key, options = {}) => {
        if (options.hidden) return null;
        return (
            <View style={styles.formField}>
                <Text style={styles.fieldLabel}>{label}</Text>
                {options.multiline ? (
                    <InputField
                        value={formData[key]}
                        onChangeText={(text) => updateFormData(key, text)}
                        placeholder={options.placeholder}
                        multiline
                        numberOfLines={3}
                        style={styles.textArea}
                    />
                ) : (
                    <InputField
                        value={formData[key]}
                        onChangeText={(text) => updateFormData(key, text)}
                        placeholder={options.placeholder}
                        keyboardType={options.keyboardType}
                    />
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Punch</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.todayHeader}>
                <Text style={styles.todayTitle}>Today's Punches</Text>
                <Text style={styles.todayCount}>{todayPunches.length} entries</Text>
            </View>

            <FlatList
                data={todayPunches}
                renderItem={renderPunchItem}
                keyExtractor={(item, index) => item.id?.toString() || `punch-${index}`}
                contentContainerStyle={styles.listContent}
                refreshing={false}
                onRefresh={fetchTodayPunches}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Icon name="map-pin" size={48} color={colors.textLight} />
                        <Text style={styles.emptyText}>No punches recorded today</Text>
                        <Text style={styles.emptySubtext}>Tap the button below to add your first punch</Text>
                    </View>
                }
            />

            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={openAddPunchForm}
                    activeOpacity={0.85}
                >
                    <Icon name="plus" size={24} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Add Punch</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={showForm}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowForm(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowForm(false)} style={styles.modalClose}>
                            <Icon name="x" size={24} color={colors.textDark} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>New Punch</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        {locationLoading && (
                            <View style={styles.locationLoading}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.locationLoadingText}>Getting your location...</Text>
                            </View>
                        )}

                        <View style={styles.locationCard}>
                            <Icon name="map-pin" size={20} color={colors.success} />
                            <Text style={styles.locationText} numberOfLines={2}>
                                {formData.current_address || 'Fetching location...'}
                            </Text>
                            <TouchableOpacity onPress={fetchLocation} style={styles.refreshBtn}>
                                <Icon name="refresh-cw" size={16} color={colors.primary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionLabel}>Punch Type</Text>
                        <View style={styles.typeGrid}>
                            {PUNCH_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type.key}
                                    style={[
                                        styles.typeButton,
                                        selectedType === type.key && { backgroundColor: type.color },
                                    ]}
                                    onPress={() => setSelectedType(type.key)}
                                >
                                    <Icon
                                        name={type.icon}
                                        size={20}
                                        color={selectedType === type.key ? '#FFFFFF' : type.color}
                                    />
                                    <Text style={[
                                        styles.typeButtonText,
                                        selectedType === type.key && { color: '#FFFFFF' },
                                    ]}>
                                        {type.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.sectionLabel}>Details (Optional)</Text>

                        {renderFormField('Customer Name', 'customer_name', {
                            placeholder: 'Enter customer name'
                        })}

                        {renderFormField('Customer Address', 'customer_address', {
                            placeholder: 'Enter address',
                            multiline: true
                        })}

                        {renderFormField('Notes', 'notes', {
                            placeholder: 'Add notes about this visit...',
                            multiline: true
                        })}

                        {(selectedType === 'COLLECTION' || selectedType === 'DISBURSEMENT') && (
                            <>
                                {renderFormField('Amount', 'amount', {
                                    placeholder: 'Enter amount',
                                    keyboardType: 'numeric'
                                })}

                                <Text style={styles.sectionLabel}>Payment Mode</Text>
                                <PillSelector
                                    options={['CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS']}
                                    selected={formData.payment_mode}
                                    onSelect={(mode) => updateFormData('payment_mode', mode)}
                                    style={styles.pillSelector}
                                />

                                {formData.payment_mode === 'UPI' && renderFormField('UPI Reference', 'upi_ref', {
                                    placeholder: 'Enter UPI reference'
                                })}

                                {formData.payment_mode === 'CHEQUE' && renderFormField('Cheque Number', 'cheque_no', {
                                    placeholder: 'Enter cheque number'
                                })}
                            </>
                        )}

                        {selectedType === 'VISIT' && renderFormField('Loan ID', 'loan_id', {
                            placeholder: 'Enter loan ID if applicable'
                        })}

                        <View style={styles.buttonContainer}>
                            <PrimaryButton
                                title="Save Punch"
                                onPress={handleSubmit}
                                loading={loading}
                                disabled={loading || locationLoading}
                            />
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </SafeAreaView>
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
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    todayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    todayTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    todayCount: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 120,
    },
    punchCard: {
        marginBottom: spacing.sm,
        padding: spacing.md,
    },
    punchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    punchInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    typeLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
    },
    punchTime: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    amountBadge: {
        backgroundColor: colors.successLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    amountText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.bold,
        color: colors.success,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    addressText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        marginLeft: 4,
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.sizes.sm,
        color: colors.textLight,
        marginTop: spacing.xs,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: spacing.md,
        paddingBottom: spacing.lg,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.punchBlue,
        paddingVertical: spacing.md,
        borderRadius: 14,
        elevation: 4,
        shadowColor: colors.punchBlue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        marginLeft: spacing.sm,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalClose: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    modalContent: {
        flex: 1,
        padding: spacing.md,
    },
    locationLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginBottom: spacing.md,
    },
    locationLoadingText: {
        marginLeft: spacing.sm,
        color: colors.textMuted,
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    locationText: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: typography.sizes.sm,
        color: colors.textDark,
    },
    refreshBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primaryLight,
        borderRadius: 18,
    },
    sectionLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        color: colors.textDark,
        marginBottom: spacing.sm,
        marginTop: spacing.sm,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    typeButtonText: {
        marginLeft: 6,
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    formField: {
        marginBottom: spacing.md,
    },
    fieldLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMedium,
        marginBottom: spacing.xs,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    pillSelector: {
        marginBottom: spacing.md,
    },
    buttonContainer: {
        marginTop: spacing.lg,
    },
});

export default PunchScreen;
