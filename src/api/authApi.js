import api from './api';

export const loginUser = async (username, password) => {
    const deviceId = await api.getDeviceId();
    const platform = api.getPlatform();
    
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

export const logoutUser = async () => {
    const keys = ['access', 'refresh', 'user', 'device_id', 'device_info', 'last_punch'];
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.multiRemove(keys);
};
