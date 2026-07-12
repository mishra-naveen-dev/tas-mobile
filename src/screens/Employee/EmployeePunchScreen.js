import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Alert, TextInput, Modal, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { usePunch, STATES } from '../../context/PunchContext';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';

const { width } = Dimensions.get('window');

const VISIT_TYPES = [
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'DISBURSEMENT', label: 'Disbursement' },
  { value: 'OTHER', label: 'Other' },
];

const REASON_PRESETS = [
  { value: 'Collection',    label: 'Collection' },
  { value: 'Home Visit',    label: 'Home Visit' },
  { value: 'eKYC',          label: 'eKYC' },
  { value: 'Disbursement',  label: 'Disbursement' },
  { value: 'Audit',         label: 'Audit' },
  { value: 'Brch_Audit',    label: 'Brch Audit' },
  { value: 'P2P_JLG',       label: 'P2P JLG' },
  { value: 'Custil_Aud',    label: 'Custil Aud' },
  { value: 'CustJLG_Aud',    label: 'CustJLG Aud' },
  { value: 'Branch_Visit',  label: 'Branch Visit' },
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
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
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

  // ── Address proximity helpers ──────────────────────────────────────────────
  // Haversine distance between two GPS points, returns metres.
  const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Bounding box ~250 m around a point — used for the on-focus nearby fetch.
  const bbox250m = (lat, lng) => {
    const d = 0.00225;
    return `${lng - d},${lat - d},${lng + d},${lat + d}`;
  };

  // ~200 m bounding box — used with bounded=1 for typed queries.
  const bbox100m = (lat, lng) => {
    const d = 0.0018; // ~200 m
    return `${lng - d},${lat - d},${lng + d},${lat + d}`;
  };

  // Nearby address suggestions (OpenStreetMap Nominatim — no API key needed).
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressVerified, setAddressVerified] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressWarn, setAddressWarn] = useState('');
  const addressDebounceRef = useRef(null);
  const selectingAddressRef = useRef(false);

  const fetchNearbyAddresses = useCallback(async (query = '') => {
    if (!localLocation) return;
    setAddressLoading(true);
    try {
      const { latitude, longitude } = localLocation;
      const bb = bbox250m(latitude, longitude);
      const headers = { 'User-Agent': 'TAS-Enterprise/1.0 (field-operations)' };

      if (!query || query.length < 2) {
        // On focus: reverse-geocode current position + nearby places.
        const [revRes, nearRes] = await Promise.all([
          fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=18`,
            { headers }
          ),
          fetch(
            `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&bounded=1&viewbox=${bb}&limit=6&countrycodes=in`,
            { headers }
          ),
        ]);
        const rev = await revRes.json();
        const near = await nearRes.json();

        const list = [];
        if (rev?.display_name) {
          list.push({ id: '__current__', label: rev.display_name, lat: latitude, lng: longitude, isCurrent: true });
        }
        (near || []).forEach((p, i) => {
          if (p.display_name !== rev?.display_name) {
            list.push({ id: `n${i}`, label: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) });
          }
        });
        setAddressSuggestions(list.slice(0, 6));
      } else {
        // Typed query: wide search biased toward the user's area (no bounded
        // restriction so "Sakar 3", "Main Road", etc. resolve correctly).
        const wideBb = bbox100m(latitude, longitude);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&bounded=1&viewbox=${wideBb}&countrycodes=in&limit=8`,
          { headers }
        );
        const results = await res.json();
        setAddressSuggestions(
          (results || []).map((p, i) => ({
            id: `s${i}`,
            label: p.display_name,
            lat: parseFloat(p.lat),
            lng: parseFloat(p.lon),
          }))
        );
      }
      setShowAddressSuggestions(true);
    } catch {
      setAddressSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  }, [localLocation]);

  const applyAddressSuggestion = (s) => {
    selectingAddressRef.current = false;
    updateForm('customer_address', s.label);
    setAddressVerified(true);
    setAddressWarn('');
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  // Called on submit: geocode a manually typed address and verify proximity.
  const verifyAddressOnSubmit = useCallback(async () => {
    if (!localLocation || !form.customer_address || addressVerified) return true;
    try {
      const { latitude, longitude } = localLocation;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.customer_address)}&format=json&limit=1&countrycodes=in`,
        { headers: { 'User-Agent': 'TAS-Enterprise/1.0' } }
      );
      const results = await res.json();
      if (!results?.length) return true; // Can't geocode → allow, no data
      const dist = haversineMeters(latitude, longitude, parseFloat(results[0].lat), parseFloat(results[0].lon));
      if (dist > 250) {
        return await new Promise((resolve) =>
          Alert.alert(
            'Address Out of Range',
            `The address you entered is ~${Math.round(dist)} m from your GPS location (limit 250 m). It may be incorrect.\n\nProceed anyway?`,
            [
              { text: 'Fix Address', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Proceed', style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        );
      }
      return true;
    } catch {
      return true; // Network error → allow
    }
  }, [localLocation, form.customer_address, addressVerified]);

  // Loan ID autocomplete from the employee's uploaded collection records.
  const [loanSuggestions, setLoanSuggestions] = useState([]);
  const [showLoanSuggestions, setShowLoanSuggestions] = useState(false);
  const loanDebounceRef = useRef(null);

  const fetchLoanSuggestions = useCallback((query) => {
    if (loanDebounceRef.current) clearTimeout(loanDebounceRef.current);
    if (!query || query.length < 2) {
      setLoanSuggestions([]);
      setShowLoanSuggestions(false);
      return;
    }
    loanDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.getCollections({ search: query });
        const list = res.data.results || res.data || [];
        setLoanSuggestions(list.slice(0, 8));
        setShowLoanSuggestions(list.length > 0);
      } catch {
        setLoanSuggestions([]);
      }
    }, 350);
  }, []);

  const applyLoanSuggestion = (rec) => {
    setForm((prev) => ({
      ...prev,
      loan_id: rec.loan_id,
      customer_name: rec.customer_name && rec.customer_name !== 'Unknown' ? rec.customer_name : prev.customer_name,
      customer_address: [rec.address, rec.pincode].filter(Boolean).join(', ') || prev.customer_address,
      amount: rec.amount_due ? String(rec.amount_due) : prev.amount,
    }));
    setShowLoanSuggestions(false);
    setLoanSuggestions([]);
  };

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
        showLocationAlert(result);
      }
    }
  };

  // Turn a location failure into an actionable prompt instead of a dead-end "OK".
  const showLocationAlert = (result) => {
    const type = result.errorType;

    if (type === 'PERMISSION_BLOCKED') {
      Alert.alert(
        'Enable Location',
        result.error || 'Location permission is turned off for TAS. Please enable it in Settings to punch.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => LocationService?.openSettings?.() },
        ]
      );
      return;
    }

    if (type === 'LOCATION_OFF') {
      Alert.alert(
        'Turn On Location',
        'Your device location (GPS) is off. Please turn on location, then tap Retry.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handlePunchPress() },
        ]
      );
      return;
    }

    // PERMISSION_DENIED / GPS_ERROR / TIMEOUT — allow a quick retry (which
    // re-requests the permission prompt).
    Alert.alert(
      'Location Needed',
      result.error || 'Could not get your location. Please try again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => handlePunchPress() },
      ]
    );
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
      if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) < 0) {
        Alert.alert('Invalid', 'Amount cannot be negative');
        return false;
      }
      if (form.loan_id.length > 10) {
        Alert.alert('Invalid', 'Loan ID cannot be more than 10 characters');
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
    if (form.customer_address) {
      const ok = await verifyAddressOnSubmit();
      if (!ok) return;
    }

    const locationData = {
      ...localLocation,
      current_address: localLocation.current_address,
    };

    const result = await punchIn(form, locationData);

    if (result.success) {
      // Clear form for next punch - don't close modal
      setReasonDropdownOpen(false);
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
      setAddressVerified(false);
      setAddressWarn('');
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      resetForm();
      Alert.alert('Success', 'Punch recorded! Add another punch or tap close.');
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setLocalLocation(null);
    setReasonDropdownOpen(false);
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

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
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
              {/* Combo: free-text input + preset dropdown */}
              <View style={styles.reasonWrap}>
                <TextInput
                  style={styles.reasonInput}
                  value={form.reason}
                  onChangeText={(t) => updateForm('reason', t)}
                  placeholder="Type or select a reason..."
                  placeholderTextColor={colors.textMuted}
                  onFocus={() => setReasonDropdownOpen(true)}
                />
                <TouchableOpacity
                  style={styles.reasonToggle}
                  onPress={() => setReasonDropdownOpen((o) => !o)}
                >
                  <Icon
                    name={reasonDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={reasonDropdownOpen ? colors.primary : colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Preset dropdown list */}
              {reasonDropdownOpen && (
                <View style={styles.reasonDropdown}>
                  {REASON_PRESETS.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        styles.reasonOption,
                        form.reason === r.value && styles.reasonOptionActive,
                      ]}
                      onPress={() => {
                        updateForm('reason', r.value);
                        setReasonDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.reasonOptionText,
                          form.reason === r.value && styles.reasonOptionTextActive,
                        ]}
                      >
                        {r.label}
                      </Text>
                      {form.reason === r.value && (
                        <Icon name="check" size={14} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Quick-select chips (always visible) */}
              <View style={styles.reasonChips}>
                {REASON_PRESETS.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.reasonChip,
                      form.reason === r.value && styles.reasonChipActive,
                    ]}
                    onPress={() => updateForm('reason', form.reason === r.value ? '' : r.value)}
                  >
                    <Text
                      style={[
                        styles.reasonChipText,
                        form.reason === r.value && styles.reasonChipTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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
                  <TextInput
                    style={styles.input}
                    value={form.loan_id}
                    onChangeText={(t) => {
                      const v = t.slice(0, 10);
                      updateForm('loan_id', v);
                      fetchLoanSuggestions(v);
                    }}
                    placeholder="Loan ID (max 10)"
                    placeholderTextColor={colors.textMuted}
                    maxLength={10}
                    autoCapitalize="characters"
                  />
                  {showLoanSuggestions && (
                    <View style={styles.suggestionBox}>
                      {loanSuggestions.map((s) => (
                        <TouchableOpacity key={s.id} style={styles.suggestionItem} onPress={() => applyLoanSuggestion(s)}>
                          <Text style={styles.suggestionLoan}>{s.loan_id}</Text>
                          <Text style={styles.suggestionMeta} numberOfLines={1}>
                            {(s.customer_name && s.customer_name !== 'Unknown') ? s.customer_name : 'Customer'}
                            {s.amount_due ? `  ·  ₹${Number(s.amount_due).toLocaleString('en-IN')}` : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.label}>Amount *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.amount}
                    onChangeText={(t) => updateForm('amount', t.replace(/[^0-9.]/g, ''))}
                    placeholder="Amount"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />

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
              {/* Smart address input — shows nearby addresses (within 250 m of GPS) */}
              <View style={{ position: 'relative', zIndex: 50 }}>
                <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingHorizontal: 0 }]}>
                  <TextInput
                    style={{ flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                    value={form.customer_address}
                    onChangeText={(t) => {
                      updateForm('customer_address', t);
                      setAddressVerified(false);
                      setAddressWarn('');
                      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
                      addressDebounceRef.current = setTimeout(() => fetchNearbyAddresses(t), 400);
                    }}
                    onFocus={() => fetchNearbyAddresses('')}
                    onBlur={() => {
                      setTimeout(() => {
                        if (!selectingAddressRef.current) setShowAddressSuggestions(false);
                      }, 300);
                    }}
                    placeholder="Tap to see nearby addresses…"
                    placeholderTextColor={colors.textMuted}
                    multiline={false}
                  />
                  {addressLoading
                    ? <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 10 }} />
                    : addressVerified
                      ? <Icon name="check-circle" size={16} color="#16a34a" style={{ marginRight: 10 }} />
                      : <Icon name="map-pin" size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
                  }
                </View>

                {/* GPS-verified badge */}
                {addressVerified && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, marginLeft: 2, gap: 4 }}>
                    <Icon name="shield" size={10} color="#16a34a" />
                    <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '700', letterSpacing: 0.3 }}>
                      GPS VERIFIED · WITHIN 250 m
                    </Text>
                  </View>
                )}

                {/* Out-of-range warning */}
                {!!addressWarn && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, marginLeft: 2, gap: 4 }}>
                    <Icon name="alert-triangle" size={10} color="#d97706" />
                    <Text style={{ fontSize: 10, color: '#d97706', fontWeight: '600' }}>{addressWarn}</Text>
                  </View>
                )}

                {/* Nearby suggestions dropdown */}
                {showAddressSuggestions && addressSuggestions.length > 0 && (
                  <View style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    backgroundColor: colors.surface || '#fff',
                    borderRadius: 10,
                    borderWidth: 1, borderColor: colors.border || '#e5e7eb',
                    elevation: 12,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.18, shadowRadius: 10,
                    maxHeight: 240, overflow: 'hidden',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border || '#f3f4f6' }}>
                      <Icon name="map-pin" size={11} color={colors.primary} />
                      <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700', marginLeft: 4, letterSpacing: 0.4 }}>
                        NEARBY ADDRESSES · 250 m RADIUS
                      </Text>
                    </View>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {addressSuggestions.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={{
                            flexDirection: 'row', alignItems: 'flex-start',
                            paddingHorizontal: 12, paddingVertical: 10,
                            borderBottomWidth: 1, borderBottomColor: colors.border || '#f3f4f6', gap: 8,
                          }}
                          onPressIn={() => { selectingAddressRef.current = true; }}
                          onPress={() => applyAddressSuggestion(s)}
                          onPressOut={() => { if (!selectingAddressRef.current) return; }}
                        >
                          <Icon
                            name={s.isCurrent ? 'crosshair' : 'map'}
                            size={13}
                            color={s.isCurrent ? colors.primary : colors.textMuted}
                            style={{ marginTop: 1 }}
                          />
                          <Text style={{ flex: 1, fontSize: 12, color: colors.text, lineHeight: 16 }} numberOfLines={3}>
                            {s.label}
                          </Text>
                          {s.isCurrent && (
                            <View style={{ backgroundColor: (colors.primary || '#dc2626') + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }}>
                              <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '800', letterSpacing: 0.3 }}>YOU</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

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

  suggestionBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  suggestionLoan: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.text },
  suggestionMeta: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },

  // ── Reason combo field ────────────────────────────────────────────────────
  reasonWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  reasonToggle: {
    padding: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  reasonDropdown: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  reasonOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  reasonOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  reasonOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: 6,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  reasonChipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  reasonChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  modalFooter: { flexDirection: 'row', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, marginRight: spacing.sm },
  cancelText: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textMuted },
  submitBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginLeft: spacing.sm },
  submitText: { fontSize: typography.sizes.md, fontWeight: 'bold', color: '#fff' },
  disabled: { opacity: 0.7 },
});

export default EmployeePunchScreen;
