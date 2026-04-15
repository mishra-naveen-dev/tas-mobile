import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, DeviceInfo } from 'react-native';

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
        
        // Create fingerprint from hardware info
        const fingerprint = `${uniqueId}|${model}|${manufacturer}|${systemVersion}`;
        
        // Simple hash
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

api.getDailySummary = () => {
    return api.get('/attendance/punches/daily_summary/');
};

api.getTodayPunches = () => {
    return api.get('/attendance/punches/today_punches/');
};

api.getPunchHistory = () => {
    return api.get('/attendance/punches/');
};

api.getHistoricalSummary = (dateStr) => {
    return api.get(`/attendance/punches/daily_summary/?date=${dateStr}`);
};

api.getAllowanceHistory = () => {
    return api.get('/allowance/requests/');
};

api.getDeviceId = getDeviceId;
api.getPlatform = getPlatform;

export default api;
