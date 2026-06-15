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

// Parse error from API response
export const parseApiError = (error) => {
    let message = 'An unexpected error occurred';
    let type = ErrorType.UNKNOWN;
    let priority = ErrorPriority.MEDIUM;
    let canRetry = false;
    let forField = null;

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
        return { message, type, priority, canRetry, forField };
    }

    const status = error.response?.status;
    const data = error.response?.data;

    // Handle status codes
    switch (status) {
        case 400:
            // Bad Request - validation errors
            if (data) {
                if (data.detail) {
                    message = data.detail;
                } else if (data.non_field_errors?.length) {
                    message = data.non_field_errors[0];
                } else if (data.error) {
                    message = data.error;
                } else {
                    // Field-specific errors
                    const fieldErrors = [];
                    for (const [key, value] of Object.entries(data)) {
                        if (Array.isArray(value)) {
                            fieldErrors.push(`${key}: ${value[0]}`);
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
                message = data.detail;
            } else if (data?.non_field_errors) {
                message = data.non_field_errors[0];
            } else if (data?.error) {
                message = data.error;
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
                message = data.error || 'Your device has been blocked. Contact administrator.';
            } else if (data?.code === 'DEVICE_PENDING_APPROVAL') {
                message = data.error || 'Device pending approval. Please wait for admin approval.';
            } else if (data?.code === 'NEW_DEVICE_NOT_ALLOWED_FOR_EMPLOYEE') {
                message = data.error || 'Login from new device not allowed.';
            } else if (data?.code === 'USER_BLOCKED') {
                message = data.error || 'Your account has been blocked.';
            } else if (data?.error) {
                message = data.error;
            } else {
                message = 'You do not have permission for this action.';
            }
            type = ErrorType.AUTH;
            priority = ErrorPriority.HIGH;
            canRetry = false;
            break;

        case 404:
            // Not Found
            message = data?.detail || data?.error || 'The requested resource was not found.';
            type = ErrorType.SERVER;
            priority = ErrorPriority.LOW;
            canRetry = false;
            break;

        case 422:
            // Validation Error
            if (data) {
                if (data.detail) {
                    message = data.detail;
                } else {
                    const fieldErrors = [];
                    for (const [key, value] of Object.entries(data)) {
                        if (Array.isArray(value)) {
                            fieldErrors.push(`${key}: ${value[0]}`);
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
            // Rate Limited
            message = data?.error || 'Too many requests. Please wait a moment and try again.';
            type = ErrorType.SERVER;
            priority = ErrorPriority.MEDIUM;
            canRetry = true;
            break;

        case 500:
        case 502:
        case 503:
            // Server Error
            message = 'Server error. Please try again later.';
            if (data?.detail) {
                message = data.detail;
            }
            type = ErrorType.SERVER;
            priority = ErrorPriority.CRITICAL;
            canRetry = true;
            break;

        default:
            // Unknown error
            if (data?.detail) {
                message = data.detail;
            } else if (data?.error) {
                message = data.error;
            } else if (data?.message) {
                message = data.message;
            } else {
                message = error.message || 'An unexpected error occurred.';
            }
            type = ErrorType.UNKNOWN;
            priority = ErrorPriority.MEDIUM;
            canRetry = true;
    }

    return { message, type, priority, canRetry, forField, status };
};

// Show error alert to user
export const showError = (error, onRetry = null) => {
    const parsed = parseApiError(error);
    
    if (onRetry && parsed.canRetry) {
        Alert.alert(
            'Error',
            parsed.message,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Retry', onPress: onRetry },
            ]
        );
    } else {
        Alert.alert('Error', parsed.message);
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