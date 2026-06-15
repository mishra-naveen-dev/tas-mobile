import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Alert, TextInput, Modal, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { usePunch, STATES } from '../../context/PunchContext';
import { colors, typography, spacing } from '../../theme/tokens';

const { width } = Dimensions.get('window');

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

const Banner = ({ message, type, onDismiss }) => {
  const y = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    const t = setTimeout(() => onDismiss?.(), 4000);
    return () => clearTimeout(t);
  }, []);

  const slide = () => {
    Animated.timing(y, { toValue: -100, duration: 200, useNativeDriver: true })
      .start(() => onDismiss?.());
  };

  return (
    <Animated.View style={[styles.banner, type === 'success' ? styles.successBg : styles.errorBg, { transform: [{ translateY: y }] }]}>
      <Icon name={type === 'success' ? 'check-circle' : 'alert-circle'} size={20} color="#fff" />
      <Text style={styles.bannerText}>{message}</Text>
      <TouchableOpacity onPress={slide}><Icon name="x" size={18} color="#fff" /></TouchableOpacity>
    </Animated.View>
  );
};

const GPSBadge = ({ isMock, isFetching }) => {
  if (isFetching) {
    return (
      <View style={[styles.badge, styles.fetchBg]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.badgeText, { color: colors.primary }]}>Getting GPS...</Text>
      </View>
    );
  }
  if (isMock) {
    return (
      <View style={[styles.badge, styles.mockBg]}>
        <Icon name="smartphone" size={14} color={colors.warning} />
        <Text style={[styles.badgeText, { color: colors.warning }]}>Dev Mode</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.lockedBg]}>
      <Icon name="check-circle" size={14} color={colors.success} />
      <Text style={[styles.badgeText, { color: colors.success }]}>GPS Locked</Text>
    </View>
  );
};

