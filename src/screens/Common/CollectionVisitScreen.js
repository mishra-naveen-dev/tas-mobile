import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, TextInput, Modal, ActivityIndicator, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import VoiceNoteRecorder from '../../components/VoiceNoteRecorder';
import api from '../../api/api';
import { usePunch } from '../../context/PunchContext';
import { useAuth } from '../../context/AuthContext';
import { captureFieldActivityLocation } from '../../hooks/useFieldActivityLocation';
import GeocodingService from '../../services/GeocodingService';
import { enqueue, isNetworkError, generateTransactionId } from '../../services/OfflineQueue';
import { parseApiError } from '../../core/error/AppErrorHandler';
import { isPhone } from '../../common/helpers/validationHelpers';
import { colors, typography, spacing } from '../../theme/tokens';
import {
  STATUS_OPTIONS, VISIT_TYPE_OPTIONS, DPD_BUCKET_OPTIONS, YES_NO_OPTIONS,
  PAYMENT_MODES, PHOTO_KINDS, HOME_VISIT_PHOTO_KINDS, isAudioRequiredFor,
  buildCompleteVisitFormData, validateCollectionStatus, validateVisitType,
  validateCustomerPhone, getPromiseDateRange,
} from '../../utils/collectionVisitRules';

// ── Reason is now a 3-way bucket. "Collection" and "Visit" are dedicated,
// dynamic workflows (below); "Other" reveals the exact same free-text reason
// picker this screen has always had, for every reason that isn't Collection
// or Visit (eKYC / P2P JLG / Custil Aud / CustJLG Aud / anything typed) — so
// none of that existing functionality is removed, just nested one level. ──
const REASON_BUCKETS = [
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'VISIT', label: 'Visit' },
  { value: 'OTHER', label: 'Other' },
];

const OTHER_REASON_PRESETS = [
  { value: 'eKYC', label: 'eKYC' },
  { value: 'P2P_JLG', label: 'P2P JLG' },
  { value: 'Custil_Aud', label: 'Custil Aud' },
  { value: 'CustJLG_Aud', label: 'CustJLG Aud' },
];

const TRAVEL_WITH = [
  { value: 'ALONE', label: 'Alone' },
  { value: 'WITH_EMPLOYEE', label: 'With Employee' },
];

