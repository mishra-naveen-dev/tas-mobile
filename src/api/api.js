import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, DeviceInfo } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import OfflineService, { CacheKeys } from '../services/OfflineService';

const PROD_URL = 'https://tas-backend-8emb.onrender.com/api/v1';
const LOCAL_EMULATOR_URL = 'http://10.0.2.2:8000/api/v1';

const getBaseURL = () => {
    return PROD_URL;
};

// Generate stable device fingerprint
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

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 15000,
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('access');
    const deviceId = await getDeviceId();
    const deviceInfo = await getDeviceInfo();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers['X-DEVICE-ID'] = deviceId;
    config.headers['X-PLATFORM'] = getPlatform();
    config.headers['X-DEVICE-INFO'] = JSON.stringify(deviceInfo);
    config.headers['X-APP-VERSION'] = '1.0.0';
    config.headers['Content-Type'] = 'application/json';

    return config;
});

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

            try {
                const refresh = await AsyncStorage.getItem('refresh');

                if (!refresh) throw new Error("No refresh token");

                const res = await axios.post(
                    `${getBaseURL()}/auth/token/refresh/`,
                    { refresh }
                );

                const newAccess = res.data.access;

                await AsyncStorage.setItem('access', newAccess);

                originalRequest.headers.Authorization = `Bearer ${newAccess}`;

                return api(originalRequest);

            } catch (err) {
                console.log("Refresh failed:", err);
                await clearAuthData();
                return Promise.reject(err);
            }
        }

        if (error.response?.status === 403) {
            const errorCode = error.response?.data?.code;
            
            if (errorCode === 'DEVICE_NOT_BINDED' || errorCode === 'DEVICE_ID_REQUIRED') {
                await AsyncStorage.removeItem('device_id');
                await clearAuthData();
            }
            
            if (errorCode === 'PLATFORM_NOT_ALLOWED') {
                console.warn('This action is only available on desktop/web platform.');
            }
        }

        return Promise.reject(error);
    }
);

const clearAuthData = async () => {
    await AsyncStorage.multiRemove(['access', 'refresh', 'user', 'device_id', 'device_fingerprint', 'device_info']);
};

// ================= Network Status Check =================
api.isOnline = async () => {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable !== false;
};

// ================= Offline-First Fetch Methods =================

// Fetch with automatic caching and offline fallback
api.fetchWithCache = async (key, url, options = {}) => {
    const {
        cacheKey,
        cacheOptions = {},
        fetchOptions = {},
        offlineFallback = true
    } = options;

    // Try to get cached data first
    const cached = await OfflineService.get(cacheKey || key);
    
    // Return cached data immediately if available
    if (cached.isCached && cached.data) {
        // Also fetch fresh data in background if online
        if (await api.isOnline()) {
            api.get(url, fetchOptions).then(async (res) => {
                const data = res.data?.results || res.data || [];
                await OfflineService.set(cacheKey || key, data, { metadata: { url } });
            }).catch(err => console.log('Background fetch failed:', err));
        }
        return { data: cached.data, isCached: true, isStale: cached.isStale };
    }

    // No cache, try network
    if (await api.isOnline()) {
        try {
            const res = await api.get(url, fetchOptions);
            const data = res.data?.results || res.data || [];
            await OfflineService.set(cacheKey || key, data, { metadata: { url } });
            return { data, isCached: false, isStale: false };
        } catch (error) {
            console.log('Fetch error:', error);
            if (offlineFallback) {
                return { data: cached.data || [], isCached: false, isStale: true, error };
            }
            throw error;
        }
    }

    // Offline and no cache
    if (offlineFallback) {
        return { data: cached.data || [], isCached: false, isStale: true, offline: true };
    }
    throw new Error('Network unavailable');
};

// ================= Role-based API methods =================

// Admin APIs
api.getAllEmployees = () => api.get('/organization/users/?role=EMPLOYEE');
api.getEmployeeTracking = () => api.get('/tracking/employees/');
api.getAllPunches = (params) => api.get('/attendance/punches/', { params });
api.getAllAllowanceRequests = (params) => api.get('/allowance/requests/', { params });
api.approveAllowance = (id, status) => api.patch(`/allowance/requests/${id}/`, { status });
api.getCorrectionRequests = () => api.get('/attendance/correction-requests/');
api.approveCorrection = (id, status) => api.patch(`/attendance/correction-requests/${id}/`, { status });
api.getDevices = (params) => api.get('/organization/devices/', { params });
api.approveDevice = (id, status) => api.patch(`/organization/devices/${id}/`, { status });
api.blockDevice = (id) => api.post('/organization/devices/revoke_device/', { session_device_id: id });

// Super Admin APIs
api.getAllUsers = (params) => api.get('/organization/users/', { params });
api.createUser = (data) => api.post('/organization/users/', data);
api.updateUser = (id, data) => api.patch(`/organization/users/${id}/`, data);
api.deleteUser = (id) => api.delete(`/organization/users/${id}/`);
api.getApprovalRoutes = () => api.get('/approvals/routes/');
api.createApprovalRoute = (data) => api.post('/approvals/routes/', data);
api.getOrganizationStats = () => api.get('/organization/stats/');

// Employee APIs
api.getMyDevices = () => api.get('/organization/devices/my_devices/');
api.requestDeviceBinding = (data) => api.post('/organization/devices/request/', data);

api.createPunchRecord = (data) => {
    return api.post('/attendance/punches/', data);
};

// With offline caching
api.getDailySummary = async () => {
    const result = await api.fetchWithCache('daily_summary', '/attendance/punches/daily_summary/', {
        cacheKey: CacheKeys.DASHBOARD_SUMMARY,
        offlineFallback: true
    });
    return { data: result.data };
};

api.getTodayPunches = async () => {
    const result = await api.fetchWithCache('today_punches', '/attendance/punches/today_punches/', {
        cacheKey: CacheKeys.TODAY_PUNCHES,
        offlineFallback: true
    });
    return { data: result.data };
};

api.getPunchHistory = async () => {
    const result = await api.fetchWithCache('punch_history', '/attendance/punches/', {
        cacheKey: CacheKeys.PUNCH_HISTORY,
        offlineFallback: true
    });
    return { data: result.data };
};

api.getHistoricalSummary = async (dateStr) => {
    const result = await api.fetchWithCache(
        `daily_summary_${dateStr}`,
        `/attendance/punches/daily_summary/?date=${dateStr}`,
        {
            cacheKey: `${CacheKeys.DAILY_SUMMARY}_${dateStr}`,
            offlineFallback: true
        }
    );
    return { data: result.data };
};

api.getAllowanceHistory = async () => {
    const result = await api.fetchWithCache('allowance_history', '/allowance/requests/', {
        cacheKey: CacheKeys.ALLOWANCE_HISTORY,
        offlineFallback: true
    });
    return { data: result.data };
};

api.getDeviceId = getDeviceId;
api.getPlatform = getPlatform;
api.OfflineService = OfflineService;
api.CacheKeys = CacheKeys;

export default api;
