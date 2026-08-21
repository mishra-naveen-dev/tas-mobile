// Shared business rules for recording a Collection Visit outcome — used by
// both CollectionVisitScreen.js (reached from a specific customer's record)
// and EmployeePunchScreen.js (reached generically, resolves a Loan ID to a
// collectionId first). Kept as one module specifically so the two screens
// can't silently drift apart on what counts as a valid/complete submission —
// mirrors the backend's own rules (apps/loans/views.py's
// _audio_required_reason, CompleteVisitSerializer) so all three stay in sync.
import { colors } from '../theme/tokens';
import { isPhone } from '../common/helpers/validationHelpers';
import { registerReplayer } from '../services/OfflineQueue';
import api from '../api/api';

export const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'P2P', color: colors.textMuted },
  { value: 'COLLECTED', label: 'Collected', color: colors.success },
  { value: 'PARTIALLY_COLLECTED', label: 'Partial', color: colors.warning },
  { value: 'NOT_PAID', label: 'Not Paid', color: colors.danger },
];

export const VISIT_TYPE_OPTIONS = [
  { value: 'HOME_VISIT', label: 'Home Visit' },
  { value: 'OD_VISIT', label: 'OD Visit' },
  { value: 'OTHER', label: 'Other' },
];

// Reason-aware confirmation text for the Collection Visit success dialog —
// e.g. "Collection has been done successfully.", "Visit has been done in
// Home Visit successfully.", "Visit has been done in eKYC successfully."
// Shared so CollectionVisitScreen and EmployeePunchScreen's inline visit
// flow can't drift apart on this wording.
export function buildVisitSuccessMessage(form) {
  if (form.reasonBucket === 'COLLECTION') {
    return 'Collection has been done successfully.';
  }
  if (form.reasonBucket === 'VISIT') {
    const label = VISIT_TYPE_OPTIONS.find((o) => o.value === form.visit_reason)?.label || form.visit_reason || 'Visit';
    return `Visit has been done in ${label} successfully.`;
  }
  // OTHER — form.reason holds the free-text/preset value chosen.
  const label = form.reason || 'Other';
  return `Visit has been done in ${label} successfully.`;
}

// Short noun phrase for the same reason, used in the offline-queued
// message's "Your ___ has been saved..." sentence — e.g. "collection",
// "Home Visit", "eKYC".
export function buildVisitOutcomeNoun(form) {
  if (form.reasonBucket === 'COLLECTION') return 'collection';
  if (form.reasonBucket === 'VISIT') {
    return VISIT_TYPE_OPTIONS.find((o) => o.value === form.visit_reason)?.label || 'visit';
  }
  return form.reason || 'visit';
}

export const DPD_BUCKET_OPTIONS = [
  { value: '60', label: '1-60' },
  { value: '90', label: '61-90' },
  { value: '180', label: '91-180' },
  { value: '360', label: '181-360' },
  { value: '360+', label: '360+' },
];

export const YES_NO_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

export const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
];

export const PHOTO_KINDS = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'DOCUMENT', label: 'Document' },
];

export const HOME_VISIT_PHOTO_KINDS = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'HOUSE', label: 'House' },
  { value: 'DOCUMENT', label: 'Document' },
];

// A voice note is mandatory for outcomes where spoken evidence actually
// matters — mirrors the backend's _audio_required_reason exactly
// (tas-backend/apps/loans/views.py) so client and server never drift apart.
// Note PENDING here is safe without also checking promise_date: both
// screens' own validate() already require promise_date before a PENDING
// submission is allowed through at all, so PENDING here always means "P2P
// was recorded".
export const isAudioRequiredFor = (form) => (
  form.status === 'NOT_PAID'
  || form.status === 'PARTIALLY_COLLECTED'
  || form.status === 'PENDING'
  || form.visit_reason === 'HOME_VISIT'
);

// The PTP/expected-payment-date range for P2P, Not Paid, and Partial
// Payment (remaining amount) all anchor on the *current* Collection Date —
// the day the employee is actually recording this visit — never on the
// record's old due_date/Demand Date. A loan overdue since an old Demand
// Date must still let the customer promise a fresh near-term date, not one
// implicitly bounded by how overdue it already is.
// One shared function so CollectionVisitScreen and EmployeePunchScreen
// can't drift apart on this the way they previously did on due_date.
export const getPromiseDateRange = (collectionDate = new Date()) => {
  const min = new Date(collectionDate);
  min.setHours(0, 0, 0, 0);
  const max = new Date(min);
  max.setMonth(max.getMonth() + 1);
  return { min, max, default: min };
};

