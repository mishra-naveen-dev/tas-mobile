import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, TextInput, Modal, ActivityIndicator, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import api from '../../api/api';
import { usePunch } from '../../context/PunchContext';
import { captureFieldActivityLocation } from '../../hooks/useFieldActivityLocation';
import GeocodingService from '../../services/GeocodingService';
import { isPhone } from '../../common/helpers/validationHelpers';
import { colors, typography, spacing } from '../../theme/tokens';

// ── Reused presets/options (kept in sync with EmployeePunchScreen.js /
// CollectionsScreen.js — this screen ports their form logic verbatim rather
// than importing, since neither file exports these as shared constants). ──
const REASON_PRESETS = [
  { value: 'Collection',    label: 'Collection' },
  { value: 'Home Visit',    label: 'Home Visit' },
  { value: 'eKYC',          label: 'eKYC' },
  { value: 'P2P_JLG',       label: 'P2P JLG' },
  { value: 'Custil_Aud',    label: 'Custil Aud' },
  { value: 'CustJLG_Aud',   label: 'CustJLG Aud' },
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

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'P2P', color: colors.textMuted },
  { value: 'VISITED', label: 'Visited', color: colors.info },
  { value: 'COLLECTED', label: 'Collected', color: colors.success },
  { value: 'PARTIALLY_COLLECTED', label: 'Partial', color: colors.warning },
  { value: 'NOT_PAID', label: 'Not Paid', color: colors.danger },
];

const VISIT_REASON_OPTIONS = [
  { value: 'OD_VISIT', label: 'OD Visit' },
  { value: 'OTHER', label: 'Other' },
];

const DPD_BUCKET_OPTIONS = [
  { value: '0-30', label: '0-30' },
  { value: '31-60', label: '31-60' },
  { value: '61-90', label: '61-90' },
  { value: '91+', label: '91+' },
];

const PHOTO_KINDS = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'DOCUMENT', label: 'Document' },
];

