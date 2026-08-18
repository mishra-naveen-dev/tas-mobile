// ============================================================
// Enterprise Error Handling System for TAS Mobile
// ============================================================

import { Alert } from 'react-native';

// Error Types
export const ErrorType = {
    NETWORK: 'NETWORK',
    AUTH: 'AUTH', 
    VALIDATION: 'VALIDATION',
    SERVER: 'SERVER',
    OFFLINE: 'OFFLINE',
    UNKNOWN: 'UNKNOWN',
};

// Error Priority
export const ErrorPriority = {
    LOW: 'low',
    MEDIUM: 'medium', 
    HIGH: 'high',
    CRITICAL: 'critical',
};

// DRF can return strings OR arrays for any error field (e.g. {"error": ["msg"]} or
// {"detail": ["msg"]}). Passing an array to Alert.alert() crashes on Android with
// "Value for message cannot be cast from ReadableNativeArray to String".
// Always extract a plain string before using any value from the response.
const safeString = (val, fallback = '') => {
    if (!val && val !== 0) return fallback;
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.length > 0 ? safeString(val[0], fallback) : fallback;
    if (typeof val === 'object') return fallback;
    return String(val);
};

// Parse error from API response
export const parseApiError = (error) => {
    let message = 'An unexpected error occurred';
    let type = ErrorType.UNKNOWN;
    let priority = ErrorPriority.MEDIUM;
    let canRetry = false;
    let forField = null;
    let code = null;
    let reference = null;

    // No response at all (network issue)
    if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            message = 'Request timed out. Please check your internet connection.';
            type = ErrorType.NETWORK;
            priority = ErrorPriority.MEDIUM;
            canRetry = true;
        } else if (error.message?.includes('Network request failed')) {
            message = 'No internet connection. Please check your network.';
            type = ErrorType.OFFLINE;
            priority = ErrorPriority.MEDIUM;
            canRetry = true;
        } else {
            message = error.message || 'Network error. Please try again.';
            type = ErrorType.NETWORK;
            canRetry = true;
        }
        return { message, type, priority, canRetry, forField, code, reference };
    }

    const status = error.response?.status;
    const data = error.response?.data;
    // data.code can itself be an ErrorDetail (DRF) — always extract as string
    code = safeString(data?.code) || null;
    // Backend attaches this to GPS-related rejections (the GPSCapture row id)
    // so a user can quote it and support/dev can find the exact reading
    // (lat/lng/accuracy/rejection reason/timestamp) without guessing.
    reference = data?.reference != null ? safeString(data.reference) : null;

    // Handle status codes
    switch (status) {
        case 400:
            // Bad Request - validation errors
            if (data) {
                if (data.detail) {
                    message = safeString(data.detail);
                } else if (data.non_field_errors?.length) {
                    message = safeString(data.non_field_errors[0]);
                } else if (data.error) {
                    message = safeString(data.error);
                } else {
                    // Field-specific errors
                    const fieldErrors = [];
                    for (const [key, value] of Object.entries(data)) {
                        if (Array.isArray(value)) {
                            fieldErrors.push(`${key}: ${safeString(value[0])}`);
                        }
                    }
                    message = fieldErrors.length > 0 ? fieldErrors.join(', ') : 'Invalid request data';
                }
            } else {
                message = 'Invalid request data';
            }
            type = ErrorType.VALIDATION;
            priority = ErrorPriority.LOW;
            canRetry = true;
            break;

        case 401:
            // Unauthorized - session/token issues
            if (data?.detail) {
                message = safeString(data.detail);
            } else if (data?.non_field_errors) {
                message = safeString(data.non_field_errors[0]);
            } else if (data?.error) {
                message = safeString(data.error);
            } else {
                message = 'Your session has expired. Please login again.';
            }
            type = ErrorType.AUTH;
            priority = ErrorPriority.HIGH;
            canRetry = false;
            break;

        case 403:
            // Forbidden - device, permissions
            if (data?.code === 'DEVICE_BLOCKED') {
                message = safeString(data.error, 'Your device has been blocked. Contact administrator.');
            } else if (data?.code === 'DEVICE_PENDING_APPROVAL') {
                message = safeString(data.error, 'Device pending approval. Please wait for admin approval.');
            } else if (data?.code === 'NEW_DEVICE_NOT_ALLOWED_FOR_EMPLOYEE') {
                message = safeString(data.error, 'Login from new device not allowed.');
            } else if (data?.code === 'USER_BLOCKED') {
                message = safeString(data.error, 'Your account has been blocked.');
            } else if (data?.error) {
                message = safeString(data.error);
            } else {
                message = 'You do not have permission for this action.';
            }
            type = ErrorType.AUTH;
            priority = ErrorPriority.HIGH;
            canRetry = false;
            break;

        case 404:
            message = safeString(data?.detail) || safeString(data?.error) || 'The requested resource was not found.';
            type = ErrorType.SERVER;
            priority = ErrorPriority.LOW;
            canRetry = false;
            break;

        case 422:
            // Validation Error
            if (data) {
                if (data.detail) {
                    message = safeString(data.detail);
                } else {
                    const fieldErrors = [];
                    for (const [key, value] of Object.entries(data)) {
                        if (Array.isArray(value)) {
                            fieldErrors.push(`${key}: ${safeString(value[0])}`);
                            if (!forField) forField = key;
                        }
                    }
                    message = fieldErrors.length > 0 ? fieldErrors.join(', ') : 'Validation error';
                }
            } else {
                message = 'Invalid data provided.';
            }
            type = ErrorType.VALIDATION;
            priority = ErrorPriority.LOW;
            canRetry = true;
            break;

        case 429:
            message = safeString(data?.error, 'Too many requests. Please wait a moment and try again.');
            type = ErrorType.SERVER;
            priority = ErrorPriority.MEDIUM;
            canRetry = true;
            break;

        case 500:
        case 502:
        case 503:
            message = data?.detail ? safeString(data.detail) : 'Server error. Please try again later.';
            type = ErrorType.SERVER;
            priority = ErrorPriority.CRITICAL;
            canRetry = true;
            break;

        default:
            if (data?.detail) {
                message = safeString(data.detail);
            } else if (data?.error) {
                message = safeString(data.error);
            } else if (data?.message) {
                message = safeString(data.message);
            } else {
                message = error.message || 'An unexpected error occurred.';
            }
            type = ErrorType.UNKNOWN;
            priority = ErrorPriority.MEDIUM;
            canRetry = true;
    }

    return { message, type, priority, canRetry, forField, status, code, reference };
};

// Show error alert to user
export const showError = (error, onRetry = null) => {
    const parsed = parseApiError(error);
    const text = parsed.reference ? `${parsed.message}\n\nRef: ${parsed.reference}` : parsed.message;

    if (onRetry && parsed.canRetry) {
        Alert.alert(
            'Error',
            text,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Retry', onPress: onRetry },
            ]
        );
    } else {
        Alert.alert('Error', text);
    }

    return parsed;
};

// Show success message
export const showSuccess = (message) => {
    Alert.alert('Success', message);
};

// Show info message  
export const showInfo = (title, message) => {
    Alert.alert(title, message);
};

// Format error for logging
export const formatErrorForLog = (error, context = '') => {
    const parsed = parseApiError(error);
    return `[${context}] ${parsed.type} (${parsed.priority}): ${parsed.message}`;
};

export default {
    parseApiError,
    showError,
    showSuccess,
    showInfo,
    formatErrorForLog,
    ErrorType,
    ErrorPriority,
};