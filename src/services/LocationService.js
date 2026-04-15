// src/services/LocationService.js

import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import api from '../api/api';

// Optional background geolocation - will be disabled if not installed
let BackgroundGeolocation;
try {
    BackgroundGeolocation = require('react-native-background-geolocation').default;
} catch (e) {
    console.log('Background geolocation not available - using basic tracking');
    BackgroundGeolocation = null;
}

const GOOGLE_API_KEY = "AIzaSyDM0WAR3vYxXNqSklb868wEmtDftQvYDkQ";

class LocationService {
    static isTracking = false;
    static currentSessionId = null;
    static locationCallback = null;
    static backgroundTrackingEnabled = false;

    static async requestPermission() {
        try {
            if (Platform.OS === 'ios') {
                const auth = await Geolocation.requestAuthorization('whenInUse');
                return auth === 'granted';
            }

            if (Platform.OS === 'android') {
                const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                if (alreadyGranted) return true;

                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: "Location Permission",
                        message: "TAS enterprise module requires access to your GPS to track visit locations accurately.",
                        buttonNeutral: "Ask Me Later",
                        buttonNegative: "Cancel",
                        buttonPositive: "OK"
                    }
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            }

            return false;
        } catch (err) {
            console.error("[LocationService] Native Permission Fault:", err);
            return false;
        }
    }

    static async requestBackgroundPermission() {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                {
                    title: "Background Location",
                    message: "TAS needs background location to track your route when app is minimized.",
                    buttonNeutral: "Ask Me Later",
                    buttonNegative: "Cancel",
                    buttonPositive: "OK"
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
    }

    static async getCurrentLocationInfo() {
        const hasPermission = await this.requestPermission();
        
        if (!hasPermission) {
            return { error: 'Permission Denied by Device/User', latitude: null, longitude: null, address: '' };
        }

        return new Promise((resolve) => {
            Geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    const accuracy = pos.coords.accuracy;
                    const altitude = pos.coords.altitude;
                    const speed = pos.coords.speed;
                    const heading = pos.coords.heading;

                    try {
                        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
                        const res = await fetch(googleUrl);
                        
                        if (!res.ok) throw new Error("Network Fault reaching Google Servers.");
                        
                        const json = await res.json();
                        if (json.status !== "OK" || !json.results || json.results.length === 0) {
                            throw new Error(json.error_message || "Target address unresolvable natively.");
                        }

                        const addressStr = json.results[0].formatted_address;
                        resolve({
                            latitude: lat,
                            longitude: lng,
                            address: addressStr,
                            accuracy,
                            altitude,
                            speed: speed ? speed * 3.6 : null,
                            heading,
                            source: 'GPS'
                        });
                    } catch (apiError) {
                        console.log("[LocationService] Google API Sub-Fault:", apiError);
                        resolve({
                            latitude: lat,
                            longitude: lng,
                            address: 'Geolocation Coordinates Locked (Offline Address)',
                            accuracy,
                            altitude,
                            speed: speed ? speed * 3.6 : null,
                            heading,
                            source: 'GPS'
                        });
                    }
                },
                (err) => {
                    console.log("[LocationService] Hardware Capture Fault:", err);
                    resolve({ error: "Failed to read GPS. Ensure location hardware module is toggled ON.", latitude: null, longitude: null, address: '' });
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
            );
        });
    }

    static async startTracking(batteryLevel = null, isBackground = false) {
        try {
            const response = await api.post('/tracking/session/start/', {
                battery_level: batteryLevel,
                is_background: isBackground
            });
            
            if (response.data.success) {
                this.currentSessionId = response.data.session_id;
                this.isTracking = true;
                this.backgroundTrackingEnabled = isBackground;
                console.log('[LocationService] Tracking started, session:', this.currentSessionId);
            }
            
            return response.data;
        } catch (error) {
            console.error('[LocationService] Start tracking error:', error);
            throw error;
        }
    }

    static async stopTracking(batteryLevel = null) {
        try {
            const response = await api.post('/tracking/session/stop/', {
                battery_level: batteryLevel
            });
            
            this.isTracking = false;
            this.currentSessionId = null;
            this.backgroundTrackingEnabled = false;
            
            return response.data;
        } catch (error) {
            console.error('[LocationService] Stop tracking error:', error);
            throw error;
        }
    }

    static async sendLocationUpdate(locationData) {
        try {
            const payload = {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                altitude: locationData.altitude || null,
                accuracy: locationData.accuracy || null,
                speed: locationData.speed || null,
                heading: locationData.heading || null,
                source: locationData.source || 'GPS',
                battery_level: locationData.batteryLevel || null
            };

            const response = await api.post('/tracking/location/update/', payload);
            return response.data;
        } catch (error) {
            console.error('[LocationService] Location update error:', error);
            throw error;
        }
    }

    static async sendCellTowerData(cellData) {
        try {
            const payload = {
                mcc: cellData.mcc,
                mnc: cellData.mnc,
                lac: cellData.lac,
                cid: cellData.cid,
                signal_strength: cellData.signalStrength || null,
                network_type: cellData.networkType || null,
                timing_advance: cellData.timingAdvance || null
            };

            const response = await api.post('/tracking/location/cell-tower/', payload);
            return response.data;
        } catch (error) {
            console.error('[LocationService] Cell tower update error:', error);
            return null;
        }
    }

    static async sendCrowdsourcedReport(reportType, latitude, longitude, confidence = 50, dataPoints = {}) {
        try {
            const payload = {
                report_type: reportType,
                latitude,
                longitude,
                confidence,
                data_points: dataPoints
            };

            const response = await api.post('/tracking/location/crowdsourced/', payload);
            return response.data;
        } catch (error) {
            console.error('[LocationService] Crowdsourced report error:', error);
            return null;
        }
    }

    static async getMyLocation() {
        try {
            const response = await api.get('/tracking/my-location/');
            return response.data;
        } catch (error) {
            console.error('[LocationService] Get location error:', error);
            throw error;
        }
    }

    static async getAllEmployeesLocations() {
        try {
            const response = await api.get('/tracking/employees-locations/');
            return response.data;
        } catch (error) {
            console.error('[LocationService] Get all employees error:', error);
            throw error;
        }
    }

    static async getSessionHistory() {
        try {
            const response = await api.get('/tracking/session/history/');
            return response.data;
        } catch (error) {
            console.error('[LocationService] Get session history error:', error);
            throw error;
        }
    }

    static startBackgroundTracking(onLocationUpdate) {
        if (this.backgroundTrackingEnabled) return;
        
        if (!BackgroundGeolocation) {
            console.log('[LocationService] Background tracking not available - use basic GPS tracking');
            return;
        }
        
        this.locationCallback = onLocationUpdate;
        
        BackgroundGeolocation.ready({
            locationProvider: BackgroundGeolocation.provider.ANDROID_DISTANCE_FILTER,
            desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
            distanceFilter: 50,
            interval: 60000,
            fastestInterval: 30000,
            activitiesInterval: 60000,
            stopOnTerminate: false,
            startOnBoot: true,
            notificationsEnabled: true,
            notification: {
                title: "TAS Tracking Active",
                text: "Your location is being tracked",
                iconColor: "#0000FF"
            }
        }, (state) => {
            if (state.enabled) {
                this.backgroundTrackingEnabled = true;
                BackgroundGeolocation.onLocation((location) => {
                    const locationData = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        altitude: location.coords.altitude,
                        accuracy: location.coords.accuracy,
                        speed: location.coords.speed ? location.coords.speed * 3.6 : null,
                        heading: location.coords.heading,
                        source: 'GPS',
                        timestamp: location.timestamp
                    };
                    
                    if (this.locationCallback) {
                        this.locationCallback(locationData);
                    }
                    
                    this.sendLocationUpdate(locationData);
                });
                
                BackgroundGeolocation.start();
            }
        });
    }

static stopBackgroundTracking() {
        if (!this.backgroundTrackingEnabled) return;
        
        if (!BackgroundGeolocation) {
            console.log('[LocationService] Background tracking not available');
            return;
        }
        
        BackgroundGeolocation.stop();
        this.backgroundTrackingEnabled = false;
    }
}

    static async isNetworkConnected() {
        const netInfo = await NetInfo.fetch();
        return netInfo.isConnected;
    }
}

export default LocationService;