// Per-reason evidence requirements — enforced (hard block) in validate()
// before "Update & Save" is allowed to submit. Not every reason has a rule;
// reasons absent here (eKYC, P2P_JLG, free-typed text, ...) have none.
//
// audioRequired is temporarily disabled for every reason (including Home
// Visit) — the in-app conversation recorder (react-native-nitro-sound) hit
// an upstream native-build bug that blocks Android release builds. Re-enable
// 'Home Visit': audioRequired: true once that library (or a replacement) is
// confirmed to build cleanly in release mode again.
const REASON_MEDIA_REQUIREMENTS = {
  'Collection': { photoKind: 'RECEIPT', minPhotos: 1, audioRequired: false },
  'Home Visit': { photoKind: 'CUSTOMER', minPhotos: 1, audioRequired: false },
  'Custil_Aud': { photoKind: 'CUSTOMER', minPhotos: 1, audioRequired: false },
  'CustJLG_Aud': { photoKind: 'CUSTOMER', minPhotos: 1, audioRequired: false },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const CollectionVisitScreen = ({ navigation, route }) => {
  const { collectionId, loanId, customerName, customerAddress, amountDue, initialStatus } = route.params || {};
  const { registerExternalPunchIn } = usePunch();

  const [record, setRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(true);

  const [localLocation, setLocalLocation] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(true);

  const [saving, setSaving] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [showPromiseDatePicker, setShowPromiseDatePicker] = useState(false);

  const [form, setForm] = useState({
    reason: '',
    payment_mode: '',
    upi_ref: '',
    cheque_no: '',
    travel_with: 'ALONE',
    co_employee_id: '',
    co_employee_name: '',
    co_employee_phone: '',
    vehicle_number: '',
    status: initialStatus && initialStatus !== 'PENDING' ? initialStatus : 'VISITED',
    collected_amount: '',
    remarks: '',
    promise_date: null,
    visit_reason: '',
    visit_dpd_bucket: '',
  });

  const [photos, setPhotos] = useState([]); // [{ uri, fileName, type, kind }]

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
        if (!cancelled) setRecord(res.data);
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
      if (key === 'payment_mode') {
        updated.upi_ref = '';
        updated.cheque_no = '';
      }
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
        if (value !== 'COLLECTED' && value !== 'PARTIALLY_COLLECTED') updated.collected_amount = '';
        if (value !== 'PENDING') updated.promise_date = null;
        if (value !== 'VISITED') { updated.visit_reason = ''; updated.visit_dpd_bucket = ''; }
      }
      if (key === 'visit_reason' && value !== 'OD_VISIT') updated.visit_dpd_bucket = '';
      return updated;
    });
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

  const validate = () => {
    if (form.status === 'COLLECTED' && form.payment_mode === '') {
      Alert.alert('Required', 'Payment mode is required for a collected visit.');
      return false;
    }
    if (form.status === 'PENDING' && !form.promise_date) {
      Alert.alert('Promise Date Required', 'Please select the date the customer promised to pay.');
      return false;
    }
    if (form.status === 'NOT_PAID' && !form.remarks.trim()) {
      Alert.alert('Reason Required', 'Please enter the reason the customer did not pay.');
      return false;
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

    const req = REASON_MEDIA_REQUIREMENTS[form.reason];
    if (req) {
      const count = photos.filter((p) => p.kind === req.photoKind).length;
      if (count < req.minPhotos) {
        const kindLabel = PHOTO_KINDS.find((k) => k.value === req.photoKind)?.label || req.photoKind;
        Alert.alert('Photo Required', `Please add a ${kindLabel} photo for "${form.reason}".`);
        return false;
      }
    }
    return true;
  };

  const buildFormData = (extra = {}) => {
    const fd = new FormData();
    const put = (k, v) => { if (v !== undefined && v !== null && v !== '') fd.append(k, String(v)); };

    put('latitude', localLocation.latitude);
    put('longitude', localLocation.longitude);
    put('accuracy', localLocation.accuracy);
    put('altitude', localLocation.altitude);
    put('speed', localLocation.speed);
    put('heading', localLocation.heading);
    put('battery_level', localLocation.battery_level);
    put('is_mock_location', localLocation.is_mock_location ? 'true' : 'false');
    put('mock_detection_method', localLocation.mock_detection_method);
    put('gps_provider', localLocation.gps_provider);
    put('network_status', localLocation.network_status);
    put('device_timestamp', localLocation.device_timestamp);
    put('location_address', localLocation.address);

    put('reason', form.reason);
    put('customer_name', record?.customer_name || customerName);
    put('customer_address', record?.address || customerAddress);
    put('payment_method', form.payment_mode);
    put('upi_ref', form.upi_ref);
    put('cheque_no', form.cheque_no);
    put('travel_type', form.travel_with);
    put('co_employee_id', form.co_employee_id);
    put('companion_name', form.co_employee_name);
    put('companion_phone', form.co_employee_phone);
    put('vehicle_number', form.vehicle_number);

    put('status', form.status);
    put('collected_amount', form.collected_amount);
    put('remarks', form.remarks);
    put('promise_date', form.promise_date ? form.promise_date.toISOString().split('T')[0] : '');
    put('visit_reason', form.status === 'VISITED' ? form.visit_reason : '');
    put('visit_dpd_bucket', form.status === 'VISITED' && form.visit_reason === 'OD_VISIT' ? form.visit_dpd_bucket : '');

    put('out_of_range_reason', extra.out_of_range_reason);
    put('out_of_range_comment', extra.out_of_range_comment);
    put('duplicate_location_reason', extra.duplicate_location_reason);
    put('duplicate_location_comment', extra.duplicate_location_comment);

    photos.forEach((p) => {
      fd.append('photos', { uri: p.uri, name: p.fileName, type: p.type });
      fd.append('photo_kinds', p.kind);
    });

    return fd;
  };

  const submitVisit = async (extra = {}) => {
    // Belt-and-braces against a double "Update & Save" tap creating two
    // CollectionUpdate rows for the same visit — `saving` alone can lag a
    // fast second tap by a render or two.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const fd = buildFormData(extra);
      const res = await api.completeVisit(collectionId, fd);
      await registerExternalPunchIn(res.data, localLocation);
      Alert.alert('Success', 'Visit recorded successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
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
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    await submitVisit();
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
    await submitVisit({ out_of_range_reason: outOfRangeReason, out_of_range_comment: outOfRangeComment });
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
    await submitVisit({ duplicate_location_reason: dupLocationReason, duplicate_location_comment: dupLocationComment });
  };

  const plannedDate = record?.due_date ? new Date(record.due_date) : new Date();
  plannedDate.setHours(0, 0, 0, 0);
  const maxPromiseDate = new Date(plannedDate);
  maxPromiseDate.setMonth(maxPromiseDate.getMonth() + 1);

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
              </View>
            </>
          )}
        </View>

        {/* GPS status */}
        <View style={[styles.gpsBadge, fetchingLocation ? styles.gpsFetching : localLocation?.isMock ? styles.gpsMock : styles.gpsLocked]}>
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

        {/* Section 2: Reason */}
        <Text style={styles.label}>Reason</Text>
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
          {REASON_PRESETS.map((r) => (
            <TouchableOpacity key={r.value} style={[styles.chip, form.reason === r.value && styles.chipActive]} onPress={() => updateForm('reason', form.reason === r.value ? '' : r.value)}>
              <Text style={[styles.chipText, form.reason === r.value && styles.chipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section 3+4: Payment */}
        <Text style={styles.label}>Payment Mode</Text>
        <View style={styles.chips}>
          {PAYMENT_MODES.map((m) => (
            <TouchableOpacity key={m.value} style={[styles.chip, form.payment_mode === m.value && styles.chipActive]} onPress={() => updateForm('payment_mode', m.value)}>
              <Text style={[styles.chipText, form.payment_mode === m.value && styles.chipTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {form.payment_mode === 'UPI' && (
          <TextInput style={styles.input} value={form.upi_ref} onChangeText={(t) => updateForm('upi_ref', t)} placeholder="UPI Reference ID" placeholderTextColor={colors.textMuted} />
        )}
        {form.payment_mode === 'CHEQUE' && (
          <TextInput style={styles.input} value={form.cheque_no} onChangeText={(t) => updateForm('cheque_no', t)} placeholder="Cheque Number" placeholderTextColor={colors.textMuted} />
        )}

        {/* Section 5: Collection Status */}
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

        {form.status === 'PENDING' && (
          <>
            <Text style={styles.label}>Promise to Pay Date *</Text>
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
        )}

        {form.status === 'VISITED' && (
          <>
            <Text style={styles.label}>Visit Reason</Text>
            <View style={styles.chips}>
              {VISIT_REASON_OPTIONS.map((o) => (
                <TouchableOpacity key={o.value} style={[styles.chip, form.visit_reason === o.value && styles.chipActive]} onPress={() => updateForm('visit_reason', o.value)}>
                  <Text style={[styles.chipText, form.visit_reason === o.value && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {form.status === 'VISITED' && form.visit_reason === 'OD_VISIT' && (
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

        {/* Section 6: Amount + Remarks */}
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
          </>
        )}

        <Text style={styles.label}>{form.status === 'NOT_PAID' ? 'Reason Why Not Paid *' : 'Remarks'}</Text>
        <TextInput
          style={[styles.input, styles.remarksInput]}
          multiline
          value={form.remarks}
          onChangeText={(v) => updateForm('remarks', v)}
          placeholder={form.status === 'NOT_PAID' ? 'Why did the customer not pay? (required)' : 'Optional notes'}
          placeholderTextColor={colors.textMuted}
        />

        {/* Section 7: Photos — one column per kind, side by side */}
        <Text style={styles.label}>Photos</Text>
        <View style={styles.photoColumns}>
          {PHOTO_KINDS.map((k) => {
            const isRequired = REASON_MEDIA_REQUIREMENTS[form.reason]?.photoKind === k.value;
            return (
              <View key={k.value} style={styles.photoColumn}>
                <Text style={styles.photoKindLabel} numberOfLines={1}>
                  {k.label}{isRequired ? ' *' : ''}
                </Text>
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
            );
          })}
        </View>

        {/* Section 8: Travel companion */}
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

        {/* Section 9: GPS notice + Save */}
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
  gpsBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 8 },
  gpsFetching: { backgroundColor: colors.primaryLight },
  gpsMock: { backgroundColor: colors.warningLight },
  gpsLocked: { backgroundColor: colors.successLight },
  gpsBadgeText: { fontSize: typography.sizes.xs, marginLeft: spacing.xs, fontWeight: '600' },
  gpsRefresh: { marginLeft: spacing.sm },
  addressCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.surface, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.sm },
  addressText: { flex: 1, fontSize: typography.sizes.xs, color: colors.textMuted },
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
