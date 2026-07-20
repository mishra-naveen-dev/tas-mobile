import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { cacheWrite, cacheRead, makeCacheKey } from '../utils/dataCache';
import { serverStatus } from '../utils/serverStatus';

const PROD_URL = 'https://api.tas.namracred.co.in/api/v1';

let customBaseURL = null;

export const getBaseURL = () => {
    return customBaseURL || PROD_URL;
};

export const loadCustomBaseURL = async () => {
    // Custom URL overrides are only honoured in dev builds.
    // In production the app always hits PROD_URL so testers/devices
    // don't accidentally stay pointed at a dev server.
    if (!__DEV__) {
        await AsyncStorage.removeItem('custom_api_url');
        return;
    }
    try {
        const stored = await AsyncStorage.getItem('custom_api_url');
        if (stored) {
            customBaseURL = stored;
            api.defaults.baseURL = stored;
        }
    } catch (e) {
        if (__DEV__) console.error('Error loading custom API URL:', e);
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
        if (__DEV__) console.error('Error setting custom API URL:', e);
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
        if (__DEV__) console.error('Device fingerprint error:', error);
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
        const manufacturer = await DeviceInfo.getManufacturer();
        const systemVersion = await DeviceInfo.getSystemVersion();
        const appVersion = await DeviceInfo.getVersion();

        return {
            model,
            manufacturer,
            os: Platform.OS,
            osVersion: systemVersion,
            appVersion
        };
    } catch (error) {
        return {
            model: 'Unknown',
            manufacturer: 'Unknown',
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
    // Leave FormData bodies (photo/file uploads) alone — axios needs to set
    // its own multipart boundary, which forcing 'application/json' here
    // would silently clobber, corrupting the upload.
    if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
    }

    return config;
});

let sessionExpiredCallback = null;
let isSessionExpiredHandled = false;

