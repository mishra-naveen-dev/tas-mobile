import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Alert, TextInput, Modal, ActivityIndicator, Dimensions, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { usePunch, STATES } from '../../context/PunchContext';
import { isPhone } from '../../common/helpers/validationHelpers';
import api from '../../api/api';
import { colors, typography, spacing } from '../../theme/tokens';
import VoiceNoteRecorder from '../../components/VoiceNoteRecorder';
import {
  STATUS_OPTIONS, VISIT_TYPE_OPTIONS, DPD_BUCKET_OPTIONS, YES_NO_OPTIONS,
  PAYMENT_MODES, PHOTO_KINDS, isAudioRequiredFor, buildCompleteVisitFormData,
  validateCollectionStatus, validateVisitType,
} from '../../utils/collectionVisitRules';

const { width } = Dimensions.get('window');

// "Visit Type" here is a DIFFERENT, older axis from Collection Status below —
// only Disbursement still uses it (Loan ID + Amount, no collection-outcome
// concept). Collection/Visit reasons (below) drive their own flow directly
// off `reason` and hide this row entirely — see isLoanLinkedReason.
const VISIT_TYPES = [
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'DISBURSEMENT', label: 'Disbursement' },
  { value: 'OTHER', label: 'Other' },
];

// "Visit" replaces the old flat "Home Visit" preset — picking it now reveals
// the same Home Visit / OD Visit / Other sub-type chips CollectionVisitScreen
// uses (VISIT_TYPE_OPTIONS), instead of jumping straight into a Home-Visit-only
// form. Every other preset here is unaffected by this change — still a plain
// punch, no loan linkage, exactly as before.
const REASON_PRESETS = [
  { value: 'Collection',    label: 'Collection' },
  { value: 'Visit',         label: 'Visit' },
  { value: 'eKYC',          label: 'eKYC' },
  { value: 'Disbursement',  label: 'Disbursement' },
  { value: 'Audit',         label: 'Audit' },
  { value: 'Brch_Audit',    label: 'Brch Audit' },
  { value: 'P2P_JLG',       label: 'P2P JLG' },
  { value: 'Custil_Aud',    label: 'Custil Aud' },
  { value: 'CustJLG_Aud',    label: 'CustJLG Aud' },
  { value: 'Branch_Visit',  label: 'Branch Visit' },
];

const TRAVEL_WITH = [
  { value: 'ALONE', label: 'Alone' },
  { value: 'WITH_EMPLOYEE', label: 'With Employee' },
];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

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

