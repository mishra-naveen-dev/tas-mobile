import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { usePunch, PUNCH_STATES } from '../context/PunchContext';
import { colors, typography, spacing } from '../theme/tokens';
import LocationService from '../services/LocationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VISIT_TYPES = [
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'DISBURSEMENT', label: 'Disbursement' },
  { value: 'CLIENT', label: 'Client Visit' },
  { value: 'FIELD', label: 'Field Visit' },
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

const ErrorBanner = ({ message, type = 'error', onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    const timer = setTimeout(() => {
      handleDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss?.());
  };

  const bannerStyle = type === 'success' ? styles.successBanner : styles.errorBanner;
  const iconName = type === 'success' ? 'check-circle' : 'alert-circle';

  return (
    <Animated.View style={[styles.banner, bannerStyle, { transform: [{ translateY }] }]}>
      <Icon name={iconName} size={20} color={type === 'success' ? '#FFFFFF' : '#FFFFFF'} />
      <Text style={styles.bannerText}>{message}</Text>
      <TouchableOpacity onPress={handleDismiss} style={styles.bannerClose}>
        <Icon name="x" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const MockLocationBadge = ({ visible }) => {
  if (!visible) return null;

  return (
    <View style={styles.mockBadge}>
      <Icon name="smartphone" size={14} color={colors.warning} />
      <Text style={styles.mockBadgeText}>{LocationService.getMockConfig().devLabel}</Text>
    </View>
  );
};

const EmployeePunchScreen = ({ navigation }) => {
  const {
    punchState,
    isActive,
    isIdle,
    isLoading,
    punchLocation,
    trackingCoords,
    currentLocation,
    todayPunches,
    capturedLocation: contextCapturedLocation,
    isMockLocation,
    locationError,
    submitError,
    submitSuccess,
    punchIn,
    fetchLocation,
    resetForm,
    dismissError,
    canProcessPunchClick,
    openInGoogleMaps,
  } = usePunch();

  const [showModal, setShowModal] = useState(false);
  const [localCapturedLocation, setLocalCapturedLocation] = useState(null);
  const [localIsMock, setLocalIsMock] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    reason: '',
    visit_type: '',
    loan_id: '',
    amount: '',
    payment_mode: '',
    customer_address: '',
    travel_with: 'ALONE',
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, pulseAnim]);

  useEffect(() => {
    if (punchState === PUNCH_STATES.FORM_OPEN && contextCapturedLocation) {
      setLocalCapturedLocation(contextCapturedLocation);
      setLocalIsMock(isMockLocation);
      setFormData((prev) => ({ ...prev, address: contextCapturedLocation.address || '' }));
      setShowModal(true);
    }
  }, [punchState, contextCapturedLocation, isMockLocation]);

  const handlePunchButton = useCallback(async () => {
    if (!canProcessPunchClick()) return;
    if (isLoading) return;

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    if (isIdle) {
      const result = await fetchLocation();

      if (!result.success) {
        Alert.alert('Location Error', result.error || 'Unable to get location', [
          { text: 'OK', onPress: dismissError },
        ]);
      }
    }
  }, [canProcessPunchClick, isLoading, isIdle, fetchLocation, dismissError]);

  const handleSubmit = async () => {
    if (!formData.visit_type) {
      Alert.alert('Required', 'Please select a visit type');
      return;
    }

    if (!localCapturedLocation) {
      Alert.alert('Error', 'Location not captured. Please try again.');
      return;
    }

    if (
      (formData.visit_type === 'COLLECTION' || formData.visit_type === 'DISBURSEMENT') &&
      (!formData.loan_id || !formData.amount)
    ) {
      Alert.alert('Required', 'Loan ID and Amount are required');
      return;
    }

    const result = await punchIn(formData, localCapturedLocation);

    if (result.success) {
      setShowModal(false);
      resetForm();
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setLocalCapturedLocation(null);
    setLocalIsMock(false);
    resetForm();
  };

  const updateForm = (key, value) => {
    setFormData((prev) => {
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

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDistance = (km) =>
    km ? (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(2)}km`) : '0 km';

  const getMarkerColor = () => {
    if (localIsMock) return colors.warning;
    return colors.success;
  };

  const getMarkerIcon = () => {
    if (localIsMock) return 'smartphone';
    return 'map-pin';
  };

  const initialRegion = localCapturedLocation
    ? {
        latitude: localCapturedLocation.latitude,
        longitude: localCapturedLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : { latitude: 23.0225, longitude: 72.5714, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  const routeCoords = trackingCoords.map((c) => ({
    latitude: c.latitude,
    longitude: c.longitude,
  }));

  const isFetching = punchState === PUNCH_STATES.FETCHING_LOCATION;
  const isSubmitting = punchState === PUNCH_STATES.SUBMITTING;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {(locationError || submitError) && (
        <ErrorBanner
          message={locationError || submitError}
          type={locationError ? 'error' : 'error'}
          onDismiss={dismissError}
        />
      )}

      {submitSuccess && (
        <ErrorBanner message="Punch In recorded successfully!" type="success" onDismiss={() => {}} />
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Punch In</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={initialRegion}
            showsUserLocation={true}
          >
            {localCapturedLocation && (
              <Marker
                coordinate={{
                  latitude: localCapturedLocation.latitude,
                  longitude: localCapturedLocation.longitude,
                }}
              >
                <View
                  style={[
                    styles.markerContainer,
                    { backgroundColor: getMarkerColor() },
                  ]}
                >
                  <Icon name={getMarkerIcon()} size={20} color="#FFFFFF" />
                </View>
              </Marker>
            )}
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeWidth={4}
                strokeColor={colors.punchBlue}
              />
            )}
          </MapView>

          {localCapturedLocation && (
            <TouchableOpacity
              style={styles.mapsButton}
              onPress={() =>
                openInGoogleMaps(localCapturedLocation.latitude, localCapturedLocation.longitude)
              }
            >
              <Icon name="external-link" size={16} color={colors.punchBlue} />
              <Text style={styles.mapsButtonText}>Open in Maps</Text>
            </TouchableOpacity>
          )}
        </View>

        <MockLocationBadge visible={localIsMock && localCapturedLocation} />

        <View style={styles.punchSection}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isActive ? colors.successLight : colors.punchBlueLight,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isActive ? colors.success : colors.punchBlue },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isActive ? colors.success : colors.punchBlue },
              ]}
            >
              {isActive
                ? 'Punch Active'
                : isFetching
                ? 'Getting Location...'
                : 'Ready to Punch'}
            </Text>
          </View>

          {isActive && punchLocation && (
            <Text style={styles.startTimeText}>Started at {formatTime(punchLocation.timestamp)}</Text>
          )}

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[
                styles.punchButton,
                {
                  backgroundColor: isActive ? colors.success : colors.punchBlue,
                  opacity: isFetching || isSubmitting ? 0.7 : 1,
                },
              ]}
              onPress={handlePunchButton}
              disabled={isLoading || isActive}
            >
              {isLoading ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                <Icon
                  name={isActive ? 'check-circle' : 'map-pin'}
                  size={56}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.punchLabel}>
            {isActive
              ? 'Punch Active'
              : isFetching
              ? 'Capturing location...'
              : 'Tap to Punch In'}
          </Text>
        </View>

        {isActive && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Route Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Icon name="navigation" size={20} color={colors.info} />
                <Text style={styles.statValue}>{formatDistance(trackingCoords.length * 0.5)}</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statCard}>
                <Icon name="map-pin" size={20} color={colors.punchBlue} />
                <Text style={styles.statValue}>{trackingCoords.length}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Today's Punches</Text>
          {todayPunches.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="inbox" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>No punches recorded today</Text>
            </View>
          ) : (
            todayPunches.map((punch, index) => (
              <View key={punch.id || index} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Icon name="map-pin" size={20} color={colors.punchBlue} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityType}>{punch.visit_type || 'Punch'}</Text>
                  <Text style={styles.activityTime}>{formatTime(punch.punched_at)}</Text>
                  {punch.current_address && (
                    <Text style={styles.activityAddress} numberOfLines={1}>
                      {punch.current_address}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Punch In Details</Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeBtn}>
                <Icon name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {localCapturedLocation && (
                <View style={styles.locationCard}>
                  <Icon
                    name={localIsMock ? 'smartphone' : 'map-pin'}
                    size={18}
                    color={localIsMock ? colors.warning : colors.success}
                  />
                  <View style={styles.locationInfo}>
                    <Text
                      style={[
                        styles.locationText,
                        { color: localIsMock ? colors.warning : colors.success },
                      ]}
                      numberOfLines={2}
                    >
                      {localCapturedLocation.address ||
                        `${localCapturedLocation.latitude}, ${localCapturedLocation.longitude}`}
                    </Text>
                    {localIsMock && (
                      <Text style={styles.mockLabel}>{LocationService.getMockConfig().devLabel}</Text>
                    )}
                  </View>
                </View>
              )}

              <Text style={styles.fieldLabel}>Visit Type *</Text>
              <View style={styles.chipContainer}>
                {VISIT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.chip, formData.visit_type === type.value && styles.chipActive]}
                    onPress={() => updateForm('visit_type', type.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        formData.visit_type === type.value && styles.chipTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Reason</Text>
              <TextInput
                style={styles.input}
                value={formData.reason}
                onChangeText={(text) => updateForm('reason', text)}
                placeholder="Enter reason"
                placeholderTextColor={colors.textMuted}
              />

              {(formData.visit_type === 'COLLECTION' || formData.visit_type === 'DISBURSEMENT') && (
                <>
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
                      <Text style={styles.fieldLabel}>Payment Mode</Text>
                      <View style={styles.chipContainer}>
                        {PAYMENT_MODES.map((mode) => (
                          <TouchableOpacity
                            key={mode.value}
                            style={[
                              styles.chip,
                              formData.payment_mode === mode.value && styles.chipActive,
                            ]}
                            onPress={() => updateForm('payment_mode', mode.value)}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                formData.payment_mode === mode.value && styles.chipTextActive,
                              ]}
                            >
                              {mode.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </>
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
              <View style={styles.chipContainer}>
                {TRAVEL_WITH.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.chip,
                      formData.travel_with === option.value && styles.chipActive,
                    ]}
                    onPress={() => updateForm('travel_with', option.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        formData.travel_with === option.value && styles.chipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Punch In</Text>
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
    padding: spacing.md,
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  mapContainer: {
    height: 200,
    margin: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  mapsButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    elevation: 2,
  },
  mapsButtonText: {
    fontSize: typography.sizes.xs,
    color: colors.punchBlue,
    marginLeft: spacing.xs,
    fontWeight: typography.weights.semibold,
  },
  mockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningLight,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  mockBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.warning,
    marginLeft: spacing.xs,
    fontWeight: typography.weights.semibold,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingTop: spacing.xl,
  },
  errorBanner: {
    backgroundColor: colors.error,
  },
  successBanner: {
    backgroundColor: colors.success,
  },
  bannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: '#FFFFFF',
    marginLeft: spacing.sm,
    fontWeight: typography.weights.medium,
  },
  bannerClose: {
    padding: spacing.xs,
  },
  punchSection: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  startTimeText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  punchButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  punchLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  statsSection: {
    padding: spacing.md,
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
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
  },
  activitySection: {
    padding: spacing.md,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.punchBlueLight,
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
  },
  activityAddress: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successLight,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  locationInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  locationText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  mockLabel: {
    fontSize: typography.sizes.xs,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textDark,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 20,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.punchBlue,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.weights.semibold,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.textDark,
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
    backgroundColor: colors.punchBlue,
    marginLeft: spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
});

export default EmployeePunchScreen;