/**
 * Builds the exact multipart FormData payload `api.completeVisit` expects —
 * shared so both screens submit an identical shape. `ctx` carries the pieces
 * that vary by caller (GPS fix, matched record's customer_name/address,
 * visit-start timestamp for Home Visit duration, out-of-range/duplicate-
 * location confirmation extras).
 */
export const buildCompleteVisitFormData = ({
  form, localLocation, customerName, customerAddress,
  photos = [], upiScreenshot, audioNote,
  visitStartTime, extra = {}, clientTransactionId,
}) => {
  const fd = new FormData();
  const put = (k, v) => { if (v !== undefined && v !== null && v !== '') fd.append(k, String(v)); };

  put('client_transaction_id', clientTransactionId);
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
  put('location_source', localLocation.location_source);

  put('reason', form.reason);
  put('customer_name', customerName);
  put('customer_address', customerAddress);
  put('payment_method', form.payment_mode);
  put('upi_ref', form.upi_ref);
  put('travel_type', form.travel_with);
  put('co_employee_id', form.co_employee_id);
  put('companion_name', form.co_employee_name);
  put('companion_phone', form.co_employee_phone);
  put('vehicle_number', form.vehicle_number);

  put('status', form.status);
  put('collected_amount', form.collected_amount);
  put('remarks', form.remarks);
  put('promise_date', form.promise_date ? form.promise_date.toISOString().split('T')[0] : '');
  put('visit_reason', form.visit_reason);
  put('visit_dpd_bucket', form.visit_reason === 'OD_VISIT' ? form.visit_dpd_bucket : '');
  // Top-level Total Visits bucket — form.reasonBucket is already computed
  // client-side (see CollectionVisitScreen's selectReasonBucket) but was
  // never transmitted before; see apps.loans.services.activity_classification.
  put('activity_reason', form.reasonBucket);

  if (form.visit_reason === 'HOME_VISIT') {
    put('visit_purpose', form.visit_purpose);
    put('visit_outcome', form.visit_outcome);
    if (form.customer_available !== null) put('customer_available', form.customer_available ? 'true' : 'false');
    if (form.customer_met !== null) put('customer_met', form.customer_met ? 'true' : 'false');
    if (form.family_member_met !== null) put('family_member_met', form.family_member_met ? 'true' : 'false');
    if (form.follow_up_required !== null) put('follow_up_required', form.follow_up_required ? 'true' : 'false');
    if (visitStartTime) {
      put('visit_start_time', visitStartTime.toISOString());
      put('visit_end_time', new Date().toISOString());
      put('visit_duration_seconds', Math.max(0, Math.round((Date.now() - visitStartTime.getTime()) / 1000)));
    }
  }

  put('out_of_range_reason', extra.out_of_range_reason);
  put('out_of_range_comment', extra.out_of_range_comment);
  put('duplicate_location_reason', extra.duplicate_location_reason);
  put('duplicate_location_comment', extra.duplicate_location_comment);

  // Backend defaults customer_phone_confirmed to true when omitted, so this
  // only needs to be sent when the employee has actually answered the
  // question — put() itself would already skip a null/'' value, but being
  // explicit here keeps the two phone fields visually paired.
  if (form.phone_correct === true || form.phone_correct === false) {
    put('customer_phone_confirmed', form.phone_correct ? 'true' : 'false');
    if (form.phone_correct === false) put('corrected_customer_phone', form.corrected_customer_phone);
  }

  photos.forEach((p) => {
    fd.append('photos', { uri: p.uri, name: p.fileName, type: p.type });
    fd.append('photo_kinds', p.kind);
  });
  if (upiScreenshot) {
    fd.append('upi_screenshot', { uri: upiScreenshot.uri, name: upiScreenshot.fileName, type: upiScreenshot.type });
  }
  if (audioNote) {
    fd.append('audio', { uri: audioNote.uri, name: audioNote.fileName, type: audioNote.mimeType });
    fd.append('audio_duration_seconds', String(audioNote.durationSeconds));
  }

  return fd;
};

/**
 * Wires the offline outbox's 'COLLECTION_VISIT' replayer — called once from
 * App.jsx at startup, not from either screen, so it's registered regardless
 * of which screen (if either) happens to be mounted when connectivity comes
 * back and the queue drains.
 *
 * Deliberately does NOT call PunchContext's registerExternalPunchIn: that
 * side effect ("I am punching in right now" — flips live punch state,
 * starts live tracking) only makes sense for an in-the-moment submit, not a
 * background sync that may complete minutes later after the user has
 * already moved on. The visit itself still saves correctly either way.
 */