const EmployeePunchScreen = ({ navigation }) => {
  const {
    punchState, isActive, isIdle, isLoading, isTracking,
    isMockLocation, capturedLocation, todayPunches,
    error, errorMessage, success,
    punchIn, punchOut, fetchLocation, resetForm, dismissError,
    getTotalDistance, getTrackingDuration, LocationService,
  } = usePunch();

  const [modalVisible, setModalVisible] = useState(false);
  const [localLocation, setLocalLocation] = useState(null);
  const [form, setForm] = useState({
    reason: '',
    visit_type: '',
    loan_id: '',
    amount: '',
    payment_mode: '',
    upi_ref: '',
    cheque_no: '',
    customer_address: '',
    customer_name: '',
    travel_with: 'ALONE',
    co_employee_id: '',
    co_employee_name: '',
    vehicle_number: '',
  });

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef(null);

  useEffect(() => {
    if (punchState === STATES.FORM_OPEN && capturedLocation) {
      setLocalLocation(capturedLocation);
      setModalVisible(true);
    }
  }, [punchState, capturedLocation]);

  useEffect(() => {
    if (mapRef.current && localLocation && !isActive) {
      mapRef.current.animateToRegion({
        latitude: localLocation.latitude,
        longitude: localLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }, [localLocation, isActive]);

  const handlePunchPress = async () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    if (isIdle) {
      const result = await fetchLocation();
      if (!result.success) {
        Alert.alert('Location Error', result.error);
      }
    }
  };

  const handlePunchOutPress = () => {
    Alert.alert(
      'Punch Out',
      'Are you sure to punch out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Punch Out',
          style: 'destructive',
          onPress: async () => {
            const result = await punchOut();
            if (!result.success) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const validateForm = () => {
    if (!form.visit_type) {
      Alert.alert('Required', 'Please select a visit type');
      return false;
    }

    if ((form.visit_type === 'COLLECTION' || form.visit_type === 'DISBURSEMENT')) {
      if (!form.loan_id) {
        Alert.alert('Required', 'Loan ID is required');
        return false;
      }
      if (!form.amount) {
        Alert.alert('Required', 'Amount is required');
        return false;
      }
      if (form.visit_type === 'COLLECTION' && !form.payment_mode) {
        Alert.alert('Required', 'Payment mode is required');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!localLocation) {
      Alert.alert('Error', 'Location not captured');
      return;
    }

    const locationData = {
      ...localLocation,
      current_address: localLocation.current_address,
    };

    const result = await punchIn(form, locationData);

    if (result.success) {
      // Clear form for next punch - don't close modal
      setForm({
        reason: '',
        visit_type: '',
        loan_id: '',
        amount: '',
        payment_mode: '',
        upi_ref: '',
        cheque_no: '',
        customer_address: '',
        customer_name: '',
        travel_with: 'ALONE',
        co_employee_id: '',
        co_employee_name: '',
        vehicle_number: '',
      });
      setLocalLocation(null);
      resetForm();
      Alert.alert('Success', 'Punch recorded! Add another punch or tap close.');
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setLocalLocation(null);
    setForm({
      reason: '',
      visit_type: '',
      loan_id: '',
      amount: '',
      payment_mode: '',
      upi_ref: '',
      cheque_no: '',
      customer_address: '',
      customer_name: '',
      travel_with: 'ALONE',
      co_employee_id: '',
      co_employee_name: '',
      vehicle_number: '',
    });
    resetForm();
  };

  const updateForm = (key, value) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'visit_type') {
        updated.loan_id = '';
        updated.amount = '';
        updated.payment_mode = '';
        updated.upi_ref = '';
        updated.cheque_no = '';
      }
      if (key === 'payment_mode') {
        updated.upi_ref = '';
        updated.cheque_no = '';
      }
      if (key === 'travel_with') {
        updated.co_employee_id = '';
        updated.co_employee_name = '';
        updated.vehicle_number = '';
      }
      return updated;
    });
  };

  const fmtTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const fmtDistance = (km) => {
    if (!km) return '0 km';
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(2)} km`;
  };

  const fmtDuration = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getMapRegion = () => {
    if (localLocation) {
      return { latitude: localLocation.latitude, longitude: localLocation.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }
    return { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  };

  const isFetching = punchState === STATES.FETCHING_LOCATION;
  const isSubmitting = punchState === STATES.SUBMITTING;
  const isPunchingOut = punchState === STATES.PUNCHING_OUT;
  const totalDistance = getTotalDistance();
  const duration = getTrackingDuration();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {errorMessage && <Banner message={errorMessage} type="error" onDismiss={dismissError} />}
      {success && <Banner message={isActive ? 'Punch recorded!' : 'Punch Out completed!'} type="success" onDismiss={() => { }} />}

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isActive ? 'Tracking' : 'Punch'}</Text>
        {isActive ? (
          <TouchableOpacity
            style={[styles.punchOutHeaderBtn, isPunchingOut && styles.disabled]}
            onPress={handlePunchOutPress}
            disabled={isPunchingOut}
          >
            {isPunchingOut ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="log-out" size={14} color="#fff" />
                <Text style={styles.punchOutHeaderText}>Punch Out</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.mapBox}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={getMapRegion()}
            showsUserLocation={isTracking}
          >
            {localLocation && !isActive && (
              <Marker coordinate={{ latitude: localLocation.latitude, longitude: localLocation.longitude }}>
                <View style={[styles.marker, { backgroundColor: isMockLocation ? colors.warning : colors.success }]}>
                  <Icon name={isMockLocation ? 'smartphone' : 'map-pin'} size={16} color="#fff" />
                </View>
              </Marker>
            )}
          </MapView>
          {localLocation && (
            <TouchableOpacity style={styles.mapsBtn} onPress={() => LocationService.openMaps(localLocation.latitude, localLocation.longitude)}>
              <Icon name="external-link" size={16} color={colors.primary} />
              <Text style={styles.mapsBtnText}>Maps</Text>
            </TouchableOpacity>
          )}
        </View>

        <GPSBadge isMock={isMockLocation} isFetching={isFetching} />

        <View style={styles.punchSection}>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? colors.successLight : colors.surface }]}>
            <View style={[styles.dot, { backgroundColor: isActive ? colors.success : colors.textMuted }]} />
            <Text style={[styles.statusText, { color: isActive ? colors.success : colors.textMuted }]}>
              {isFetching ? 'Getting GPS...' : isActive ? 'Punch Active' : 'Ready to Punch'}
            </Text>
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.punchBtn, { backgroundColor: isActive ? colors.success : colors.primary }]}
              onPress={handlePunchPress}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Icon 
                  name="map-pin" 
                  size={48} 
                  color="#fff" 
                />
              )}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.punchLabel}>
            {isFetching ? 'Getting location...' : 'Tap to Punch'}
          </Text>
        </View>

        {isActive && (
          <View style={styles.statsBox}>
            <Text style={styles.sectionTitle}>Live Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Icon name="navigation" size={20} color={colors.primary} />
                <Text style={styles.statVal}>{fmtDistance(totalDistance)}</Text>
                <Text style={styles.statLbl}>Distance</Text>
              </View>
              <View style={styles.stat}>
                <Icon name="clock" size={20} color={colors.warning} />
                <Text style={styles.statVal}>{fmtDuration(duration)}</Text>
                <Text style={styles.statLbl}>Duration</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.activityBox}>
          <Text style={styles.sectionTitle}>Today's Punches ({todayPunches.length})</Text>
          {todayPunches.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="inbox" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>No punches today</Text>
            </View>
          ) : (
            todayPunches.map((p, i) => (
              <View key={p.id || p.punched_at || `punch-${i}`} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Icon name="map-pin" size={20} color={colors.primary} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityType}>{p.visit_type || 'Punch'}</Text>
                  <Text style={styles.activityTime}>{fmtTime(p.punched_at)}</Text>
                  {p.current_address && <Text style={styles.activityAddr} numberOfLines={1}>{p.current_address}</Text>}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Punch Details</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
                <Icon name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {localLocation && (
                <View style={[styles.locCard, { backgroundColor: isMockLocation ? colors.warningLight : colors.successLight }]}>
                  <Icon name={isMockLocation ? 'smartphone' : 'map-pin'} size={18} color={isMockLocation ? colors.warning : colors.success} />
                  <View style={styles.locInfo}>
                    <Text style={[styles.locText, { color: isMockLocation ? colors.warning : colors.success }]}>
                      {localLocation.current_address || `${localLocation.latitude}, ${localLocation.longitude}`}
                    </Text>
                    {isMockLocation && <Text style={styles.mockText}>Dev Mode</Text>}
                  </View>
                </View>
              )}

              <Text style={styles.label}>Reason</Text>
              <TextInput style={styles.input} value={form.reason} onChangeText={(t) => updateForm('reason', t)} placeholder="Enter reason" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Visit Type *</Text>
              <View style={styles.chips}>
                {VISIT_TYPES.map((t) => (
                  <TouchableOpacity key={t.value} style={[styles.chip, form.visit_type === t.value && styles.chipActive]} onPress={() => updateForm('visit_type', t.value)}>
                    <Text style={[styles.chipText, form.visit_type === t.value && styles.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {(form.visit_type === 'COLLECTION' || form.visit_type === 'DISBURSEMENT') && (
                <>
                  <Text style={styles.label}>Loan ID *</Text>
                  <TextInput style={styles.input} value={form.loan_id} onChangeText={(t) => updateForm('loan_id', t)} placeholder="Loan ID" placeholderTextColor={colors.textMuted} />

                  <Text style={styles.label}>Amount *</Text>
                  <TextInput style={styles.input} value={form.amount} onChangeText={(t) => updateForm('amount', t)} placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

                  {form.visit_type === 'COLLECTION' && (
                    <>
                      <Text style={styles.label}>Payment Mode *</Text>
                      <View style={styles.chips}>
                        {PAYMENT_MODES.map((m) => (
                          <TouchableOpacity key={m.value} style={[styles.chip, form.payment_mode === m.value && styles.chipActive]} onPress={() => updateForm('payment_mode', m.value)}>
                            <Text style={[styles.chipText, form.payment_mode === m.value && styles.chipTextActive]}>{m.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {form.payment_mode === 'UPI' && (
                        <>
                          <Text style={styles.label}>UPI Reference ID</Text>
                          <TextInput style={styles.input} value={form.upi_ref} onChangeText={(t) => updateForm('upi_ref', t)} placeholder="UPI Ref" placeholderTextColor={colors.textMuted} />
                        </>
                      )}

                      {form.payment_mode === 'CHEQUE' && (
                        <>
                          <Text style={styles.label}>Cheque Number</Text>
                          <TextInput style={styles.input} value={form.cheque_no} onChangeText={(t) => updateForm('cheque_no', t)} placeholder="Cheque No" placeholderTextColor={colors.textMuted} />
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              <Text style={styles.label}>Customer Address</Text>
              <TextInput style={styles.input} value={form.customer_address} onChangeText={(t) => updateForm('customer_address', t)} placeholder="Customer Address" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Travel With</Text>
              <View style={styles.chips}>
                {TRAVEL_WITH.map((t) => (
                  <TouchableOpacity key={t.value} style={[styles.chip, form.travel_with === t.value && styles.chipActive]} onPress={() => updateForm('travel_with', t.value)}>
                    <Text style={[styles.chipText, form.travel_with === t.value && styles.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.travel_with === 'WITH_EMPLOYEE' && (
                <>
                  <Text style={styles.label}>Employee ID</Text>
                  <TextInput style={styles.input} value={form.co_employee_id} onChangeText={(t) => updateForm('co_employee_id', t)} placeholder="Employee ID" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.label}>Employee Name</Text>
                  <TextInput style={styles.input} value={form.co_employee_name} onChangeText={(t) => updateForm('co_employee_name', t)} placeholder="Employee Name" placeholderTextColor={colors.textMuted} />
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, isSubmitting && styles.disabled]} onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Punch In</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.surface, elevation: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.sizes.lg, fontWeight: 'bold', color: colors.text },
  punchOutHeaderBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E53935', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 4, elevation: 3 },
  punchOutHeaderText: { fontSize: typography.sizes.xs, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  content: { paddingBottom: 120 },
  mapBox: { height: 200, margin: spacing.md, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1 },
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  mapsBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 16, elevation: 2 },
  mapsBtnText: { fontSize: typography.sizes.xs, color: colors.primary, marginLeft: spacing.xs, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.md, marginBottom: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 8 },
  fetchBg: { backgroundColor: colors.primaryLight },
  mockBg: { backgroundColor: colors.warningLight },
  lockedBg: { backgroundColor: colors.successLight },
  badgeText: { fontSize: typography.sizes.xs, marginLeft: spacing.xs, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, paddingTop: spacing.xl },
  errorBg: { backgroundColor: colors.error },
  successBg: { backgroundColor: colors.success },
  bannerText: { flex: 1, fontSize: typography.sizes.sm, color: '#fff', marginHorizontal: spacing.sm },
  punchSection: { alignItems: 'center', padding: spacing.lg },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: typography.sizes.sm, fontWeight: '600' },
  punchBtn: { width: 120, height: 120, borderRadius: 60, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  punchLabel: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textMuted, marginTop: spacing.lg },
  statsBox: { padding: spacing.md },
  sectionTitle: { fontSize: typography.sizes.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row' },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, alignItems: 'center', marginHorizontal: 4, elevation: 2 },
  statVal: { fontSize: typography.sizes.lg, fontWeight: 'bold', color: colors.text, marginTop: spacing.sm },
  statLbl: { fontSize: typography.sizes.xs, color: colors.textMuted },
  activityBox: { padding: spacing.md },
  empty: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.xl, alignItems: 'center', elevation: 2 },
  emptyText: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.md },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, elevation: 2 },
  activityIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  activityContent: { flex: 1 },
  activityType: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.text },
  activityTime: { fontSize: typography.sizes.sm, color: colors.textMuted },
  activityAddr: { fontSize: typography.sizes.xs, color: colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.sizes.xl, fontWeight: 'bold', color: colors.text },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: spacing.lg },
  locCard: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, borderRadius: 12, marginBottom: spacing.md },
  locInfo: { flex: 1, marginLeft: spacing.sm },
  locText: { fontSize: typography.sizes.sm, fontWeight: '500' },
  mockText: { fontSize: typography.sizes.xs, color: colors.warning, marginTop: spacing.xs },
  label: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background, borderRadius: 20, marginRight: spacing.sm, marginBottom: spacing.sm },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: typography.sizes.sm, color: colors.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, fontSize: typography.sizes.md, color: colors.text },
  modalFooter: { flexDirection: 'row', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, marginRight: spacing.sm },
  cancelText: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textMuted },
  submitBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginLeft: spacing.sm },
  submitText: { fontSize: typography.sizes.md, fontWeight: 'bold', color: '#fff' },
  disabled: { opacity: 0.7 },
});

export default EmployeePunchScreen;
