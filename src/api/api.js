import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const PROD_URL = 'https://tas-backendnew.onrender.com/api/v1';

let customBaseURL = null;

export const getBaseURL = () => {
    return customBaseURL || PROD_URL;
};

export const loadCustomBaseURL = async () => {
    try {
        const stored = await AsyncStorage.getItem('custom_api_url');
        if (stored) {
            customBaseURL = stored;
            api.defaults.baseURL = stored;
        }
    } catch (e) {
        console.log('Error loading custom API URL:', e);
    }
};

export const setCustomBaseURL = async (url) => {
    try {
        if (url) {
            let formattedUrl = url.trim().replace(/\/+$/, '');
            formattedUrl = formattedUrl.replace(/\/api\/v1$/, '');
            formattedUrl = formattedUrl.replace(/\/api\/v$/, '');
            formattedUrl = formattedUrl.replace(/\/api$/, '');
            formattedUrl = formattedUrl + '/api/v1';
            customBaseURL = formattedUrl;
            api.defaults.baseURL = formattedUrl;
            await AsyncStorage.setItem('custom_api_url', formattedUrl);
        } else {
            customBaseURL = null;
            api.defaults.baseURL = PROD_URL;
            await AsyncStorage.removeItem('custom_api_url');
        }
    } catch (e) {
        console.log('Error setting custom API URL:', e);
    }
};

const generateDeviceFingerprint = async () => {
    try {
        const uniqueId = await DeviceInfo.getUniqueId();
        const model = await DeviceInfo.getModel();
        const manufacturer = await DeviceInfo.getManufacturer();
        const systemVersion = await DeviceInfo.getSystemVersion();
        
        const fingerprint = `${uniqueId}|${model}|${manufacturer}|${systemVersion}`;
        
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        const platform = Platform.OS.toUpperCase();
        return `MOBILE_${platform}_${Math.abs(hash).toString(16)}`;
    } catch (error) {
        console.log('Device fingerprint error:', error);
        return `MOBILE_${Platform.OS.toUpperCase()}_${Date.now()}`;
    }
};

const getDeviceId = async () => {
    let deviceId = await AsyncStorage.getItem('device_fingerprint');
    
    if (!deviceId) {
        deviceId = await generateDeviceFingerprint();
        await AsyncStorage.setItem('device_fingerprint', deviceId);
    }
    
    return deviceId;
};

const getPlatform = () => {
    return Platform.OS.toUpperCase() === 'ios' ? 'IOS' : 'ANDROID';
};

const getDeviceInfo = async () => {
    try {
        const model = await DeviceInfo.getModel();
        const systemVersion = await DeviceInfo.getSystemVersion();
        const appVersion = await DeviceInfo.getVersion();
        
        return {
            model,
            os: Platform.OS,
            osVersion: systemVersion,
            appVersion
        };
    } catch (error) {
        return {
            model: 'Unknown',
            os: Platform.OS,
            osVersion: 'Unknown',
            appVersion: '1.0.0'
        };
    }
};

const clearAuthData = async () => {
    await AsyncStorage.multiRemove(['access', 'refresh', 'user', 'device_id', 'device_fingerprint', 'device_info', 'session_token']);
};

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 60000,
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('access');
    const deviceId = await getDeviceId();
    const deviceInfo = await getDeviceInfo();
    const sessionToken = await AsyncStorage.getItem('session_token');

    if (token && !config.url.includes('/auth/token')) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    if (sessionToken) {
        config.headers['X-Session-Token'] = sessionToken;
    }

    config.headers['X-DEVICE-ID'] = deviceId;
    config.headers['X-PLATFORM'] = getPlatform();
    config.headers['X-DEVICE-INFO'] = JSON.stringify(deviceInfo);
    config.headers['X-APP-VERSION'] = '1.0.0';
    config.headers['Content-Type'] = 'application/json';

    return config;
});

let sessionExpiredCallback = null;
let isSessionExpiredHandled = false;