export function registerCollectionVisitOfflineReplayer() {
  registerReplayer('COLLECTION_VISIT', async (payload) => {
    const fd = buildCompleteVisitFormData({
      ...payload,
      form: {
        ...payload.form,
        promise_date: payload.form.promise_date ? new Date(payload.form.promise_date) : null,
      },
      visitStartTime: payload.visitStartTime ? new Date(payload.visitStartTime) : null,
    });
    await api.completeVisit(payload.collectionId, fd);
  });
}

/**
 * Collection-status validation shared by both screens — returns an error
 * message string, or null if valid. Mirrors CollectionVisitScreen's own
 * validate() COLLECTION-bucket rules exactly.
 */
export const validateCollectionStatus = (form, { photos = [], upiScreenshot, audioNote } = {}) => {
  if (!form.status) return 'Please select a Collection Status.';
  if (form.status === 'PENDING' && !form.promise_date) {
    return 'Please select the date the customer promised to pay.';
  }
  if (form.status === 'COLLECTED' || form.status === 'PARTIALLY_COLLECTED') {
    if (!form.collected_amount || Number(form.collected_amount) <= 0) {
      return 'Please enter the collected amount.';
    }
    if (!form.payment_mode) return 'Payment mode is required.';
    if (form.payment_mode === 'CASH') {
      const hasAny = ['CUSTOMER', 'RECEIPT', 'DOCUMENT'].some((k) => photos.some((p) => p.kind === k));
      if (!hasAny) return 'Please add at least one photo — Customer, Receipt, or Document.';
    }
    if (form.payment_mode === 'UPI') {
      if (!form.upi_ref?.trim()) return 'Please enter the UPI reference number.';
      if (!upiScreenshot) return 'Please add the UPI screenshot.';
    }
  }
  if (form.status === 'PARTIALLY_COLLECTED') {
    if (!form.remarks?.trim()) return 'Remarks are required for a partial collection.';
    if (!form.promise_date) return 'Please select the remaining payment date.';
  }
  if (form.status === 'NOT_PAID' && !form.remarks?.trim()) {
    return 'Please enter the reason the customer did not pay.';
  }
  if (form.status === 'NOT_PAID' && !form.promise_date) {
    return 'Please select the next follow-up date.';
  }
  // Deliberately NOT checking isAudioRequiredFor here — CollectionVisitScreen
  // interleaves a screen-specific photo requirement (REASON_MEDIA_REQUIREMENTS)
  // between this and the audio check, so each caller checks
  // `isAudioRequiredFor(form) && !audioNote` itself, in whatever position
  // preserves its own original validation order.
  return null;
};

/**
 * Visit-type (Home Visit / OD Visit / Other) validation shared by both
 * screens — mirrors CollectionVisitScreen's own validate() VISIT-bucket
 * rules exactly.
 */
export const validateVisitType = (form, { audioNote } = {}) => {
  if (!form.visit_reason) return 'Please select a Visit Type.';
  if (form.visit_reason === 'HOME_VISIT') {
    if (!form.visit_purpose?.trim()) return 'Please enter the visit purpose.';
    if (!form.visit_outcome?.trim()) return 'Please enter the visit outcome.';
    if (form.customer_available === null) return 'Please specify whether the customer was available.';
    if (form.customer_met === null) return 'Please specify whether the customer was met.';
    if (!form.remarks?.trim()) return 'Please enter remarks.';
    if (form.follow_up_required === null) return 'Please specify whether a follow-up is required.';
    if (form.follow_up_required === true && !form.promise_date) return 'Please select the next follow-up date.';
    if (isAudioRequiredFor(form) && !audioNote) return 'Please record a voice note for this Home Visit.';
  }
  return null;
};

/**
 * "Is the customer phone number correct as recorded?" — must be answered
 * before submit. Mirrors the backend's CompleteVisitSerializer.validate()
 * exactly: a corrected number must be a valid 10-digit mobile, and (checked
 * server-side, where the full user directory lives) never a TAS employee's
 * own registered number — an employee can't substitute their own or a
 * colleague's number for the customer's.
 */
export const validateCustomerPhone = (form) => {
  if (form.phone_correct === null || form.phone_correct === undefined) {
    return 'Please confirm whether the customer phone number is correct.';
  }
  if (form.phone_correct === false) {
    if (!isPhone(form.corrected_customer_phone)) {
      return "Enter a valid 10-digit customer phone number.";
    }
  }
  return null;
};
