// src/services/BackgroundTrackingService.js

import { Platform, AppState } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';

const TRACKING_INTERVAL = 60000;
const STORAGE_KEY_TRACKING_POINTS = '@tas_tracking_points';
const STORAGE_KEY_TRACKING_SESSION = '@tas_tracking_session';

class BackgroundTrackingService {
    static instance = null;
    
    isTracking = false;
    watchId = null;
    trackingSessionId = null;
    points = [];
    lastSyncTime = null;
    lastPoint = null;
    syncIntervalId = null;
    distanceThreshold = 0.01;
    timeThreshold = 30000;

    static getInstance() {
        if (!BackgroundTrackingService.instance) {
            BackgroundTrackingService.instance = new BackgroundTrackingService();
        }
        return BackgroundTrackingService.instance;
    }

    async initialize() {
        const storedPoints = await AsyncStorage.getItem(STORAGE_KEY_TRACKING_POINTS);
        if (storedPoints) {
            this.points = JSON.parse(storedPoints);
        }

        const storedSession = await AsyncStorage.getItem(STORAGE_KEY_TRACKING_SESSION);
        if (storedSession) {
            const session = JSON.parse(storedSession);
            this.trackingSessionId = session.id;
            this.isTracking = session.isActive;
        }
    }

    async startTracking(sessionId = null) {
        if (this.isTracking) {
            console.log('[BackgroundTracking] Already tracking');
            return;
        }

        console.log('[BackgroundTracking] Starting tracking...');

        this.trackingSessionId = sessionId;
        this.points = [];
        this.lastPoint = null;

        await this.saveState();

        this.isTracking = true;

        this.syncIntervalId = setInterval(() => {
            this.syncPointsToServer();
        }, TRACKING_INTERVAL);

        this.startLocationWatch();

        AppState.addListener('change', this.handleAppStateChange);

        return true;
    }

    async stopTracking() {
        if (!this.isTracking) {
            console.log('[BackgroundTracking] Not tracking');
            return;
        }

        console.log('[BackgroundTracking] Stopping tracking...');

        this.isTracking = false;

        if (this.watchId !== null) {
            Geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }

        await this.syncPointsToServer(true);

        await this.clearState();

        AppState.removeListener('change', this.handleAppStateChange);

        return true;
    }

    handleAppStateChange = (nextAppState) => {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
            console.log('[BackgroundTracking] App in background - continue tracking');
        } else if (nextAppState === 'active') {
            console.log('[BackgroundTracking] App in foreground');
            if (this.isTracking && this.points.length > 0) {
                this.syncPointsToServer();
            }
        }
    };

    startLocationWatch() {
        const config = {
            enableHighAccuracy: true,
            distanceFilter: this.distanceThreshold * 1000,
            interval: TRACKING_INTERVAL,
            fastestInterval: 30000,
            showLocationDialog: false,
            forceRequestLocation: true,
        };

        if (Platform.OS === 'android') {
            config.distanceFilter = 10;
            config.foregroundService = true;
            config.stationaryRadius = 10;
        }

        this.watchId = Geolocation.watchPosition(
            (position) => {
                this.handleLocationUpdate(position);
            },
            (error) => {
                console.error('[BackgroundTracking] Location error:', error);
            },
            config
        );
    }

    handleLocationUpdate(position) {
        const { latitude, longitude, altitude, accuracy, heading, speed } = position.coords;
        const timestamp = position.timestamp;

        const point = {
            latitude,
            longitude,
            altitude: altitude || 0,
            accuracy: accuracy || 0,
            heading: heading || 0,
            speed: speed || 0,
            timestamp: new Date(timestamp).toISOString(),
        };

        if (this.shouldSavePoint(point)) {
            this.points.push(point);
            this.lastPoint = point;
            this.saveState();
            
            console.log(`[BackgroundTracking] Point saved: ${latitude}, ${longitude}`);
        }
    }

    shouldSavePoint(newPoint) {
        if (!this.lastPoint) return true;

        const timeDiff = new Date(newPoint.timestamp) - new Date(this.lastPoint.timestamp);
        if (timeDiff >= this.timeThreshold) {
            return true;
        }

        const distance = this.calculateDistance(
            this.lastPoint.latitude,
            this.lastPoint.longitude,
            newPoint.latitude,
            newPoint.longitude
        );

        if (distance >= this.distanceThreshold) {
            return true;
        }

        return false;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(value) {
        return (value * Math.PI) / 180;
    }

    async syncPointsToServer(forceSyncAll = false) {
        if (!this.points.length) {
            console.log('[BackgroundTracking] No points to sync');
            return;
        }

        if (!this.trackingSessionId) {
            console.log('[BackgroundTracking] No session ID, skipping sync');
            return;
        }

        const pointsToSync = forceSyncAll
            ? [...this.points]
            : this.points.filter(p => !p.synced);

        if (!pointsToSync.length) {
            console.log('[BackgroundTracking] All points already synced');
            return;
        }

        console.log(`[BackgroundTracking] Syncing ${pointsToSync.length} points...`);

        try {
            const payload = {
                tracking_session_id: this.trackingSessionId,
                points: pointsToSync.map(p => ({
                    latitude: p.latitude,
                    longitude: p.longitude,
                    accuracy: p.accuracy,
                    speed: p.speed,
                    altitude: p.altitude,
                    heading: p.heading,
                    timestamp: p.timestamp,
                })),
            };

            const response = await api.post('/attendance/tracking-points/bulk_create/', payload);

            console.log('[BackgroundTracking] Sync successful:', response.data);

            this.points = this.points.filter(p => !pointsToSync.includes(p));
            this.lastSyncTime = new Date();

            await this.saveState();

            return response.data;

        } catch (error) {
            console.error('[BackgroundTracking] Sync failed:', error);
            return null;
        }
    }

    async saveState() {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_TRACKING_POINTS, JSON.stringify(this.points));
            await AsyncStorage.setItem(STORAGE_KEY_TRACKING_SESSION, JSON.stringify({
                id: this.trackingSessionId,
                isActive: this.isTracking,
                lastSync: this.lastSyncTime,
            }));
        } catch (error) {
            console.error('[BackgroundTracking] Failed to save state:', error);
        }
    }

    async clearState() {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY_TRACKING_POINTS);
            await AsyncStorage.removeItem(STORAGE_KEY_TRACKING_SESSION);
            this.points = [];
            this.trackingSessionId = null;
            this.lastPoint = null;
        } catch (error) {
            console.error('[BackgroundTracking] Failed to clear state:', error);
        }
    }

    getCurrentPoints() {
        return this.points;
    }

    getSessionId() {
        return this.trackingSessionId;
    }

    isCurrentlyTracking() {
        return this.isTracking;
    }

    getPendingPointsCount() {
        return this.points.length;
    }

    async fetchDelayedRoute(date = null) {
        try {
            const params = date ? { date } : {};
            if (this.trackingSessionId) {
                params.include_active = 'true';
            }
            
            const response = await api.get('/attendance/tracking/delayed-route/', params);
            return response.data;
        } catch (error) {
            console.error('[BackgroundTracking] Failed to fetch route:', error);
            return null;
        }
    }
}

export default BackgroundTrackingService.getInstance();