export const setSessionExpiredCallback = (callback) => {
    sessionExpiredCallback = callback;
};

export const resetSessionHandler = () => {
    isSessionExpiredHandled = false;
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url.includes('/auth/token/')
        ) {
            originalRequest._retry = true;

            if (isSessionExpiredHandled) {
                return Promise.reject(error);
            }

            try {
                const refresh = await AsyncStorage.getItem('refresh');

                if (!refresh) {
                    isSessionExpiredHandled = true;
                    await clearAuthData();
                    if (sessionExpiredCallback) {
                        sessionExpiredCallback();
                    }
                    return Promise.reject(error);
                }

                const res = await axios.post(
                    `${getBaseURL()}/auth/token/refresh/`,
                    { refresh }
                );

                const newAccess = res.data.access;
                const newRefresh = res.data.refresh || refresh;
                const newSessionToken = res.data.session_token;

                await AsyncStorage.setItem('access', newAccess);
                await AsyncStorage.setItem('refresh', newRefresh);
                if (newSessionToken) {
                    await AsyncStorage.setItem('session_token', newSessionToken);
                }

                originalRequest.headers.Authorization = `Bearer ${newAccess}`;

                return api(originalRequest);

            } catch (err) {
                isSessionExpiredHandled = true;
                await clearAuthData();
                if (sessionExpiredCallback) {
                    sessionExpiredCallback();
                }
                return Promise.reject(error);
            }
        }

        if (error.response?.status === 403) {
            const errorCode = error.response?.data?.code;
            
            if (errorCode === 'DEVICE_NOT_BINDED' || errorCode === 'DEVICE_ID_REQUIRED') {
                await AsyncStorage.removeItem('device_id');
                await clearAuthData();
            }
        }

        return Promise.reject(error);
    }
);

api.createPunchRecord = (data) => {
    const payload = {
        punch_type: data.punch_type || 'PUNCH_IN',
        latitude: data.latitude,
        longitude: data.longitude,
        current_address: data.current_address || '',
        customer_address: data.customer_address || '',
        notes: data.notes || data.reason || '',
        visit_type: data.visit_type || data.punch_type || '',
        loan_id: data.loan_id || '',
        amount: data.amount ? parseFloat(data.amount) : null,
        payment_mode: data.payment_mode || '',
        upi_ref: data.upi_ref || '',
        cheque_no: data.cheque_no || '',
        customer_name: data.customer_name || '',
        travel_with: data.travel_with || 'ALONE',
        co_employee_id: data.co_employee_id || '',
        co_employee_name: data.co_employee_name || '',
        vehicle_number: data.vehicle_number || '',
    };
    return api.post('/attendance/punches/', payload);
};

api.punchOut = (punchId, data = {}) => {
    const payload = {
        punch_type: 'PUNCH_OUT',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        current_address: data.address || '',
        notes: 'Punch Out',
    };
    return api.post('/attendance/punches/', payload);
};

api.getDailySummary = (params = {}) => {
    return api.get('/attendance/punches/daily_summary/', { params });
};

api.getTodayPunches = () => {
    return api.get('/attendance/punches/today_punches/');
};

api.getAvailableDates = () => {
    return api.get('/attendance/punches/available_dates/');
};

api.getPunchHistory = (params = {}) => {
    return api.get('/attendance/punches/', { params });
};

api.createCorrectionRequest = (data) => {
    return api.post('/attendance/correction-requests/', data);
};

api.getMyCorrectionRequests = () => {
    return api.get('/attendance/correction-requests/my_requests/');
};

api.getCorrectionCounts = async () => {
    try {
        const res = await api.get('/attendance/correction-requests/');
        let requests = [];
        if (Array.isArray(res.data)) {
            requests = res.data;
        } else if (res.data?.results) {
            requests = res.data.results;
        }
        
        const counts = {
            pending: requests.filter(r => r.status === 'PENDING').length,
            approved: requests.filter(r => r.status?.includes('APPROVED')).length,
            rejected: requests.filter(r => r.status?.includes('REJECTED')).length,
            total: requests.length
        };
        return counts;
    } catch (err) {
        return { pending: 0, approved: 0, rejected: 0, total: 0 };
    }
};

