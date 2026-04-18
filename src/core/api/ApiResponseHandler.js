// ============================================================
// API Response Handler - Enterprise Level Error Handling
// ============================================================

import { parseApiError, showError } from '../core/error/AppErrorHandler';

/**
 * Handle API response and errors
 */
export const handleApiResponse = async (promise, options = {}) => {
    const {
        showAlert = false,
        onRetry = null,
        errorContext = 'API Request',
        skipError = false,
    } = options;

    try {
        const response = await promise;
        return {
            success: true,
            data: response.data,
            status: response.status,
        };
    } catch (error) {
        const parsed = parseApiError(error);

        // Log the error
        console.error(`[API Error] ${errorContext}:`, {
            status: parsed.status,
            message: parsed.message,
            type: parsed.type,
        });

        // Show alert if requested
        if (showAlert) {
            showError(error, onRetry);
        }

        return {
            success: false,
            error: parsed,
            message: parsed.message,
            canRetry: parsed.canRetry,
            status: parsed.status,
        };
    }
};

/**
 * Handle login response with enterprise error handling
 */
export const handleLoginResponse = async (loginPromise) => {
    return handleApiResponse(loginPromise, {
        errorContext: 'Login',
    });
};

/**
 * Handle data fetch response
 */
export const handleFetchResponse = async (fetchPromise, options = {}) => {
    return handleApiResponse(fetchPromise, {
        showAlert: true,
        errorContext: options.context || 'Fetch',
        ...options,
    });
};

export default {
    handleApiResponse,
    handleLoginResponse,
    handleFetchResponse,
};