import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, DeviceInfo } from 'react-native';

const PROD_URL = 'https://tas-backend-8emb.onrender.com/api/v1';

const getBaseURL = () => {
    return PROD_URL;
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
    await AsyncStorage.multiRemove(['access', 'refresh', 'user', 'device_id', 'device_fingerprint', 'device_info']);
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

        // Check for 401 Unauthorized (token expired)
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url.includes('/auth/token/')
        ) {
            originalRequest._retry = true;

            try {
                const refresh = await AsyncStorage.getItem('refresh');

                if (!refresh) {
                    console.log("No refresh token - need to login");
                    return Promise.reject(new Error("Session expired. Please login again."));
                }

                console.log("[API] Refreshing token...");
                
                const res = await axios.post(
                    `${getBaseURL()}/auth/token/refresh/`,
                    { refresh: refresh }
                );

                console.log("[API] Token refresh response:", res.data);

                const newAccess = res.data.access;
                const newRefresh = res.data.refresh;

                // Update both tokens
                await AsyncStorage.setItem('access', newAccess);
                if (newRefresh) {
                    await AsyncStorage.setItem('refresh', newRefresh);
                }

                originalRequest.headers.Authorization = `Bearer ${newAccess}`;

                console.log("[API] Token refreshed, retrying request");
                return api(originalRequest);

            } catch (refreshErr) {
                console.log("[API] Token refresh failed:", refreshErr?.response?.data || refreshErr?.message);
                await clearAuthData();
                return Promise.reject(new Error("Session expired. Please login again."));
            }
        }

        // Handle 403 errors (device, permissions)
        if (error.response?.status === 403) {
            const errorCode = error.response?.data?.code;
            const errorMsg = error.response?.data?.error || error.response?.data?.detail;
            
            console.log("[API] 403 Error:", errorCode, errorMsg);
            
            if (errorCode === 'DEVICE_NOT_BINDED' || errorCode === 'DEVICE_ID_REQUIRED') {
                await AsyncStorage.removeItem('device_id');
                await clearAuthData();
            }
            
            if (errorCode === 'PLATFORM_NOT_ALLOWED') {
                console.warn('This action is only available on desktop/web platform.');
            }
            
            // Return the actual error message for 403
            return Promise.reject(new Error(errorMsg || "Access denied"));
        }

        // Handle other errors (500, network, etc.)
        if (error.response?.status >= 500) {
            console.log("[API] Server error:", error.response?.status, error.response?.data);
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

api.getDailySummary = () => {
    return api.get('/attendance/punches/daily_summary/');
};

api.getTodayPunches = () => {
    return api.get('/attendance/punches/today_punches/');
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

api.createAllowanceRequest = (data) => {
    return api.post('/allowance/requests/', data);
};

api.getAllowanceHistory = (params = {}) => {
    return api.get('/allowance/requests/', { params });
};

api.getUserProfile = () => {
    return api.get('/organization/users/me/');
};

api.updateUserProfile = (data) => {
    return api.patch('/organization/users/me/', data);
};

api.changePassword = (currentPassword, newPassword) => {
    return api.post('/auth/change-password/', {
        old_password: currentPassword,
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

api.changePassword = async (oldPassword, newPassword) => {
    return api.post('/auth/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: newPassword,
    });
};

export default api;