// Per-reason evidence requirement, independent of Collection Status — only
// meaningful for the two "Other" reasons that already carried this rule.
// Naturally satisfied for free if the Collected+Cash flow already collected
// a Customer photo for the same visit (same underlying `photos` array).
const REASON_MEDIA_REQUIREMENTS = {
  'Custil_Aud': { photoKind: 'CUSTOMER', minPhotos: 1 },
  'CustJLG_Aud': { photoKind: 'CUSTOMER', minPhotos: 1 },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const COLLECTION_STATUS_VALUES = ['PENDING', 'COLLECTED', 'PARTIALLY_COLLECTED', 'NOT_PAID'];

const CollectionVisitScreen = ({ navigation, route }) => {
  const { collectionId, loanId, customerName, customerAddress, amountDue, initialStatus } = route.params || {};
  const { registerExternalPunchIn } = usePunch();
  const { user } = useAuth();

  const [record, setRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(true);

  const [localLocation, setLocalLocation] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(true);

  const [saving, setSaving] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [showPromiseDatePicker, setShowPromiseDatePicker] = useState(false);

  // Visit Start Time — auto-captured the moment this screen is opened, used
  // only for the Home Visit rich form's auto GPS/start/end/duration capture.
  const visitStartTimeRef = useRef(new Date());

  const prefillCollection = COLLECTION_STATUS_VALUES.includes(initialStatus);

  const [form, setForm] = useState({
    reasonBucket: prefillCollection ? 'COLLECTION' : '',
    reason: prefillCollection ? 'Collection' : '',
    payment_mode: '',
    upi_ref: '',
    travel_with: 'ALONE',
    co_employee_id: '',
    co_employee_name: '',
    co_employee_phone: '',
    vehicle_number: '',
    status: prefillCollection ? initialStatus : '',
    collected_amount: '',
    remarks: '',
    promise_date: null,
    phone_correct: null,
    corrected_customer_phone: '',
    visit_reason: '',
    visit_dpd_bucket: '',
    // Home Visit rich fields
    visit_purpose: '',
    visit_outcome: '',
    customer_available: null,
    customer_met: null,
    family_member_met: null,
    follow_up_required: null,
  });

  const [photos, setPhotos] = useState([]); // [{ uri, fileName, type, kind }]
  const [upiScreenshot, setUpiScreenshot] = useState(null); // { uri, fileName, type }
  const [audioNote, setAudioNote] = useState(null); // { uri, fileName, mimeType, durationSeconds }

  const [outOfRangeModal, setOutOfRangeModal] = useState({ visible: false, distanceM: 0 });
  const [outOfRangeReason, setOutOfRangeReason] = useState('');
  const [outOfRangeComment, setOutOfRangeComment] = useState('');

  const [dupLocationModal, setDupLocationModal] = useState({ visible: false, otherLoanId: '' });
  const [dupLocationReason, setDupLocationReason] = useState('');
  const [dupLocationComment, setDupLocationComment] = useState('');

  // Synchronous double-tap guard — `saving` (React state) can lag a fast
  // second tap by a frame or two; this ref can't.
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getCollectionRecord(collectionId);
        if (!cancelled) {
          setRecord(res.data);
          // No phone on file at all — nothing to "confirm," go straight to
          // asking for one (same corrected_customer_phone validation path).
          if (!res.data.customer_phone) {
            setForm((prev) => ({ ...prev, phone_correct: false }));
          }
        }
      } catch (e) {
        if (!cancelled) Alert.alert('Error', 'Could not load customer details.');
      } finally {
        if (!cancelled) setLoadingRecord(false);
      }
    })();
    return () => { cancelled = true; };
  }, [collectionId]);

  const fetchLocation = useCallback(async () => {
    setFetchingLocation(true);
    try {
      const loc = await captureFieldActivityLocation();
      if (loc.error) {
        Alert.alert('Location Needed', loc.error, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: fetchLocation },
        ]);
        return;
      }

      // Reverse-geocode into a human-readable current address — the same
      // "save the address the employee is actually standing at" behaviour
      // punch already has (see PunchContext.fetchLocation).
      let address = loc.address || '';
      try {
        const geo = await Promise.race([
          GeocodingService.reverseGeocode(loc.latitude, loc.longitude),
          new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        address = geo?.fullAddress || geo?.shortAddress || address;
      } catch (e) {
        // Best-effort — raw coordinates are still a valid fallback below.
      }
      if (!address) {
        address = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
      }

      setLocalLocation({ ...loc, address });
    } finally {
      setFetchingLocation(false);
    }
  }, []);

  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  const updateForm = (key, value) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'travel_with') {
        updated.co_employee_id = '';
        updated.co_employee_name = '';
        updated.co_employee_phone = '';
        updated.vehicle_number = '';
      }
      if (key === 'status') {
        if (value === 'COLLECTED') {
          const emi = record?.amount_due ?? amountDue;
          updated.collected_amount = emi != null ? String(emi) : updated.collected_amount;
        }
        if (value !== 'COLLECTED' && value !== 'PARTIALLY_COLLECTED') {
          updated.collected_amount = '';
          updated.payment_mode = '';
          updated.upi_ref = '';
        }
        updated.promise_date = null;
      }
      if (key === 'payment_mode') {
        updated.upi_ref = '';
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
      return updated;
    });
  };

  const selectReasonBucket = (bucket) => {
    setForm((prev) => ({
      ...prev,
      reasonBucket: bucket,
      reason: bucket === 'COLLECTION' ? 'Collection' : bucket === 'VISIT' ? 'Visit' : '',
      status: bucket === 'VISIT' ? 'VISITED' : '',
      payment_mode: '',
      upi_ref: '',
      collected_amount: '',
      promise_date: null,
      visit_reason: '',
      visit_dpd_bucket: '',
      visit_purpose: '',
      visit_outcome: '',
      customer_available: null,
      customer_met: null,
      family_member_met: null,
      follow_up_required: null,
      remarks: '',
    }));
    setPhotos([]);
    setUpiScreenshot(null);
    setAudioNote(null);
    if (bucket === 'VISIT') visitStartTimeRef.current = new Date();
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

  // Single-image picker for the UPI screenshot — same camera-or-gallery
  // flow as addPhoto/pickPhoto, but holding exactly one image rather than
  // an accumulating array.
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

  const validate = () => {
    const phoneErr = validateCustomerPhone(form);
    if (phoneErr) {
      Alert.alert('Customer Phone', phoneErr);
      return false;
    }
    if (form.phone_correct === false && user?.phone
        && form.corrected_customer_phone.replace(/\D/g, '') === String(user.phone).replace(/\D/g, '')) {
      Alert.alert('Invalid Number', "You can't enter your own phone number as the customer's number.");
      return false;
    }

    if (!form.reasonBucket) {
      Alert.alert('Reason Required', 'Please select a reason.');
      return false;
    }
    if (form.reasonBucket === 'OTHER' && !form.reason.trim()) {
      Alert.alert('Reason Required', 'Please select or type a reason.');
      return false;
    }

    if (form.reasonBucket === 'COLLECTION' || form.reasonBucket === 'OTHER') {
      const err = validateCollectionStatus(form, { photos, upiScreenshot, audioNote });
      if (err) {
        Alert.alert('Required', err);
        return false;
      }

      // Per-reason evidence requirement (Custil Aud / CustJLG Aud) — already
      // satisfied for free if the Collected+Cash flow above collected a
      // Customer photo for this same visit. Not part of the shared
      // validator: specific to this screen's free-text "Other" reasons,
      // which EmployeePunchScreen doesn't route through this flow at all.
      const req = REASON_MEDIA_REQUIREMENTS[form.reason];
      if (req) {
        const count = photos.filter((p) => p.kind === req.photoKind).length;
        if (count < req.minPhotos) {
          Alert.alert('Photo Required', `Please add a Customer photo for "${form.reason}".`);
          return false;
        }
      }

      if (isAudioRequiredFor(form) && !audioNote) {
        Alert.alert('Voice Note Required', `Please record a voice note for "${STATUS_OPTIONS.find((s) => s.value === form.status)?.label || form.status}".`);
        return false;
      }
    }

    if (form.reasonBucket === 'VISIT') {
      const err = validateVisitType(form, { audioNote });
      if (err) {
        Alert.alert('Required', err);
        return false;
      }
    }

    if (form.travel_with === 'WITH_EMPLOYEE') {
      if (!form.co_employee_phone || !isPhone(form.co_employee_phone)) {
        Alert.alert('Invalid', 'Enter a valid 10-digit companion phone number.');
        return false;
      }
    }
    if (!localLocation) {
      Alert.alert('Location Needed', 'Waiting for GPS — please try again in a moment.');
      return false;
    }

    return true;
  };

  const buildFormData = (extra = {}, clientTransactionId) => buildCompleteVisitFormData({
    form,
    localLocation,
    customerName: record?.customer_name || customerName,
    customerAddress: record?.address || customerAddress,
    photos,
    upiScreenshot,
    audioNote,
    visitStartTime: form.visit_reason === 'HOME_VISIT' ? visitStartTimeRef.current : null,
    extra,
    clientTransactionId,
  });

  const submitVisit = async (extra = {}) => {
    // Belt-and-braces against a double "Update & Save" tap creating two
    // CollectionUpdate rows for the same visit — `saving` alone can lag a
    // fast second tap by a render or two.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    // Generated once per real submission and reused unchanged for both the
    // live attempt below and the offline-queued retry, if it falls through
    // to that — see CollectionUpdate.client_transaction_id server-side.
    const clientTransactionId = generateTransactionId();
    try {
      const fd = buildFormData(extra, clientTransactionId);
      const res = await api.completeVisit(collectionId, fd);
      await registerExternalPunchIn(res.data, localLocation);
      const savedLoanId = record?.loan_id || loanId;
      Alert.alert(
        'Success',
        `Visit recorded successfully.\n\n${fmtDateTime(new Date())}`
          + (savedLoanId ? `\nLoan ID: ${savedLoanId}` : ''),
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueue('COLLECTION_VISIT', {
          collectionId,
          loanId: record?.loan_id || loanId,
          form: { ...form, promise_date: form.promise_date ? form.promise_date.toISOString() : null },
          localLocation,
          customerName: record?.customer_name || customerName,
          customerAddress: record?.address || customerAddress,
          photos,
          upiScreenshot,
          audioNote,
          visitStartTime: form.visit_reason === 'HOME_VISIT' ? visitStartTimeRef.current.toISOString() : null,
          extra,
          clientTransactionId,
        });
        const queuedLoanId = record?.loan_id || loanId;
        Alert.alert(
          'Saved — will sync automatically',
          "No internet connection right now. Your visit has been saved on this device and will upload automatically once you're back online."
            + `\n\n${fmtDateTime(new Date())}`
            + (queuedLoanId ? `\nLoan ID: ${queuedLoanId}` : ''),
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }
      const respData = err?.response?.data;
      if (respData?.error === 'location_out_of_range') {
        setOutOfRangeModal({ visible: true, distanceM: respData.distance_m });
        return;
      }
      if (respData?.error === 'same_location_duplicate') {
        setDupLocationModal({ visible: true, otherLoanId: respData.other_loan_id });
        return;
      }
      console.error('[CollectionVisit] Save failed:', err?.response?.status, respData || err?.message);
      const parsed = parseApiError(err);
      const msg = parsed.reference ? `${parsed.message}\n\nRef: ${parsed.reference}` : parsed.message;
      Alert.alert('Error', msg);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    await submitVisit();
  };

  // Out-of-range and same-location-duplicate are independent backend checks
  // — a single submission can hit both. Each confirm handler here must
  // carry forward whatever reason the *other* dialog already collected in
  // this session, not just its own — otherwise resolving one exception
  // silently drops the other's already-confirmed reason on resubmit, the
  // backend re-flags the dropped one, and the two dialogs bounce back and
  // forth forever without ever actually saving.
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
    const extra = { out_of_range_reason: outOfRangeReason, out_of_range_comment: outOfRangeComment };
    if (dupLocationReason) {
      extra.duplicate_location_reason = dupLocationReason;
      extra.duplicate_location_comment = dupLocationComment;
    }
    await submitVisit(extra);
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
    const extra = { duplicate_location_reason: dupLocationReason, duplicate_location_comment: dupLocationComment };
    if (outOfRangeReason) {
      extra.out_of_range_reason = outOfRangeReason;
      extra.out_of_range_comment = outOfRangeComment;
    }
    await submitVisit(extra);
  };

  // Anchored on the current Collection Date (today, when this visit is
  // actually being recorded) — never on record.due_date/Demand Date, which
  // is only the original overdue reference date and must not bound how far
  // out a fresh PTP/follow-up/remaining-payment date can be set.
  const { min: plannedDate, max: maxPromiseDate } = getPromiseDateRange();

  const promiseDateLabel = form.status === 'PARTIALLY_COLLECTED' ? 'Remaining Payment Date *'
    : form.status === 'NOT_PAID' ? 'Next Follow-up Date *'
    : form.visit_reason === 'HOME_VISIT' ? 'Next Follow-up Date *'
    : 'Promise to Pay Date *';

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

  // Payment Mode + its dynamic Collected/Partial sub-fields — shared by the
  // Collection and Other buckets (both route through the same 4-option
  // Collection Status above).
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
    </>
  );

  const showCollectionStatusFlow = form.reasonBucket === 'COLLECTION' || form.reasonBucket === 'OTHER';
  const extraReasonPhotoReq = REASON_MEDIA_REQUIREMENTS[form.reason];
  // Hidden when the Collected+Cash flow already provides the exact same
  // Customer photo requirement, to avoid showing two identical pickers.
  const showExtraReasonPhoto = extraReasonPhotoReq
    && !((form.status === 'COLLECTED' || form.status === 'PARTIALLY_COLLECTED') && form.payment_mode === 'CASH');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Collection Visit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Section 1: Header / customer info */}
        <View style={styles.customerCard}>
          {loadingRecord ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={styles.customerName}>{record?.customer_name || customerName}</Text>
              <Text style={styles.customerMeta}>Loan ID: {record?.loan_id || loanId}</Text>
              {!!(record?.address || customerAddress) && (
                <Text style={styles.customerMeta} numberOfLines={2}>{record?.address || customerAddress}</Text>
              )}
              {(record?.amount_due ?? amountDue) != null && (
                <Text style={styles.amountDue}>Amount Due: ₹{Number(record?.amount_due ?? amountDue).toLocaleString('en-IN')}</Text>
              )}

              <View style={styles.detailGrid}>
                {!!record?.customer_phone && (
                  <View style={styles.detailItem}>
                    <Icon name="phone" size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>{record.customer_phone}</Text>
                  </View>
                )}
                {record?.dpd_days != null && (
                  <View style={styles.detailItem}>
                    <Icon name="alert-circle" size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>DPD {record.dpd_days}</Text>
                  </View>
                )}
                {!!record?.due_date && (
                  <View style={styles.detailItem}>
                    <Icon name="calendar" size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>Demand: {fmtDate(record.due_date)}</Text>
                  </View>
                )}
                {!!record?.last_collection_date && (
                  <View style={styles.detailItem}>
                    <Icon name="check-square" size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>Last Collected: {fmtDate(record.last_collection_date)}</Text>
                  </View>
                )}
                {!!record?.disbursement_date && (
                  <View style={styles.detailItem}>
                    <Icon name="calendar" size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>Disbursed: {fmtDate(record.disbursement_date)}</Text>
                  </View>
                )}
                {!!record?.father_name && (
                  <View style={styles.detailItem}>
                    <Icon name="user" size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>Father: {record.father_name}</Text>
                  </View>
                )}
                {!!record?.spouse_nominee_name && (
                  <View style={styles.detailItem}>
                    <Icon name="users" size={12} color={colors.textMuted} />
                    <Text style={styles.detailText}>Spouse/Nominee: {record.spouse_nominee_name}</Text>
                  </View>
                )}
              </View>

              {/* Loan-level money figures — each an independent value from the
                  upload (never derived from another, see backend), so kept
                  as its own labelled tile rather than folded into one number. */}
              {(record?.outstanding_amount != null || record?.total_arrear != null || record?.disbursement_amount != null) && (
                <View style={styles.moneyGrid}>
                  {[
                    ['Outstanding Amount', record?.outstanding_amount],
                    ['Total Arrear', record?.total_arrear],
                    ['Disbursement Amount', record?.disbursement_amount],
                  ].filter(([, v]) => v != null).map(([label, value]) => (
                    <View key={label} style={styles.moneyTile}>
                      <Text style={styles.moneyTileLabel}>{label}</Text>
                      <Text style={styles.moneyTileValue} numberOfLines={1}>
                        ₹{Number(value).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* GPS status */}
        <View style={[
          styles.gpsBadge,
          fetchingLocation ? styles.gpsFetching
            : localLocation?.isMock ? styles.gpsMock
            : localLocation?.location_source === 'CACHED' ? styles.gpsMock
            : styles.gpsLocked,
        ]}>
          {fetchingLocation ? (
            <>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.gpsBadgeText, { color: colors.primary }]}>Getting GPS...</Text>
            </>
          ) : localLocation?.isMock ? (
            <>
              <Icon name="smartphone" size={14} color={colors.warning} />
              <Text style={[styles.gpsBadgeText, { color: colors.warning }]}>Dev Mode</Text>
            </>
          ) : localLocation?.location_source === 'CACHED' ? (
            <>
              <Icon name="clock" size={14} color={colors.warning} />
              <Text style={[styles.gpsBadgeText, { color: colors.warning }]}>Using Last Known Location</Text>
            </>
          ) : (
            <>
              <Icon name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.gpsBadgeText, { color: colors.success }]}>GPS Locked</Text>
            </>
          )}
          {!fetchingLocation && (
            <TouchableOpacity onPress={fetchLocation} style={styles.gpsRefresh}>
              <Icon name="refresh-cw" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Current address — reverse-geocoded from the captured GPS, same as punch */}
        {!!localLocation?.address && (
          <View style={styles.addressCard}>
            <Icon name="map-pin" size={14} color={colors.textMuted} />
            <Text style={styles.addressText} numberOfLines={2}>{localLocation.address}</Text>
          </View>
        )}

        {/* Customer phone confirmation — must be answered before submit
            (see validateCustomerPhone). A corrected number can never be the
            employee's own or another TAS user's (enforced server-side too,
            in CompleteVisitSerializer.validate). */}
        {!loadingRecord && (
          <>
            <Text style={styles.label}>Customer Phone</Text>
            {record?.customer_phone ? (
              <>
                <View style={styles.phoneRecordedRow}>
                  <Icon name="phone" size={14} color={colors.textMuted} />
                  <Text style={styles.phoneRecordedText}>{record.customer_phone}</Text>
                </View>
                <View style={styles.chips}>
                  {YES_NO_OPTIONS.map((o) => (
                    <TouchableOpacity
                      key={String(o.value)}
                      style={[styles.chip, form.phone_correct === o.value && styles.chipActive]}
                      onPress={() => updateForm('phone_correct', o.value)}
                    >
                      <Text style={[styles.chipText, form.phone_correct === o.value && styles.chipTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.phoneRecordedText}>No phone number on file for this customer.</Text>
            )}
            {form.phone_correct === false && (
              <TextInput
                style={styles.input}
                value={form.corrected_customer_phone}
                onChangeText={(t) => updateForm('corrected_customer_phone', t.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="Customer's correct 10-digit number"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={10}
              />
            )}
          </>
        )}

        {/* Reason — Collection / Visit / Other */}
        <Text style={styles.label}>Reason</Text>
        <View style={styles.chips}>
          {REASON_BUCKETS.map((b) => (
            <TouchableOpacity key={b.value} style={[styles.chip, form.reasonBucket === b.value && styles.chipActive]} onPress={() => selectReasonBucket(b.value)}>
              <Text style={[styles.chipText, form.reasonBucket === b.value && styles.chipTextActive]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* "Other" bucket — exact existing free-text reason picker */}
        {form.reasonBucket === 'OTHER' && (
          <>
            <View style={styles.reasonWrap}>
              <TextInput
                style={styles.reasonInput}
                value={form.reason}
                onChangeText={(t) => updateForm('reason', t)}
                placeholder="Type or select a reason..."
                placeholderTextColor={colors.textMuted}
                onFocus={() => setReasonOpen(true)}
                onBlur={() => setTimeout(() => setReasonOpen(false), 150)}
              />
              <TouchableOpacity style={styles.reasonToggle} onPress={() => setReasonOpen((o) => !o)}>
                <Icon name={reasonOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.chips}>
              {OTHER_REASON_PRESETS.map((r) => (
                <TouchableOpacity key={r.value} style={[styles.chip, form.reason === r.value && styles.chipActive]} onPress={() => updateForm('reason', form.reason === r.value ? '' : r.value)}>
                  <Text style={[styles.chipText, form.reason === r.value && styles.chipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Collection Status — Collection bucket, and Other bucket (shared) */}
        {showCollectionStatusFlow && (
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

            <Text style={styles.label}>{form.status === 'NOT_PAID' ? 'Reason Why Not Paid *' : 'Remarks'}</Text>
            <TextInput
              style={[styles.input, styles.remarksInput]}
              multiline
              value={form.remarks}
              onChangeText={(v) => updateForm('remarks', v)}
              placeholder={form.status === 'NOT_PAID' ? 'Why did the customer not pay? (required)' : 'Optional notes'}
              placeholderTextColor={colors.textMuted}
            />

            {form.status === 'NOT_PAID' && renderPromiseDatePicker()}

            {showExtraReasonPhoto && (
              <>
                <Text style={styles.label}>Customer Photo *</Text>
                {renderPhotoColumns([{ value: 'CUSTOMER', label: 'Customer' }])}
              </>
            )}

            {!!form.status && (
              <>
                <Text style={styles.label}>Voice Note</Text>
                <VoiceNoteRecorder value={audioNote} onChange={setAudioNote} required={isAudioRequiredFor(form)} />
              </>
            )}
          </>
        )}

        {/* Visit Type — Visit bucket only */}
        {form.reasonBucket === 'VISIT' && (
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
                  style={[styles.input, styles.remarksInput]}
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

                <Text style={styles.label}>Photos (Optional)</Text>
                {renderPhotoColumns(HOME_VISIT_PHOTO_KINDS)}
              </>
            )}
          </>
        )}

        {/* Travel companion — unchanged, appears at the bottom for every reason */}
        {!!form.reasonBucket && (
          <>
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
                <TextInput style={styles.input} value={form.co_employee_id} onChangeText={(t) => updateForm('co_employee_id', t)} placeholder="Employee ID" placeholderTextColor={colors.textMuted} />
                <TextInput style={styles.input} value={form.co_employee_name} onChangeText={(t) => updateForm('co_employee_name', t)} placeholder="Employee Name" placeholderTextColor={colors.textMuted} />
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
          </>
        )}

        {/* GPS notice + Save */}
        <View style={styles.gpsNotice}>
          <Icon name="crosshair" size={13} color={colors.textMuted} />
          <Text style={styles.gpsNoticeText}>Your GPS location will be captured automatically on save</Text>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving || fetchingLocation}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update & Save</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Out-of-range confirmation */}
      <Modal visible={outOfRangeModal.visible} transparent animationType="fade" onRequestClose={() => setOutOfRangeModal({ visible: false, distanceM: 0 })}>
        <View style={styles.oorOverlay}>
          <View style={styles.oorCard}>
            <View style={styles.oorHeader}>
              <Icon name="alert-triangle" size={22} color={colors.warning} />
              <Text style={styles.oorTitle}>Location Out of Range</Text>
            </View>
            <Text style={styles.oorMessage}>
              Your location is out of range by {Math.round(outOfRangeModal.distanceM || 0)}m from the customer location.
              You can still save by selecting a reason below — it will be sent for supervisor review.
            </Text>
            <Text style={styles.label}>Reason *</Text>
            {[
              { value: 'FORGOT', label: 'Forgot to punch at customer location' },
              { value: 'WRONG_LOCATION', label: 'Existing customer location is wrong' },
              {
                value: 'JLG',
                label: form.reasonBucket === 'COLLECTION'
                  ? 'JLG Customer — Group Collection Location'
                  : 'JLG Customer — Group Meeting Location',
              },
              { value: 'OTHER', label: 'Others' },
            ].map((r) => (
              <TouchableOpacity key={r.value} style={styles.oorReasonRow} onPress={() => setOutOfRangeReason(r.value)} activeOpacity={0.7}>
                <View style={[styles.oorRadio, outOfRangeReason === r.value && styles.oorRadioActive]}>
                  {outOfRangeReason === r.value && <View style={styles.oorRadioDot} />}
                </View>
                <Text style={styles.oorReasonText}>{r.label}</Text>
              </TouchableOpacity>
            ))}
            {outOfRangeReason === 'OTHER' && (
              <TextInput style={[styles.input, styles.remarksInput]} value={outOfRangeComment} onChangeText={setOutOfRangeComment} placeholder="Please describe the reason..." placeholderTextColor={colors.textMuted} multiline />
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setOutOfRangeModal({ visible: false, distanceM: 0 })}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, saving && styles.disabled]} onPress={handleConfirmOutOfRange} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Confirm & Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Same-location confirmation */}
      <Modal visible={dupLocationModal.visible} transparent animationType="fade" onRequestClose={() => setDupLocationModal({ visible: false, otherLoanId: '' })}>
        <View style={styles.oorOverlay}>
          <View style={styles.oorCard}>
            <View style={styles.oorHeader}>
              <Icon name="users" size={22} color={colors.warning} />
              <Text style={styles.oorTitle}>Same Location as Another Customer</Text>
            </View>
            <Text style={styles.oorMessage}>
              Another customer (Loan {dupLocationModal.otherLoanId}) was already punched from this exact
              location today. You can still save by selecting a reason below.
            </Text>
            <Text style={styles.label}>Reason *</Text>
            {[
              { value: 'GROUP_MEETING', label: 'Group / joint meeting — multiple customers at this location' },
              { value: 'SHARED_BUILDING', label: 'Shared building or complex — customer is also here' },
              {
                value: 'JLG',
                label: form.reasonBucket === 'COLLECTION'
                  ? 'JLG Customer — Group Collection Location'
                  : 'JLG Customer — Group Meeting Location',
              },
              { value: 'OTHER', label: 'Others' },
            ].map((r) => (
              <TouchableOpacity key={r.value} style={styles.oorReasonRow} onPress={() => setDupLocationReason(r.value)} activeOpacity={0.7}>
                <View style={[styles.oorRadio, dupLocationReason === r.value && styles.oorRadioActive]}>
                  {dupLocationReason === r.value && <View style={styles.oorRadioDot} />}
                </View>
                <Text style={styles.oorReasonText}>{r.label}</Text>
              </TouchableOpacity>
            ))}
            {dupLocationReason === 'OTHER' && (
              <TextInput style={[styles.input, styles.remarksInput]} value={dupLocationComment} onChangeText={setDupLocationComment} placeholder="Please describe the reason..." placeholderTextColor={colors.textMuted} multiline />
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDupLocationModal({ visible: false, otherLoanId: '' })}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, saving && styles.disabled]} onPress={handleConfirmDupLocation} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Confirm & Save</Text>}
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
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 60 },
  customerCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, elevation: 2 },
  customerName: { fontSize: typography.sizes.lg, fontWeight: 'bold', color: colors.text },
  customerMeta: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 },
  amountDue: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary, marginTop: spacing.xs },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: spacing.sm },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  detailText: { fontSize: typography.sizes.xs, color: colors.textMuted },
  moneyGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: spacing.sm },
  moneyTile: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: colors.background, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  moneyTileLabel: { fontSize: 10, color: colors.textMuted },
  moneyTileValue: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.text, marginTop: 1 },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 8 },
  gpsFetching: { backgroundColor: colors.primaryLight },
  gpsMock: { backgroundColor: colors.warningLight },
  gpsLocked: { backgroundColor: colors.successLight },
  gpsBadgeText: { fontSize: typography.sizes.xs, marginLeft: spacing.xs, fontWeight: '600' },
  gpsRefresh: { marginLeft: spacing.sm },
  addressCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.surface, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.sm },
  addressText: { flex: 1, fontSize: typography.sizes.xs, color: colors.textMuted },
  phoneRecordedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  phoneRecordedText: { fontSize: typography.sizes.sm, color: colors.textDark, fontWeight: '600' },
  label: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
  reasonWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  reasonInput: { flex: 1, padding: spacing.md, fontSize: typography.sizes.md, color: colors.text },
  reasonToggle: { padding: spacing.md, borderLeftWidth: 1, borderLeftColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: 20, marginRight: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.sizes.sm, color: colors.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: 20, marginRight: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  statusChipText: { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: '600' },
  input: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, fontSize: typography.sizes.md, color: colors.text, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  remarksInput: { height: 80, textAlignVertical: 'top' },
  photoColumns: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  photoColumn: { flex: 1, alignItems: 'center' },
  photoKindLabel: { fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing.xs, textAlign: 'center' },
  photoHint: { fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing.xs },
  photoThumbWrap: { marginTop: spacing.sm, alignItems: 'center' },
  photoThumb: { width: 56, height: 56, borderRadius: 8 },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  photoAddBtn: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoTimestamp: { fontSize: 9, color: colors.textMuted, marginTop: 2, maxWidth: 70, textAlign: 'center' },
  gpsNotice: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm, gap: 6 },
  gpsNoticeText: { fontSize: typography.sizes.xs, color: colors.textMuted, flex: 1 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  saveBtnText: { fontSize: typography.sizes.md, fontWeight: 'bold', color: '#fff' },
  disabled: { opacity: 0.7 },
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
  modalFooter: { flexDirection: 'row', marginTop: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, marginRight: spacing.sm },
  cancelText: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.textMuted },
  submitBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginLeft: spacing.sm },
  submitText: { fontSize: typography.sizes.md, fontWeight: 'bold', color: '#fff' },
});

export default CollectionVisitScreen;