api.getCorrectionRequests = (params = {}) => {
    return api.get('/attendance/correction-requests/', { params });
};

api.getPendingCorrectionRequests = () => {
    return api.get('/attendance/correction-requests/pending/');
};

api.reviewCorrection = (id, action, comment = '') => {
    return api.post(`/attendance/correction-requests/${id}/review/`, {
        action,
        comment
    });
};

api.recalculateDistance = async (fromAddress, toAddress) => {
    try {
        const fromRes = await api.get('/attendance/address/suggestions/', { params: { q: fromAddress } });
        const toRes = await api.get('/attendance/address/suggestions/', { params: { q: toAddress } });
        
        const fromLoc = fromRes.data?.[0];
        const toLoc = toRes.data?.[0];
        
        if (fromLoc?.geometry?.location && toLoc?.geometry?.location) {
            const fromLat = fromLoc.geometry.location.lat;
            const fromLng = fromLoc.geometry.location.lng;
            const toLat = toLoc.geometry.location.lat;
            const toLng = toLoc.geometry.location.lng;
            
            const R = 6371;
            const dLat = (toLat - fromLat) * Math.PI / 180;
            const dLon = (toLng - fromLng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            return { distance: Math.round(distance * 100) / 100 };
        }
        return { distance: 0, error: 'Could not geocode addresses' };
    } catch (err) {
        return { distance: 0, error: err.message };
    }
};

api.createAllowanceRequest = (data) => {
    return api.post('/allowance/requests/', data);
};

api.calculateDistance = async (fromAddress, toAddress) => {
    try {
        const res = await api.post('/attendance/address/calculate-distance/', {
            from_address: fromAddress,
            to_address: toAddress || fromAddress
        });
        
        if (res.data?.success) {
            return {
                success: true,
                distance: res.data.distance_km,
                distanceText: res.data.distance_text,
                duration: res.data.duration,
                fromCoords: res.data.from_coords,
                toCoords: res.data.to_coords
            };
        }
        return { success: false, error: res.data?.error || 'Calculation failed' };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

api.getAllowanceHistory = (params = {}) => {
    return api.get('/allowance/requests/', { params });
};

api.getDailyPunchDetail = (date) => {
    return api.get('/attendance/punches/by-date/', {
        params: { date }
    });
};

api.getMonthlyPunchSummary = (month, year) => {
    return api.get('/attendance/punches/monthly/', {
        params: { month, year }
    });
};

api.getPerformance = (period = 'daily') => {
    return api.get('/attendance/punches/performance/', { params: { period } });
};

api.bulkTrackingPoints = (data) => {
    return api.post('/attendance/tracking-points/bulk_create/', data);
};

api.getUserProfile = () => {
    return api.get('/organization/users/me/');
};

api.updateUserProfile = (data) => {
    return api.patch('/organization/users/me/', data);
};

api.changePassword = async (currentPassword, newPassword) => {
    return api.post('/auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: newPassword,
    });
};

api.getAllEmployees = (params = {}) => {
    return api.get('/organization/users/', { params });
};

api.getDevices = (params = {}) => {
    return api.get('/organization/devices/', { params });
};

api.getOrganizationStats = () => {
    return api.get('/organization/users/stats/');
};

api.login = async (username, password) => {
    const deviceId = await getDeviceId();
    const platform = getPlatform();
    
    return api.post('/auth/token/', {
        username,
        password,
    }, {
        headers: {
            'X-DEVICE-ID': deviceId,
            'X-PLATFORM': platform,
        }
    });
};

api.refreshToken = async (refreshToken) => {
    return api.post('/auth/token/refresh/', {
        refresh: refreshToken
    });
};

api.logout = async () => {
    return api.post('/auth/logout/');
};

export default api;