// Reconnect polling — tries a lightweight GET every 20s while server is unreachable
let _reconnectTimer = null;
function startReconnectPolling() {
    if (_reconnectTimer) return;
    _reconnectTimer = setInterval(async () => {
        try {
            const token = await AsyncStorage.getItem('access');
            await axios.get(`${getBaseURL()}/organization/roles/`, {
                params: { page_size: 1 },
                timeout: 8000,
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            clearInterval(_reconnectTimer);
            _reconnectTimer = null;
            serverStatus.setOnline();
        } catch (_) { /* still offline */ }
    }, 20000);
}

export const setSessionExpiredCallback = (callback) => {
    sessionExpiredCallback = callback;
};

export const resetSessionHandler = () => {
    isSessionExpiredHandled = false;
};

api.interceptors.response.use(
    async (response) => {
        const method = (response.config?.method || '').toLowerCase();
        if (method === 'get') {
            const key = makeCacheKey(response.config.url, response.config.params || {});
            await cacheWrite(key, response.data);
        }
        if (!serverStatus._online) serverStatus.setOnline();
        if (_reconnectTimer) { clearInterval(_reconnectTimer); _reconnectTimer = null; }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Network failure (no response) → serve last cached data
        if (!error.response && originalRequest) {
            const method = (originalRequest.method || '').toLowerCase();
            if (method === 'get') {
                const key = makeCacheKey(originalRequest.url, originalRequest.params || {});
                const cached = await cacheRead(key);
                if (cached) {
                    serverStatus.setOffline(cached.ts);
                    startReconnectPolling();
                    return Promise.resolve({
                        data: cached.data,
                        status: 200,
                        stale: true,
                        cachedAt: cached.ts,
                        config: originalRequest,
                    });
                }
            }
            serverStatus.setOffline(null);
            startReconnectPolling();
        }

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
                    // No refresh token — check whether user was ever authenticated.
                    // On a fresh install both access and refresh are absent; firing
                    // "Session Expired" in that state is wrong — silently reject.
                    const access = await AsyncStorage.getItem('access');
                    if (!access) {
                        return Promise.reject(error);
                    }
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

api.updateCorrectionRequest = (id, data) =>
    api.patch(`/attendance/correction-requests/${id}/`, data);

api.deleteCorrectionRequest = (id) =>
    api.delete(`/attendance/correction-requests/${id}/`);

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

api.getAllowanceRequests = (params = {}) =>
    api.get('/allowance/requests/', { params });

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

// ===== Live Route Tracking (separate 10s-ping system) =====
api.startLiveSession = (data = {}) =>
    api.post('/livetracking/sessions/start/', data);

api.stopLiveSession = (data = {}) =>
    api.post('/livetracking/sessions/stop/', data);

api.sendLivePoints = (data) =>
    api.post('/livetracking/points/', data);

api.getActiveLiveSession = () =>
    api.get('/livetracking/sessions/active/');

// Backend-driven tracking config (interval/thresholds/durations) — fetched
// at app start, on punch-in, and after a native service restart.
api.getTrackingConfig = () =>
    api.get('/livetracking/config/');

// Non-GPS lifecycle events (app/service restart, network/GPS lost-restored,
// manual interaction) — counts as "activity" for the auto-punch-out watcher
// exactly like a real GPS point does.
api.sendTrackingHeartbeat = (data) =>
    api.post('/livetracking/heartbeat/', data);

// Coordinates for one day. Pass { date, employee_id? }.
api.getLiveDailyRoute = (params = {}) =>
    api.get('/livetracking/daily/', { params });

// The employee's most recent auto-closed session with no review request yet
// (Milestone 2a) — PunchContext polls this to decide whether to show a
// "request a review" banner.
api.getLastAutoClosure = () =>
    api.get('/livetracking/last-auto-closure/');

// Submit a forgot-punch-out review request for an auto-closed session.
api.submitForgotPunchRequest = (data) =>
    api.post('/punch-verification/requests/', data);

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

api.approveDevice = (id) => api.post(`/organization/devices/${id}/approve/`);
api.rejectDevice = (id) => api.post(`/organization/devices/${id}/reject/`);
api.blockDevice = (id) => api.post(`/organization/devices/${id}/block/`);
api.resetDevice = (id) => api.post(`/organization/devices/${id}/reset/`);

// Application Activity (app open/close lifecycle) — see ApplicationActivityService.
api.startAppSession = (payload) => api.post('/organization/devices/app_session_start/', payload);
api.endAppSession = (payload) => api.post('/organization/devices/app_session_end/', payload);

api.getAllowanceRequests = (params = {}) => api.get('/allowance/requests/', { params });
api.approveAllowanceRequest = (id) => api.post(`/allowance/requests/${id}/approve/`);
api.rejectAllowanceRequest = (id, reason = '') => api.post(`/allowance/requests/${id}/reject/`, { reason });

api.getProfileUpdateRequests = (params = {}) => api.get('/organization/profile-update/', { params });
api.createProfileUpdateRequest = (data) => api.post('/organization/profile-update/', data);
api.approveProfileUpdateRequest = (id) => api.post(`/organization/profile-update/${id}/approve/`);
api.rejectProfileUpdateRequest = (id) => api.post(`/organization/profile-update/${id}/reject/`);

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

// Reverse geocode proxy — key stays on the server, never in the APK
api.reverseGeocode = (lat, lng) =>
    api.get('/attendance/geocode/', { params: { latlng: `${lat},${lng}` } });

// Master Data
api.searchMasterValues = (categoryKey, query = '', limit = 20) =>
    api.get('/master-data/values/', { params: { category: categoryKey, q: query, limit } });

api.createMasterValue = (categoryKey, name) =>
    api.post('/master-data/requests/', { category_key: categoryKey, requested_value: name });

api.incrementMasterUsage = (valueId) =>
    api.post(`/master-data/values/${valueId}/increment_usage/`, {});

api.checkMasterDuplicate = (categoryKey, name) =>
    api.get('/master-data/values/check_duplicate/', { params: { category: categoryKey, name } });

api.getPendingMasterRequests = () =>
    api.get('/master-data/requests/pending/');

api.approveMasterRequest = (id, remarks = '') =>
    api.post(`/master-data/requests/${id}/approve/`, { remarks });

api.rejectMasterRequest = (id, remarks = '') =>
    api.post(`/master-data/requests/${id}/reject/`, { remarks });

// ── Notifications ──
api.getNotifications = (params = {}) =>
    api.get('/organization/notifications/', { params });

api.getRecentNotifications = () =>
    api.get('/organization/notifications/recent/');

api.getUnreadNotificationCount = () =>
    api.get('/organization/notifications/unread_count/');

api.markNotificationRead = (id) =>
    api.post(`/organization/notifications/${id}/mark_read/`);

api.markAllNotificationsRead = () =>
    api.post('/organization/notifications/mark_all_read/');

api.deleteNotification = (id) =>
    api.delete(`/organization/notifications/${id}/`);

api.deleteAllNotifications = () =>
    api.delete('/organization/notifications/delete_all/');

// ── Customer collections ──
api.getCollections = (params = {}) =>
    api.get('/loans/collections/', { params });

api.getCollectionRecord = (id) =>
    api.get(`/loans/collections/${id}/`);

api.getDistinctProducts = () =>
    api.get('/loans/collections/distinct_products/');

api.getDistinctProductTypes = () =>
    api.get('/loans/collections/distinct_product_types/');

api.updateCollectionStatus = (id, data) =>
    api.post(`/loans/collections/${id}/update_status/`, data);

api.getCollectionDashboardStats = () =>
    api.get('/loans/collections/dashboard_stats/');

// History of collection updates (an employee's outcome entries on a
// collection record) — used to surface today's field activity even when it
// didn't happen inside an explicit punch-tracked GPS session.
api.getCollectionUpdates = (params = {}) =>
    api.get('/loans/collection-updates/', { params });

// Unified Collection Visit: one punch + one collection-status update (+
// optional photos) in a single transactional request. `formData` must be a
// FormData instance (see CollectionVisitScreen) — the request interceptor
// above leaves its Content-Type alone so axios can set the multipart boundary.
api.completeVisit = (collectionId, formData) =>
    api.post(`/loans/collections/${collectionId}/complete_visit/`, formData);

// ── Customer Map ──
// `bounds` must be { min_lat, max_lat, min_lng, max_lng }; `params` carries
// the usual CollectionRecordFilter params (status, dpd_bucket, risk_category,
// branch_name, product_type) plus optional user_lat/user_lng/radius_km.
api.getMapMarkers = (bounds, params = {}) =>
    api.get('/loans/collections/map_markers/', { params: { ...bounds, ...params } });

api.getMapDetail = (id, params = {}) =>
    api.get(`/loans/collections/${id}/map_detail/`, { params });

api.getEta = (id, userLat, userLng) =>
    api.get(`/loans/collections/${id}/eta/`, { params: { user_lat: userLat, user_lng: userLng } });

api.getMapSearch = (query, params = {}) =>
    api.get('/loans/collections/map_search/', { params: { q: query, ...params } });

api.getNearbyEmployees = (params = {}) =>
    api.get('/loans/collections/nearby_employees/', { params });

api.setRiskCategory = (id, riskCategory) =>
    api.post(`/loans/collections/${id}/set_risk_category/`, { risk_category: riskCategory });

export default api;