// Milestone 2a: shown when the employee's last tracking session ended via
// auto-punch-out (11h max duration / 2.5h inactivity) rather than a manual
// punch-out — lets them flag it for a Manager/Regional Manager to review
// against the recorded GPS route instead of relying on remarks alone.
const AutoClosureBanner = ({ pendingAutoClosure, onSubmit }) => {
  const [submitting, setSubmitting] = useState(false);
  if (!pendingAutoClosure?.session) return null;

  const endTime = pendingAutoClosure.session.end_time
    ? new Date(pendingAutoClosure.session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const handlePress = () => {
    Alert.alert(
      'Request a Review?',
      `Your last session ended automatically${endTime ? ` at ${endTime}` : ''}. ` +
      `A Manager will review the recorded GPS route before approving.`,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Request Review', onPress: async () => {
            setSubmitting(true);
            const result = await onSubmit();
            setSubmitting(false);
            if (!result.success) {
              Alert.alert('Could not submit', result.error || 'Please try again later.');
            }
          },
        },
      ],
    );
  };

  return (
    <TouchableOpacity style={styles.autoClosureBanner} onPress={handlePress} disabled={submitting}>
      <Icon name="alert-triangle" size={18} color={colors.warning} />
      <Text style={styles.autoClosureText}>
        {submitting ? 'Submitting...' : `Session ended automatically${endTime ? ` at ${endTime}` : ''} — tap to request review`}
      </Text>
    </TouchableOpacity>
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
    pendingAutoClosure, submitForgotPunchRequest, registerExternalPunchIn,
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
    customer_name: '',
    travel_with: 'ALONE',
    co_employee_id: '',
    co_employee_name: '',
    co_employee_phone: '',
    vehicle_number: '',
    // Collection Status (reason === 'Collection', a real record resolved)
    status: '',
    collected_amount: '',
    remarks: '',
    promise_date: null,
    // Visit (reason === 'Visit': Home Visit / OD Visit / Other)
    visit_reason: '',
    visit_dpd_bucket: '',
    visit_purpose: '',
    visit_outcome: '',
    customer_available: null,
    customer_met: null,
    family_member_met: null,
    follow_up_required: null,
  });
  const [audioNote, setAudioNote] = useState(null); // { uri, fileName, mimeType, durationSeconds }
  const [showPromiseDatePicker, setShowPromiseDatePicker] = useState(false);
  const [visitSaving, setVisitSaving] = useState(false);
  const visitStartTimeRef = useRef(new Date());

  // Collection-status evidence (Cash photo(s) / UPI screenshot / cheque
  // photo) — required by the same shared validateCollectionStatus rule
  // CollectionVisitScreen enforces, so this screen needs the same capture
  // UI, not just the same validation.
  const [photos, setPhotos] = useState([]); // [{ uri, fileName, type, kind, capturedAt }]
  const [upiScreenshot, setUpiScreenshot] = useState(null); // { uri, fileName, type }
  const [chequePhoto, setChequePhoto] = useState(null); // { uri, fileName, type }

  // Out-of-range geofence confirmation (shown when the backend reports the
  // punch is more than 200m from the customer's stored geo-tag).
  const [outOfRangeModal, setOutOfRangeModal] = useState({ visible: false, distanceM: 0 });
  const [outOfRangeReason, setOutOfRangeReason] = useState('');
  const [outOfRangeComment, setOutOfRangeComment] = useState('');

  // Same-location confirmation (shown when this punch lands within ~20m of
  // another customer already punched today).
  const [dupLocationModal, setDupLocationModal] = useState({ visible: false, otherLoanId: '' });
  const [dupLocationReason, setDupLocationReason] = useState('');
  const [dupLocationComment, setDupLocationComment] = useState('');

  // Loan ID autocomplete from the employee's uploaded collection records.
  const [loanSuggestions, setLoanSuggestions] = useState([]);
  const [showLoanSuggestions, setShowLoanSuggestions] = useState(false);
  const loanDebounceRef = useRef(null);

  // Collection/Visit reasons resolve the typed/picked Loan ID to a real
  // CollectionRecord before anything else can be filled in — there's no
  // record to update otherwise. `resolvedRecord` backs the amount-due
  // auto-fill and the promise-date bounds, exactly like CollectionVisitScreen's
  // own `record`.
  const [collectionId, setCollectionId] = useState(null);
  const [resolvedRecord, setResolvedRecord] = useState(null);
  const [loanLookupError, setLoanLookupError] = useState('');
  const [loanResolving, setLoanResolving] = useState(false);

  const isLoanLinkedReason = form.reason === 'Collection' || form.reason === 'Visit';

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
      amount: rec.amount_due ? String(rec.amount_due) : prev.amount,
    }));
    setCollectionId(rec.id);
    setResolvedRecord(rec);
    setLoanLookupError('');
    setShowLoanSuggestions(false);
    setLoanSuggestions([]);
  };

  // Officer typed a Loan ID and moved on without tapping a suggestion —
  // resolve it via the exact (case-insensitive) lookup before allowing the
  // Collection Status / Visit Type fields to appear. A no-match blocks
  // progress with a clear error instead of silently letting the officer
  // fill in fields for a record that doesn't exist.
  const resolveLoanIdOnBlur = async () => {
    if (!isLoanLinkedReason || collectionId || !form.loan_id.trim()) return;
    setLoanResolving(true);
    setLoanLookupError('');
    try {
      const res = await api.getCollectionByLoanId(form.loan_id.trim());
      const list = res.data.results || res.data || [];
      if (list.length >= 1) {
        applyLoanSuggestion(list[0]);
      } else {
        setLoanLookupError('Loan ID not found. Please check and try again, or pick from suggestions.');
      }
    } catch {
      setLoanLookupError('Could not verify this Loan ID. Please try again.');
    } finally {
      setLoanResolving(false);
    }
  };

  const addPhoto = (kind) => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: () => pickPhoto(kind, true) },
      { text: 'Gallery', onPress: () => pickPhoto(kind, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickPhoto = async (kind, fromCamera) => {
    const options = { mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600, saveToPhotos: false };
    const result = fromCamera ? await launchCamera(options) : await launchImageLibrary(options);
    if (result.didCancel || result.errorCode) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setPhotos((prev) => [...prev, {
      uri: asset.uri,
      fileName: asset.fileName || `photo_${Date.now()}.jpg`,
      type: asset.type || 'image/jpeg',
      kind,
      capturedAt: new Date().toISOString(),
    }]);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const addSingleImage = (label, setter) => {
    Alert.alert(label, 'Choose a source', [
      { text: 'Camera', onPress: () => pickSingleImage(setter, true) },
      { text: 'Gallery', onPress: () => pickSingleImage(setter, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickSingleImage = async (setter, fromCamera) => {
    const options = { mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600, saveToPhotos: false };
    const result = fromCamera ? await launchCamera(options) : await launchImageLibrary(options);
    if (result.didCancel || result.errorCode) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setter({ uri: asset.uri, fileName: asset.fileName || `photo_${Date.now()}.jpg`, type: asset.type || 'image/jpeg' });
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
    if (isLoanLinkedReason) {
      if (!collectionId) {
        Alert.alert('Required', 'Please enter a valid Loan ID.');
        return false;
      }
      if (form.reason === 'Collection') {
        const err = validateCollectionStatus(form, { photos, upiScreenshot, chequePhoto, audioNote });
        if (err) {
          Alert.alert('Required', err);
          return false;
        }
      }
      if (form.reason === 'Visit') {
        const err = validateVisitType(form, { audioNote });
        if (err) {
          Alert.alert('Required', err);
          return false;
        }
      }
    } else {
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
    }

    if (form.travel_with === 'WITH_EMPLOYEE') {
      if (!form.co_employee_phone) {
        Alert.alert('Required', 'Employee phone number is required');
        return false;
      }
      if (!isPhone(form.co_employee_phone)) {
        Alert.alert('Invalid', 'Enter a valid 10-digit phone number');
        return false;
      }
    }

    return true;
  };

  const blankForm = {
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
    co_employee_phone: '',
    vehicle_number: '',
    status: '',
    collected_amount: '',
    remarks: '',
    promise_date: null,
    visit_reason: '',
    visit_dpd_bucket: '',
    visit_purpose: '',
    visit_outcome: '',
    customer_available: null,
    customer_met: null,
    family_member_met: null,
    follow_up_required: null,
  };

  const resetPunchForm = () => {
    setModalVisible(false);
    setReasonDropdownOpen(false);
    setForm(blankForm);
    setAudioNote(null);
    setPhotos([]);
    setUpiScreenshot(null);
    setChequePhoto(null);
    setCollectionId(null);
    setResolvedRecord(null);
    setLoanLookupError('');
    setLocalLocation(null);
    setOutOfRangeModal({ visible: false, distanceM: 0 });
    setOutOfRangeReason('');
    setOutOfRangeComment('');
    setDupLocationModal({ visible: false, otherLoanId: '' });
    setDupLocationReason('');
    setDupLocationComment('');
  };

  const submitCompleteVisit = async (extra = {}) => {
    setVisitSaving(true);
    try {
      const fd = buildCompleteVisitFormData({
        form,
        localLocation: { ...localLocation, address: localLocation.address || localLocation.current_address },
        customerName: resolvedRecord?.customer_name || form.customer_name,
        customerAddress: resolvedRecord?.address,
        photos,
        upiScreenshot,
        chequePhoto,
        audioNote,
        visitStartTime: form.visit_reason === 'HOME_VISIT' ? visitStartTimeRef.current : null,
        extra,
      });
      const res = await api.completeVisit(collectionId, fd);
      await registerExternalPunchIn(res.data, localLocation);
      resetPunchForm();
      resetForm();
      Alert.alert('Success', 'Visit recorded successfully!');
    } catch (err) {
      const respData = err?.response?.data;
      if (respData?.error === 'location_out_of_range') {
        setOutOfRangeModal({ visible: true, distanceM: respData.distance_m });
        return;
      }
      if (respData?.error === 'same_location_duplicate') {
        setDupLocationModal({ visible: true, otherLoanId: respData.other_loan_id });
        return;
      }
      const msg = respData?.error || respData?.detail || respData?.message || err?.message || 'Failed to save visit.';
      Alert.alert('Error', msg);
    } finally {
      setVisitSaving(false);
    }
  };

  const submitPunch = async (extra = {}) => {
    if (collectionId) {
      await submitCompleteVisit(extra);
      return;
    }

    const locationData = {
      ...localLocation,
      current_address: localLocation.current_address,
    };

    const result = await punchIn({ ...form, ...extra }, locationData);

    if (result.success) {
      // Auto-close the dialog once the punch is recorded, instead of leaving
      // it open for another entry.
      resetPunchForm();
      resetForm();
      Alert.alert('Success', 'Punch recorded!');
      return;
    }

    if (result.locationOutOfRange) {
      setOutOfRangeModal({ visible: true, distanceM: result.distanceM });
      return;
    }
    if (result.sameLocationDuplicate) {
      setDupLocationModal({ visible: true, otherLoanId: result.otherLoanId });
      return;
    }
    // Any other failure already surfaces via the error Banner (errorMessage
    // state set in PunchContext) — nothing else to do here.
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!localLocation) {
      Alert.alert('Error', 'Location not captured');
      return;
    }
    await submitPunch();
  };

  const handleConfirmOutOfRange = async () => {
    if (!outOfRangeReason) {
      Alert.alert('Required', 'Please select a reason.');
      return;
    }
    if (outOfRangeReason === 'OTHER' && !outOfRangeComment.trim()) {
      Alert.alert('Required', 'Please add a comment for "Other".');
      return;
    }
    setOutOfRangeModal({ visible: false, distanceM: 0 });
    await submitPunch({ out_of_range_reason: outOfRangeReason, out_of_range_comment: outOfRangeComment });
  };

  const handleConfirmDupLocation = async () => {
    if (!dupLocationReason) {
      Alert.alert('Required', 'Please select a reason.');
      return;
    }
    if (dupLocationReason === 'OTHER' && !dupLocationComment.trim()) {
      Alert.alert('Required', 'Please add a comment for "Other".');
      return;
    }
    setDupLocationModal({ visible: false, otherLoanId: '' });
    await submitPunch({ duplicate_location_reason: dupLocationReason, duplicate_location_comment: dupLocationComment });
  };

  const closeModal = () => {
    setModalVisible(false);
    setLocalLocation(null);
    setReasonDropdownOpen(false);
    setOutOfRangeModal({ visible: false, distanceM: 0 });
    setOutOfRangeReason('');
    setOutOfRangeComment('');
    setDupLocationModal({ visible: false, otherLoanId: '' });
    setDupLocationReason('');
    setDupLocationComment('');
    setForm(blankForm);
    setAudioNote(null);
    setPhotos([]);
    setUpiScreenshot(null);
    setChequePhoto(null);
    setCollectionId(null);
    setResolvedRecord(null);
    setLoanLookupError('');
    resetForm();
  };

  const updateForm = (key, value) => {
    if (key === 'reason' && value !== form.reason) {
      setAudioNote(null);
      setPhotos([]);
      setUpiScreenshot(null);
      setChequePhoto(null);
      setCollectionId(null);
      setResolvedRecord(null);
      setLoanLookupError('');
    }
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'reason' && value !== prev.reason) {
        updated.loan_id = '';
        updated.amount = '';
        updated.payment_mode = '';
        updated.upi_ref = '';
        updated.cheque_no = '';
        updated.status = '';
        updated.collected_amount = '';
        updated.remarks = '';
        updated.promise_date = null;
        updated.visit_reason = '';
        updated.visit_dpd_bucket = '';
        updated.visit_purpose = '';
        updated.visit_outcome = '';
        updated.customer_available = null;
        updated.customer_met = null;
        updated.family_member_met = null;
        updated.follow_up_required = null;
        if (value === 'Visit') visitStartTimeRef.current = new Date();
      }
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
      if (key === 'status') {
        if (value === 'COLLECTED') {
          const emi = resolvedRecord?.amount_due;
          updated.collected_amount = emi != null ? String(emi) : updated.collected_amount;
        }
        if (value !== 'COLLECTED' && value !== 'PARTIALLY_COLLECTED') {
          updated.collected_amount = '';
          updated.payment_mode = '';
          updated.upi_ref = '';
          updated.cheque_no = '';
        }
        updated.promise_date = null;
      }
      if (key === 'visit_reason') {
        if (value !== 'OD_VISIT') updated.visit_dpd_bucket = '';
        if (value !== 'HOME_VISIT') {
          updated.visit_purpose = '';
          updated.visit_outcome = '';
          updated.customer_available = null;
          updated.customer_met = null;
          updated.family_member_met = null;
          updated.follow_up_required = null;
          updated.promise_date = null;
        }
      }
      if (key === 'follow_up_required' && value !== true) {
        updated.promise_date = null;
      }
      if (key === 'travel_with') {
        updated.co_employee_id = '';
        updated.co_employee_name = '';
        updated.co_employee_phone = '';
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

  const renderYesNo = (label, fieldKey, optional = false) => (
    <>
      <Text style={styles.label}>{label}{optional ? '' : ' *'}</Text>
      <View style={styles.chips}>
        {YES_NO_OPTIONS.map((o) => (
          <TouchableOpacity
            key={String(o.value)}
            style={[styles.chip, form[fieldKey] === o.value && styles.chipActive]}
            onPress={() => updateForm(fieldKey, o.value)}
          >
            <Text style={[styles.chipText, form[fieldKey] === o.value && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // Anchors to the resolved record's due date, exactly like
  // CollectionVisitScreen — falls back to today when no record/due_date is
  // known yet (e.g. before a Loan ID resolves).
  const plannedDate = resolvedRecord?.due_date ? new Date(resolvedRecord.due_date) : new Date();
  plannedDate.setHours(0, 0, 0, 0);
  const maxPromiseDate = new Date(plannedDate);
  maxPromiseDate.setMonth(maxPromiseDate.getMonth() + 1);

  const promiseDateLabel = form.status === 'PARTIALLY_COLLECTED' ? 'Remaining Payment Date *'
    : form.status === 'NOT_PAID' ? 'Next Follow-up Date *'
    : form.visit_reason === 'HOME_VISIT' ? 'Next Follow-up Date *'
    : 'Promise to Pay Date *';

  const renderPromiseDatePicker = () => (
    <>
      <Text style={styles.label}>{promiseDateLabel}</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowPromiseDatePicker(true)}>
        <Text style={{ color: form.promise_date ? colors.text : colors.textMuted }}>
          {form.promise_date ? fmtDate(form.promise_date) : 'Select date (required)'}
        </Text>
      </TouchableOpacity>
      {showPromiseDatePicker && (
        <DateTimePicker
          value={form.promise_date || plannedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={plannedDate}
          maximumDate={maxPromiseDate}
          onChange={(event, selectedDate) => {
            setShowPromiseDatePicker(Platform.OS === 'ios');
            if (selectedDate) updateForm('promise_date', selectedDate);
          }}
        />
      )}
    </>
  );

  // Payment Mode + its Collected/Partial sub-fields — shared shape with
  // CollectionVisitScreen's own renderPaymentModeSection, minus the photo
  // evidence pickers (this screen has no camera-capture UI wired up at all,
  // matching its existing scope — not introduced by this change).
  const renderPhotoColumns = (kinds) => (
    <View style={styles.photoColumns}>
      {kinds.map((k) => (
        <View key={k.value} style={styles.photoColumn}>
          <Text style={styles.photoKindLabel} numberOfLines={1}>{k.label}</Text>
          <TouchableOpacity style={styles.photoAddBtn} onPress={() => addPhoto(k.value)}>
            <Icon name="camera" size={18} color={colors.primary} />
          </TouchableOpacity>
          {photos.map((p, i) => p.kind === k.value && (
            <View key={i} style={styles.photoThumbWrap}>
              <Image source={{ uri: p.uri }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                <Icon name="x" size={12} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.photoTimestamp} numberOfLines={1}>{fmtDateTime(p.capturedAt)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  const renderSingleImagePicker = (label, image, setter) => (
    <>
      <Text style={styles.label}>{label} *</Text>
      <View style={styles.photoColumns}>
        <View style={styles.photoColumn}>
          <TouchableOpacity style={styles.photoAddBtn} onPress={() => addSingleImage(label, setter)}>
            <Icon name="camera" size={18} color={colors.primary} />
          </TouchableOpacity>
          {image && (
            <View style={styles.photoThumbWrap}>
              <Image source={{ uri: image.uri }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => setter(null)}>
                <Icon name="x" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </>
  );

  const renderPaymentModeSection = () => (
    <>
      <Text style={styles.label}>Payment Mode</Text>
      <View style={styles.chips}>
        {PAYMENT_MODES.map((m) => (
          <TouchableOpacity key={m.value} style={[styles.chip, form.payment_mode === m.value && styles.chipActive]} onPress={() => updateForm('payment_mode', m.value)}>
            <Text style={[styles.chipText, form.payment_mode === m.value && styles.chipTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {form.payment_mode === 'CASH' && (
        <>
          <Text style={styles.photoHint}>Add at least one photo — the other two are optional.</Text>
          {renderPhotoColumns(PHOTO_KINDS)}
        </>
      )}
      {form.payment_mode === 'UPI' && (
        <>
          <TextInput style={styles.input} value={form.upi_ref} onChangeText={(t) => updateForm('upi_ref', t)} placeholder="UPI Reference Number" placeholderTextColor={colors.textMuted} />
          {renderSingleImagePicker('Screenshot', upiScreenshot, setUpiScreenshot)}
        </>
      )}
      {form.payment_mode === 'CHEQUE' && (
        <>
          <TextInput style={styles.input} value={form.cheque_no} onChangeText={(t) => updateForm('cheque_no', t)} placeholder="Cheque Number" placeholderTextColor={colors.textMuted} />
          {renderSingleImagePicker('Cheque Photo', chequePhoto, setChequePhoto)}
        </>
      )}
    </>
  );

  const renderLoanResolution = () => (
    <>
      <Text style={styles.label}>Loan ID *</Text>
      <TextInput
        style={styles.input}
        value={form.loan_id}
        onChangeText={(t) => {
          const v = t.slice(0, 10);
          setForm((prev) => ({ ...prev, loan_id: v }));
          setCollectionId(null);
          setResolvedRecord(null);
          setLoanLookupError('');
          fetchLoanSuggestions(v);
        }}
        onBlur={resolveLoanIdOnBlur}
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
      {loanResolving && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.xs }} />}
      {!!loanLookupError && <Text style={styles.loanErrorText}>{loanLookupError}</Text>}
      {collectionId && resolvedRecord && (
        <View style={styles.resolvedCard}>
          <Icon name="check-circle" size={16} color={colors.success} />
          <View style={{ flex: 1, marginLeft: spacing.xs }}>
            <Text style={styles.resolvedName}>{resolvedRecord.customer_name}</Text>
            {resolvedRecord.amount_due != null && (
              <Text style={styles.resolvedMeta}>Amount Due: ₹{Number(resolvedRecord.amount_due).toLocaleString('en-IN')}</Text>
            )}
          </View>
        </View>
      )}
    </>
  );

  const isFetching = punchState === STATES.FETCHING_LOCATION;
  const isSubmitting = punchState === STATES.SUBMITTING || visitSaving;
  const isPunchingOut = punchState === STATES.PUNCHING_OUT;
  const totalDistance = getTotalDistance();
  const duration = getTrackingDuration();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {errorMessage && <Banner message={errorMessage} type="error" onDismiss={dismissError} />}
      {success && <Banner message={isActive ? 'Punch recorded!' : 'Punch Out completed!'} type="success" onDismiss={() => { }} />}
      {!isActive && (
        <AutoClosureBanner pendingAutoClosure={pendingAutoClosure} onSubmit={submitForgotPunchRequest} />
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isActive ? 'Tracking' : 'Punch'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.forgotPunchBtn}
            onPress={() => navigation.navigate('PunchCorrection')}
            accessibilityLabel="Forgot to punch? Request a correction"
          >
            <Icon name="edit-3" size={18} color={colors.primary} />
          </TouchableOpacity>
          {isActive && (
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
          )}
        </View>
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
                  onChangeText={(t) => {
                    updateForm('reason', t);
                    // The dropdown only ever lists fixed presets (no filtering
                    // as you type) — once the typed text no longer matches one
                    // exactly, those suggestions are irrelevant, so close it
                    // automatically instead of leaving it open over a custom,
                    // free-typed reason.
                    if (reasonDropdownOpen && !REASON_PRESETS.some((r) => r.value === t)) {
                      setReasonDropdownOpen(false);
                    }
                  }}
                  placeholder="Type or select a reason..."
                  placeholderTextColor={colors.textMuted}
                  onFocus={() => setReasonDropdownOpen(true)}
                  onBlur={() => {
                    // Slight delay so a tap on a dropdown option still
                    // registers its onPress before the list unmounts — closing
                    // synchronously on blur can race ahead of the touch and
                    // swallow the tap on some Android devices.
                    setTimeout(() => setReasonDropdownOpen(false), 150);
                  }}
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

              {/* Old Visit Type axis — Disbursement's plain Loan ID + Amount
                  flow only now; Collection/Visit reasons drive their own flow
                  below and hide this redundant second selector entirely. */}
              {!isLoanLinkedReason && (
                <>
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
                </>
              )}

              {/* Collection — real loan resolution, then the same Collection
                  Status flow as CollectionVisitScreen. */}
              {form.reason === 'Collection' && (
                <>
                  {renderLoanResolution()}

                  {collectionId && (
                    <>
                      <Text style={styles.label}>Collection Status</Text>
                      <View style={styles.chips}>
                        {STATUS_OPTIONS.map((o) => {
                          const active = form.status === o.value;
                          return (
                            <TouchableOpacity key={o.value} style={[styles.statusChip, active && { backgroundColor: o.color, borderColor: o.color }]} onPress={() => updateForm('status', o.value)}>
                              <Text style={[styles.statusChipText, active && { color: '#fff' }]}>{o.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {form.status === 'PENDING' && renderPromiseDatePicker()}

                      {(form.status === 'COLLECTED' || form.status === 'PARTIALLY_COLLECTED') && (
                        <>
                          <Text style={styles.label}>Collected Amount (₹)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={form.collected_amount}
                            onChangeText={(v) => updateForm('collected_amount', v.replace(/[^0-9.]/g, ''))}
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                          />
                          {renderPaymentModeSection()}
                        </>
                      )}

                      {form.status === 'PARTIALLY_COLLECTED' && renderPromiseDatePicker()}

                      {!!form.status && (
                        <>
                          <Text style={styles.label}>{form.status === 'NOT_PAID' ? 'Reason Why Not Paid *' : 'Remarks'}</Text>
                          <TextInput
                            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                            multiline
                            value={form.remarks}
                            onChangeText={(v) => updateForm('remarks', v)}
                            placeholder={form.status === 'NOT_PAID' ? 'Why did the customer not pay? (required)' : 'Optional notes'}
                            placeholderTextColor={colors.textMuted}
                          />
                        </>
                      )}

                      {form.status === 'NOT_PAID' && renderPromiseDatePicker()}

                      {!!form.status && (
                        <>
                          <Text style={styles.label}>Voice Note</Text>
                          <VoiceNoteRecorder value={audioNote} onChange={setAudioNote} required={isAudioRequiredFor(form)} />
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Visit — real loan resolution, then the same Home Visit / OD
                  Visit / Other flow as CollectionVisitScreen. */}
              {form.reason === 'Visit' && (
                <>
                  {renderLoanResolution()}

                  {collectionId && (
                    <>
                      <Text style={styles.label}>Visit Type</Text>
                      <View style={styles.chips}>
                        {VISIT_TYPE_OPTIONS.map((o) => (
                          <TouchableOpacity key={o.value} style={[styles.chip, form.visit_reason === o.value && styles.chipActive]} onPress={() => updateForm('visit_reason', o.value)}>
                            <Text style={[styles.chipText, form.visit_reason === o.value && styles.chipTextActive]}>{o.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {form.visit_reason === 'OD_VISIT' && (
                        <>
                          <Text style={styles.label}>DPD Bucket</Text>
                          <View style={styles.chips}>
                            {DPD_BUCKET_OPTIONS.map((o) => (
                              <TouchableOpacity key={o.value} style={[styles.chip, form.visit_dpd_bucket === o.value && styles.chipActive]} onPress={() => updateForm('visit_dpd_bucket', o.value)}>
                                <Text style={[styles.chipText, form.visit_dpd_bucket === o.value && styles.chipTextActive]}>{o.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      {form.visit_reason === 'HOME_VISIT' && (
                        <>
                          <Text style={styles.label}>Visit Purpose *</Text>
                          <TextInput style={styles.input} value={form.visit_purpose} onChangeText={(t) => updateForm('visit_purpose', t)} placeholder="Purpose of this visit" placeholderTextColor={colors.textMuted} />

                          <Text style={styles.label}>Visit Outcome *</Text>
                          <TextInput style={styles.input} value={form.visit_outcome} onChangeText={(t) => updateForm('visit_outcome', t)} placeholder="Outcome of this visit" placeholderTextColor={colors.textMuted} />

                          {renderYesNo('Customer Available', 'customer_available')}
                          {renderYesNo('Customer Met', 'customer_met')}
                          {renderYesNo('Family Member Met', 'family_member_met', true)}
                        </>
                      )}

                      {(form.visit_reason === 'OD_VISIT' || form.visit_reason === 'HOME_VISIT' || form.visit_reason === 'OTHER') && (
                        <>
                          <Text style={styles.label}>{form.visit_reason === 'HOME_VISIT' ? 'Remarks *' : 'Remarks'}</Text>
                          <TextInput
                            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                            multiline
                            value={form.remarks}
                            onChangeText={(v) => updateForm('remarks', v)}
                            placeholder="Optional notes"
                            placeholderTextColor={colors.textMuted}
                          />
                        </>
                      )}

                      {form.visit_reason === 'HOME_VISIT' && (
                        <>
                          {renderYesNo('Follow-up Required', 'follow_up_required')}
                          {form.follow_up_required === true && renderPromiseDatePicker()}

                          <Text style={styles.label}>Voice Note *</Text>
                          <VoiceNoteRecorder value={audioNote} onChange={setAudioNote} required />
                        </>
                      )}
                    </>
                  )}
                </>
              )}

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
                  <Text style={styles.label}>Employee Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={form.co_employee_phone}
                    onChangeText={(t) => updateForm('co_employee_phone', t.replace(/[^0-9]/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
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

      {/* Out-of-range geofence confirmation — shown when the punch is more
          than 200m from the customer's stored location. */}
      <Modal visible={outOfRangeModal.visible} transparent animationType="fade" onRequestClose={() => setOutOfRangeModal({ visible: false, distanceM: 0 })}>
        <View style={styles.oorOverlay}>
          <View style={styles.oorCard}>
            <View style={styles.oorHeader}>
              <Icon name="alert-triangle" size={22} color={colors.warning} />
              <Text style={styles.oorTitle}>Location Out of Range</Text>
            </View>
            <Text style={styles.oorMessage}>
              Your location is out of range by {Math.round(outOfRangeModal.distanceM || 0)}m from the customer location.
              You can still punch by selecting a reason below — it will be sent for supervisor review.
            </Text>

            <Text style={styles.label}>Reason *</Text>
            {[
              { value: 'FORGOT', label: 'Forgot to punch at customer location' },
              { value: 'WRONG_LOCATION', label: 'At customer location — existing customer location is wrong' },
              { value: 'OTHER', label: 'Others' },
            ].map((r) => (
              <TouchableOpacity
                key={r.value}
                style={styles.oorReasonRow}
                onPress={() => setOutOfRangeReason(r.value)}
                activeOpacity={0.7}
              >
                <View style={[styles.oorRadio, outOfRangeReason === r.value && styles.oorRadioActive]}>
                  {outOfRangeReason === r.value && <View style={styles.oorRadioDot} />}
                </View>
                <Text style={styles.oorReasonText}>{r.label}</Text>
              </TouchableOpacity>
            ))}

            {outOfRangeReason === 'OTHER' && (
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top', marginTop: spacing.xs }]}
                value={outOfRangeComment}
                onChangeText={setOutOfRangeComment}
                placeholder="Please describe the reason..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            )}

            <View style={[styles.modalFooter, { paddingHorizontal: 0 }]}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setOutOfRangeModal({ visible: false, distanceM: 0 })}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.disabled]}
                onPress={handleConfirmOutOfRange}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Confirm & Punch</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Same-location confirmation — shown when this punch lands within
          ~20m of another customer already punched today. */}
      <Modal visible={dupLocationModal.visible} transparent animationType="fade" onRequestClose={() => setDupLocationModal({ visible: false, otherLoanId: '' })}>
        <View style={styles.oorOverlay}>
          <View style={styles.oorCard}>
            <View style={styles.oorHeader}>
              <Icon name="users" size={22} color={colors.warning} />
              <Text style={styles.oorTitle}>Same Location as Another Customer</Text>
            </View>
            <Text style={styles.oorMessage}>
              Another customer (Loan {dupLocationModal.otherLoanId}) was already punched from this exact
              location today. You can still punch by selecting a reason below — it will be sent for
              supervisor review.
            </Text>

            <Text style={styles.label}>Reason *</Text>
            {[
              { value: 'GROUP_MEETING', label: 'Group / joint meeting — multiple customers at this location' },
              { value: 'SHARED_BUILDING', label: 'Shared building or complex — customer is also here' },
              { value: 'OTHER', label: 'Others' },
            ].map((r) => (
              <TouchableOpacity
                key={r.value}
                style={styles.oorReasonRow}
                onPress={() => setDupLocationReason(r.value)}
                activeOpacity={0.7}
              >
                <View style={[styles.oorRadio, dupLocationReason === r.value && styles.oorRadioActive]}>
                  {dupLocationReason === r.value && <View style={styles.oorRadioDot} />}
                </View>
                <Text style={styles.oorReasonText}>{r.label}</Text>
              </TouchableOpacity>
            ))}

            {dupLocationReason === 'OTHER' && (
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top', marginTop: spacing.xs }]}
                value={dupLocationComment}
                onChangeText={setDupLocationComment}
                placeholder="Please describe the reason..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            )}

            <View style={[styles.modalFooter, { paddingHorizontal: 0 }]}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDupLocationModal({ visible: false, otherLoanId: '' })}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.disabled]}
                onPress={handleConfirmDupLocation}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Confirm & Punch</Text>}
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
  oorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  oorCard: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg },
  oorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  oorTitle: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.text },
  oorMessage: { fontSize: typography.sizes.sm, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  oorReasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  oorRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  oorRadioActive: { borderColor: colors.primary },
  oorRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  oorReasonText: { flex: 1, fontSize: typography.sizes.sm, color: colors.text },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.surface, elevation: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  forgotPunchBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
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
  autoClosureBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningLight || '#FFF3CD',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: 10, gap: 8,
  },
  autoClosureText: { flex: 1, fontSize: typography.sizes.xs, color: colors.text },
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
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background, borderRadius: 20, marginRight: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  statusChipText: { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: '600' },
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
  loanErrorText: { fontSize: typography.sizes.xs, color: colors.danger, marginTop: spacing.xs },
  resolvedCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successLight,
    borderRadius: 12, padding: spacing.sm, marginTop: spacing.sm,
  },
  resolvedName: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.text },
  resolvedMeta: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },

  photoColumns: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  photoColumn: { flex: 1, alignItems: 'center' },
  photoKindLabel: { fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing.xs, textAlign: 'center' },
  photoHint: { fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing.xs },
  photoThumbWrap: { marginTop: spacing.sm, alignItems: 'center' },
  photoThumb: { width: 56, height: 56, borderRadius: 8 },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  photoAddBtn: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoTimestamp: { fontSize: 9, color: colors.textMuted, marginTop: 2, maxWidth: 70, textAlign: 'center' },

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
