const IS_DEV = __DEV__;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity,
    Modal, ActivityIndicator, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';

import api from '../../api/api';
import LocationService from '../../services/LocationService';

import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import GlassCard from '../../components/GlassCard';
import PillSelector from '../../components/PillSelector';
import { colors, typography, spacing } from '../../theme/tokens';

const { width, height } = Dimensions.get('window');

const PUNCH_TYPES = [
    { key: 'VISIT', label: 'Visit', icon: 'map-pin', color: '#2563EB' },
    { key: 'COLLECTION', label: 'Collection', icon: 'dollar-sign', color: '#10B981' },
    { key: 'DISBURSEMENT', label: 'Disbursement', icon: 'trending-up', color: '#F59E0B' },
    { key: 'TRAVEL', label: 'Travel', icon: 'navigation', color: '#8B5CF6' },
    { key: 'OTHER', label: 'Other', icon: 'plus-circle', color: '#6B7280' },
];

const PunchScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [todayPunches, setTodayPunches] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selectedType, setSelectedType] = useState('VISIT');
    const [currentLocation, setCurrentLocation] = useState(null);
    const isMountedRef = useRef(true);

    const [formData, setFormData] = useState({
        customer_name: '', customer_address: '', notes: '',
        loan_id: '', amount: '', payment_mode: '', upi_ref: '', cheque_no: '',
    });

    useEffect(() => {
        isMountedRef.current = true;
        fetchLocationBackground();
        fetchTodayPunches();
        return () => { isMountedRef.current = false; };
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
            setTodayPunches(uniquePunches.sort((a, b) => new Date(b.punched_at) - new Date(a.punched_at)));
        } catch (error) {
            if (IS_DEV) console.log('[PunchScreen] Fetch error:', error);
        }
    }, []);

    const fetchLocationBackground = async () => {
        setLocationLoading(true);
        try {
            const result = await LocationService.getCurrentLocation();
            if (result && !result.error && isMountedRef.current) {
                const address = result.address || `${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`;
                setCurrentLocation({
                    latitude: result.latitude,
                    longitude: result.longitude,
                    address: address,
                });
            }
        } catch (e) {
            console.log(e);
        } finally {
            if(isMountedRef.current) setLocationLoading(false);
        }
    };

    const fetchLocationDetailed = useCallback(async () => {
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
            setLocationLoading(false);
            return true;
        } catch (err) {
            if (IS_DEV) console.log('[PunchScreen] Location error:', err);
            Alert.alert("Error", "Failed to get location");
            setLocationLoading(false);
            return false;
        }
    }, []);

    const handleAddPunch = useCallback(async () => {
        const isEnabled = await LocationService.isLocationEnabled();
        if (!isEnabled) {
            Alert.alert(
                "GPS is Disabled",
                "Please enable your device's location services to record a punch.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open Settings", onPress: () => LocationService.openLocationSettings() }
                ]
            );
            return;
        }

        if (!currentLocation) {
             const locationFetched = await fetchLocationDetailed();
             if (!locationFetched) return;
        }
        setShowForm(true);
    }, [fetchLocationDetailed, currentLocation]);

    const handleSubmit = async () => {
        if (!currentLocation) {
            Alert.alert("Error", "Please wait for GPS location");
            return;
        }
        try {
            setLoading(true);
            const payload = {
                punch_type: selectedType,
                visit_type: selectedType,
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                current_address: currentLocation.address,
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
            setFormData({
                customer_name: '', customer_address: '', notes: '',
                loan_id: '', amount: '', payment_mode: '', upi_ref: '', cheque_no: '',
            });
            fetchTodayPunches();

        } catch (err) {
            const errorMsg = err?.response?.data?.detail || err?.message || "Failed to add punch";
            Alert.alert("Error", typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        } finally {
            setLoading(false);
        }
    };

    const updateFormData = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const getPunchTypeInfo = (type) => PUNCH_TYPES.find(t => t.key === type) || PUNCH_TYPES[4];

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const renderPunchItem = ({ item, index }) => {
        const typeInfo = getPunchTypeInfo(item.punch_type);
        return (
            <GlassCard key={item.id || `punch-${index}`} style={styles.punchCard}>
                <View style={styles.punchHeader}>
                    <View style={[styles.typeIcon, { backgroundColor: `${typeInfo.color}20` }]}>
                        <Icon name={typeInfo.icon} size={18} color={typeInfo.color} />
                    </View>
                    <View style={styles.punchInfo}>
                        <Text style={styles.typeLabel}>{typeInfo.label}</Text>
                        <Text style={styles.punchTime}>{formatTime(item.punched_at)}</Text>
                    </View>
                    {item.amount > 0 && (
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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Punch Hub</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.halfMapContainer}>
                {currentLocation ? (
                    <MapView
                        style={styles.halfMap}
                        provider={PROVIDER_GOOGLE}
                        showsUserLocation={true}
                        region={{
                            latitude: currentLocation.latitude,
                            longitude: currentLocation.longitude,
                            latitudeDelta: 0.015,
                            longitudeDelta: 0.015,
                        }}
                    >
                        <Marker coordinate={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }}>
                            <View style={styles.pulseMarker}>
                                <View style={styles.pulseCore} />
                            </View>
                        </Marker>
                    </MapView>
                ) : (
                    <View style={styles.mapPlaceholder}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.mapLoadingText}>Locking GPS...</Text>
                    </View>
                )}
                
                <View style={styles.mapOverlayTop} />
                <View style={styles.mapInformationBar}>
                    <Icon name="crosshair" size={16} color={colors.primary} />
                    <Text style={styles.mapAddress} numberOfLines={1}>
                        {currentLocation ? currentLocation.address : 'Locating satellite...'}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.fabMain}
                onPress={handleAddPunch}
                activeOpacity={0.8}
                disabled={locationLoading && !currentLocation}
            >
                {locationLoading && !currentLocation ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : (
                    <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                        <Icon name="map-pin" size={22} color="#FFF" />
                        <Text style={styles.fabText}>PUNCH</Text>
                    </View>
                )}
            </TouchableOpacity>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.todayHeader}>
                    <Text style={styles.todayTitle}>Today's Record</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{todayPunches.length}</Text>
                    </View>
                </View>

                {todayPunches.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <Icon name="inbox" size={32} color={colors.primaryLight} />
                        </View>
                        <Text style={styles.emptyText}>No activity today</Text>
                        <Text style={styles.emptySubtext}>Your punches will securely sync here</Text>
                    </View>
                ) : (
                    todayPunches.map((item, index) => renderPunchItem({ item, index }))
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            <Modal visible={showForm} animationType="slide" transparent={true} onRequestClose={() => setShowForm(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHandleWrap}>
                            <View style={styles.sheetHandle} />
                        </View>

                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Record Punch</Text>
                            <TouchableOpacity onPress={() => setShowForm(false)} style={styles.closeBtn}>
                                <Icon name="x" size={22} color={colors.textDark} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.locationCard}>
                                <View style={styles.locIconWrap}>
                                    <Icon name="map-pin" size={18} color={colors.success} />
                                </View>
                                <Text style={styles.locationText} numberOfLines={2}>
                                    {currentLocation?.address || 'Precise GPS locked'}
                                </Text>
                            </View>

                            <Text style={styles.sectionLabel}>Select Punch Nature *</Text>
                            <View style={styles.typeGrid}>
                                {PUNCH_TYPES.map((type) => (
                                    <TouchableOpacity
                                        key={type.key}
                                        style={[
                                            styles.typeButton,
                                            selectedType === type.key && { backgroundColor: type.color, borderColor: type.color, elevation: 2 },
                                        ]}
                                        onPress={() => setSelectedType(type.key)}
                                    >
                                        <Icon name={type.icon} size={16} color={selectedType === type.key ? '#FFFFFF' : type.color} />
                                        <Text style={[
                                            styles.typeButtonText,
                                            selectedType === type.key && { color: '#FFFFFF', fontWeight: 'bold' },
                                        ]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.sectionLabel}>Additional Metadata</Text>

                            {renderFormField('Customer Name', 'customer_name', { placeholder: 'Client / Branch name' })}
                            {renderFormField('Customer Address', 'customer_address', { placeholder: 'Full address', multiline: true })}
                            {renderFormField('Remarks', 'notes', { placeholder: 'Any contextual notes...', multiline: true })}

                            {(selectedType === 'COLLECTION' || selectedType === 'DISBURSEMENT') && (
                                <View style={styles.financialBox}>
                                    <Text style={styles.financialBoxTitle}>Financial Transaction Details</Text>
                                    
                                    {renderFormField('Loan ID *', 'loan_id', { placeholder: 'E.g. LN-829310' })}
                                    {renderFormField('Amount Transferred *', 'amount', { placeholder: '₹ 0.00', keyboardType: 'numeric' })}

                                    <Text style={styles.fieldLabel}>Mode of Processing *</Text>
                                    <PillSelector
                                        options={[
                                            { label: 'CASH', value: 'CASH' },
                                            { label: 'UPI', value: 'UPI' },
                                            { label: 'CHEQUE', value: 'CHEQUE' },
                                            { label: 'NEFT', value: 'NEFT' }
                                        ]}
                                        selectedValue={formData.payment_mode}
                                        onValueChange={(mode) => updateFormData('payment_mode', mode)}
                                    />

                                    {formData.payment_mode === 'UPI' && renderFormField('UPI Reference Number', 'upi_ref', { placeholder: 'Enter txn ID' })}
                                    {formData.payment_mode === 'CHEQUE' && renderFormField('Cheque Leaf Number', 'cheque_no', { placeholder: 'Enter 6 digit no' })}
                                </View>
                            )}

                            {selectedType === 'VISIT' && renderFormField('Associated Loan ID', 'loan_id', { placeholder: 'Optional mapping ID' })}

                            <View style={styles.buttonSpacer} />
                        </ScrollView>

                        <View style={styles.sheetFooter}>
                            <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setShowForm(false)}>
                                <Text style={styles.sheetCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.sheetSubmitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
                                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sheetSubmitText}>Push Data</Text>}
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
        backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
        zIndex: 10
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark },
    
    halfMapContainer: { width: '100%', height: height * 0.35, backgroundColor: colors.background },
    halfMap: { flex: 1 },
    mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
    mapLoadingText: { marginTop: spacing.sm, fontSize: typography.sizes.sm, color: colors.textMedium },
    mapOverlayTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 20 },
    mapInformationBar: {
        position: 'absolute', bottom: spacing.md, left: spacing.md, right: 140,
        backgroundColor: 'rgba(255,255,255,0.95)', padding: spacing.sm, borderRadius: 24,
        flexDirection: 'row', alignItems: 'center', elevation: 3, shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
    },
    mapAddress: { flex: 1, marginLeft: spacing.xs, fontSize: typography.sizes.xs, color: colors.textDark, fontWeight: '600' },
    pulseMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(37, 99, 235, 0.3)', alignItems: 'center', justifyContent: 'center' },
    pulseCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff' },

    fabMain: {
        position: 'absolute', top: (height * 0.35) + 20, right: spacing.md,
        backgroundColor: colors.punchBlue || colors.primary,
        paddingHorizontal: spacing.xl, paddingVertical: 14,
        borderRadius: 30, elevation: 8, zIndex: 99,
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 6,
    },
    fabText: { color: '#FFF', fontWeight: 'bold', fontSize: typography.sizes.md, marginLeft: spacing.xs, letterSpacing: 0.5 },

    scrollView: { flex: 1, backgroundColor: colors.background, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    scrollContent: { padding: spacing.md, paddingTop: spacing.xl },
    
    todayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.md },
    todayTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textDark, flex: 1 },
    countBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    countText: { fontSize: typography.sizes.xs, fontWeight: 'bold', color: colors.primary },

    punchCard: { marginBottom: spacing.sm, padding: spacing.md, borderRadius: 16, backgroundColor: colors.surface, 
                 borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    punchHeader: { flexDirection: 'row', alignItems: 'center' },
    typeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    punchInfo: { flex: 1, marginLeft: spacing.md },
    typeLabel: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textDark },
    punchTime: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
    amountBadge: { backgroundColor: colors.successLight, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
    amountText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.success },
    addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, backgroundColor: '#f8fafc', padding: spacing.sm, borderRadius: 8 },
    addressText: { fontSize: typography.sizes.xs, color: colors.textMedium, marginLeft: 6, flex: 1 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, marginTop: spacing.lg },
    emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, elevation: 1 },
    emptyText: { fontSize: typography.sizes.md, fontWeight: 'bold', color: colors.textDark },
    emptySubtext: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.xs },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
    bottomSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, height: height * 0.88, elevation: 20 },
    sheetHandleWrap: { alignItems: 'center', paddingVertical: spacing.sm },
    sheetHandle: { width: 40, height: 5, backgroundColor: '#cbd5e1', borderRadius: 3 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    sheetTitle: { fontSize: typography.sizes.xl, fontWeight: 'bold', color: colors.textDark },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    
    sheetContent: { paddingHorizontal: spacing.lg },
    locationCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: '#f0fdf4', borderRadius: 16, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#bbf7d0' },
    locIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
    locationText: { flex: 1, marginLeft: spacing.sm, fontSize: typography.sizes.sm, color: '#166534', fontWeight: '600' },
    
    sectionLabel: { fontSize: typography.sizes.sm, fontWeight: 'bold', color: colors.textMedium, marginBottom: spacing.md, marginTop: spacing.md, letterSpacing: 0.5, textTransform: 'uppercase' },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
    typeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    typeButtonText: { marginLeft: 8, fontSize: typography.sizes.sm, fontWeight: '600', color: colors.textDark },
    
    financialBox: { backgroundColor: '#f8fafc', padding: spacing.md, borderRadius: 16, marginTop: spacing.sm, borderWidth: 1, borderColor: '#e2e8f0' },
    financialBoxTitle: { fontSize: typography.sizes.sm, fontWeight: 'bold', color: colors.textDark, marginBottom: spacing.md },

    formField: { marginBottom: spacing.md },
    fieldLabel: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.textMedium, marginBottom: spacing.xs },
    textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
    pillSelector: { marginBottom: spacing.md },
    buttonSpacer: { height: 60 },

    sheetFooter: { flexDirection: 'row', padding: spacing.md, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: colors.surface },
    sheetCancelBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, marginRight: spacing.sm },
    sheetCancelText: { fontSize: typography.sizes.md, fontWeight: 'bold', color: colors.textMedium },
    sheetSubmitBtn: { flex: 2, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 16, marginLeft: spacing.sm, elevation: 2 },
    sheetSubmitText: { fontSize: typography.sizes.md, fontWeight: 'bold', color: '#fff' },
});

export default PunchScreen;
