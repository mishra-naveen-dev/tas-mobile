// src/screens/PunchScreen.js

import React, { useState, useEffect, useContext, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    ScrollView,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    PermissionsAndroid,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from 'react-native-geolocation-service';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';

import api from '../api/api';
import LocationService from '../services/LocationService';
import BackgroundTrackingService from '../services/BackgroundTrackingService';
import { useAuth } from '../context/AuthContext';

import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import GlassCard from '../components/GlassCard';
import PillSelector from '../components/PillSelector';
import { colors, typography, spacing } from '../theme/tokens';

const PunchScreen = ({ navigation }) => {
    const auth = useAuth();
    const token = auth?.accessToken;
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [pendingPoints, setPendingPoints] = useState(0);
    const [todayPunches, setTodayPunches] = useState([]);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const mapRef = useRef(null);

    const [data, setData] = useState({
        current_address: 'Tap refresh icon to fetch GPS...',
        latitude: null,
        longitude: null,
        customer_name: '',
        customer_address: '',
        reason: '',
        visit_type: '',
        loan_id: '',
        amount: '',
        payment_mode: '',
        upi_ref: '',
        cheque_no: '',
        travel_with: 'ALONE',
        co_employee_id: '',
        co_employee_name: '',
        punch_type: 'PUNCH_IN',
    });

    const updateData = (key, value) => {
        setData(prev => ({ ...prev, [key]: value }));
    };

    const fetchLocation = async () => {
        setLocationLoading(true);
        updateData('current_address', 'Pinging Hardware Service...');

        const result = await LocationService.getCurrentLocationInfo();

        if (result.error) {
            Alert.alert("Location Service Error", result.error);
            updateData('current_address', 'Service Failure');
            setLocationLoading(false);
            return false;
        }

        updateData('latitude', result.latitude);
        updateData('longitude', result.longitude);
        updateData('current_address', result.address);

        setLocationLoading(false);
        return result;
    };

    useEffect(() => {
        BackgroundTrackingService.initialize().then(() => {
            setIsTracking(BackgroundTrackingService.isCurrentlyTracking());
            setPendingPoints(BackgroundTrackingService.getPendingPointsCount());
        });

        fetchTodayPunches();

        const interval = setInterval(() => {
            setPendingPoints(BackgroundTrackingService.getPendingPointsCount());
            if (isTracking) {
                fetchDelayedRoute();
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [isTracking]);

    const fetchTodayPunches = async () => {
        try {
            const response = await api.get('/attendance/punches/today_punches/');
            setTodayPunches(response.data);
        } catch (error) {
            console.log('Failed to fetch today punches:', error);
        }
    };

    const fetchDelayedRoute = async () => {
        try {
            const routeData = await BackgroundTrackingService.fetchDelayedRoute();
            if (routeData && routeData.routes) {
                const allCoords = [];
                routeData.routes.forEach(route => {
                    route.points.forEach(point => {
                        allCoords.push({
                            latitude: point.lat,
                            longitude: point.lng,
                        });
                    });
                });
                setRouteCoordinates(allCoords);
            }
        } catch (error) {
            console.log('Failed to fetch delayed route:', error);
        }
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            let finalLat = data.latitude;
            let finalLng = data.longitude;
            let finalAddress = data.current_address;

            if (!finalLat || !finalLng) {
                console.log("-> Location missing on Submit, auto-fetching from Service...");
                const result = await fetchLocation();
                if (!result || !result.latitude) {
                    Alert.alert("Error", "Could not capture location. Ensure GPS is fully enabled.");
                    setLoading(false);
                    return;
                }
                finalLat = result.latitude;
                finalLng = result.longitude;
                finalAddress = result.address || 'Address Retrieved';
            }

            const payload = {
                punch_type: data.punch_type,
                latitude: finalLat,
                longitude: finalLng,
                current_address: finalAddress,
                customer_address: data.customer_address,
                visit_type: data.visit_type,
                notes: data.reason,
                loan_id: data.loan_id,
                amount: Number(data.amount || 0),
                payment_mode: data.payment_mode,
                upi_ref: data.upi_ref,
                cheque_no: data.cheque_no,
                travel_with: data.travel_with,
                co_employee_id: data.co_employee_id,
                co_employee_name: data.co_employee_name
            };

            const response = await api.post('/attendance/punches/', payload);
            const punchData = response.data;

            if (data.punch_type === 'PUNCH_IN' && punchData.tracking_session_id) {
                await BackgroundTrackingService.startTracking(punchData.tracking_session_id);
                setIsTracking(true);
                Alert.alert(
                    "Success",
                    "Punch In recorded and tracking started! Your route will be captured continuously.",
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else if (data.punch_type === 'PUNCH_OUT') {
                await BackgroundTrackingService.stopTracking();
                setIsTracking(false);
                Alert.alert(
                    "Success",
                    "Punch Out recorded and tracking stopped!",
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert("Success", "Punch has been successfully submitted", [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            }

            fetchTodayPunches();

        } catch (err) {
            const errorMsg = err?.response?.data || err?.message || "Unknown Error";
            Alert.alert("Error", typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg) || "Punch failed. Ensure network/GPS is active.");
        } finally {
            setLoading(false);
        }
    };

    const lastPunch = todayPunches.length > 0 ? todayPunches[0] : null;
    const isPunchedIn = lastPunch?.punch_type === 'PUNCH_IN';
    const isPunchedOutToday = todayPunches.some(p => p.punch_type === 'PUNCH_OUT');

    useEffect(() => {
        if (lastPunch) {
            updateData('punch_type', isPunchedIn ? 'PUNCH_OUT' : 'PUNCH_IN');
        }
    }, [isPunchedIn]);

    return (
        <SafeAreaView style={styles.container}>
            {locationLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 15 }} />
                    <Text style={styles.loadingText}>Calibrating Precise GPS...</Text>
                </View>
            )}

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {data.punch_type === 'PUNCH_IN' ? 'Punch In' : 'Punch Out'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                <GlassCard style={styles.card}>
                    <View style={styles.trackingStatus}>
                        <View style={styles.trackingStatusLeft}>
                            <Icon 
                                name={isTracking ? "activity" : "pause-circle"} 
                                size={20} 
                                color={isTracking ? colors.success : colors.warning} 
                            />
                            <Text style={styles.trackingStatusText}>
                                {isTracking 
                                    ? `Tracking Active (${pendingPoints} pending)` 
                                    : 'Tracking Inactive'}
                            </Text>
                        </View>
                        <View style={styles.punchCount}>
                            <Text style={styles.punchCountText}>{todayPunches.length} punches</Text>
                        </View>
                    </View>
                </GlassCard>

                <GlassCard style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Icon name="map-pin" size={20} color={colors.danger} />
                        <Text style={styles.sectionTitle}>Location</Text>
                    </View>

                    <View style={styles.locationContainer}>
                        <Text style={styles.addressText}>{data.current_address}</Text>
                        <TouchableOpacity onPress={fetchLocation} style={styles.refreshBtn}>
                            <Icon name="refresh-cw" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {data.latitude && data.longitude && (
                        <View style={styles.mapContainer}>
                            <MapView
                                ref={mapRef}
                                style={styles.map}
                                provider={PROVIDER_GOOGLE}
                                region={{
                                    latitude: data.latitude,
                                    longitude: data.longitude,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                                scrollEnabled={true}
                                zoomEnabled={true}
                            >
                                <Marker
                                    coordinate={{
                                        latitude: data.latitude,
                                        longitude: data.longitude,
                                    }}
                                    pinColor={colors.danger}
                                    title="Current Location"
                                />
                                {routeCoordinates.length > 0 && (
                                    <Polyline
                                        coordinates={routeCoordinates}
                                        strokeColor={colors.primary}
                                        strokeWidth={4}
                                    />
                                )}
                            </MapView>
                        </View>
                    )}
                </GlassCard>

                <GlassCard style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Icon name="info" size={20} color={colors.primary} />
                        <Text style={styles.sectionTitle}>Punch Type</Text>
                    </View>

                    <PillSelector 
                        label="Select Punch Type"
                        selectedValue={data.punch_type}
                        onValueChange={(v) => updateData('punch_type', v)}
                        options={[
                            { label: 'Punch In', value: 'PUNCH_IN' },
                            { label: 'Punch Out', value: 'PUNCH_OUT' }
                        ]}
                        disabled={isPunchedOutToday && !isPunchedIn}
                    />

                    {data.punch_type === 'PUNCH_IN' && (
                        <View style={styles.trackingInfo}>
                            <Icon name="info" size={16} color={colors.info} />
                            <Text style={styles.trackingInfoText}>
                                Starting tracking will capture your route every minute
                            </Text>
                        </View>
                    )}

                    {data.punch_type === 'PUNCH_OUT' && (
                        <View style={styles.trackingInfo}>
                            <Icon name="info" size={16} color={colors.warning} />
                            <Text style={styles.trackingInfoText}>
                                Stopping tracking will end route capture for today
                            </Text>
                        </View>
                    )}
                </GlassCard>

                {data.punch_type === 'PUNCH_IN' && (
                    <>
                        <GlassCard style={styles.card}>
                            <View style={styles.sectionHeader}>
                                <Icon name="info" size={20} color={colors.primary} />
                                <Text style={styles.sectionTitle}>Visit Details</Text>
                            </View>

                            <PillSelector 
                                label="Purpose of Visit"
                                selectedValue={data.visit_type}
                                onValueChange={(v) => {
                                    setData(prev => ({ ...prev, visit_type: v, loan_id: '', amount: '', payment_mode: '' }));
                                }}
                                options={[
                                    { label: 'Collection', value: 'COLLECTION' },
                                    { label: 'Disbursement', value: 'DISBURSEMENT' },
                                    { label: 'Other', value: 'OTHER' }
                                ]}
                            />

                            <InputField
                                icon="home"
                                placeholder="Customer Address"
                                value={data.customer_address}
                                onChangeText={(v) => updateData('customer_address', v)}
                            />

                            <InputField
                                icon="message-square"
                                placeholder="Purpose / Reason"
                                value={data.reason}
                                onChangeText={(v) => updateData('reason', v)}
                            />
                        </GlassCard>

                        {(data.visit_type === 'COLLECTION' || data.visit_type === 'DISBURSEMENT') && (
                            <GlassCard style={styles.card}>
                                <View style={styles.sectionHeader}>
                                    <Icon name="dollar-sign" size={20} color={colors.success} />
                                    <Text style={styles.sectionTitle}>Financial Trx</Text>
                                </View>

                                <InputField
                                    icon="hash"
                                    placeholder="Loan ID"
                                    value={data.loan_id}
                                    onChangeText={(v) => updateData('loan_id', v)}
                                />

                                <InputField
                                    icon="activity"
                                    placeholder="Amount (₹)"
                                    value={data.amount}
                                    onChangeText={(v) => updateData('amount', v)}
                                    keyboardType="numeric"
                                />

                                {data.visit_type === 'COLLECTION' && (
                                    <>
                                        <PillSelector
                                            label="Mode of Payment"
                                            selectedValue={data.payment_mode}
                                            onValueChange={(v) => updateData('payment_mode', v)}
                                            options={[
                                                { label: 'Cash', value: 'CASH' },
                                                { label: 'UPI', value: 'UPI' },
                                                { label: 'Cheque', value: 'CHEQUE' },
                                            ]}
                                        />

                                        {data.payment_mode === 'UPI' && (
                                            <InputField
                                                icon="smartphone"
                                                placeholder="UPI Ref ID"
                                                value={data.upi_ref}
                                                onChangeText={(v) => updateData('upi_ref', v)}
                                            />
                                        )}
                                        {data.payment_mode === 'CHEQUE' && (
                                            <InputField
                                                icon="file-text"
                                                placeholder="Cheque Number"
                                                value={data.cheque_no}
                                                onChangeText={(v) => updateData('cheque_no', v)}
                                            />
                                        )}
                                    </>
                                )}
                            </GlassCard>
                        )}
                    </>
                )}

                <GlassCard style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Icon name="users" size={20} color={colors.warning} />
                        <Text style={styles.sectionTitle}>Logistics</Text>
                    </View>

                    <PillSelector
                        label="Travel Composition"
                        selectedValue={data.travel_with}
                        onValueChange={(v) => {
                            updateData('travel_with', v);
                            updateData('co_employee_id', '');
                            updateData('co_employee_name', '');
                        }}
                        options={[
                            { label: 'Traveling Alone', value: 'ALONE' },
                            { label: 'With Co-Employee', value: 'WITH_EMPLOYEE' }
                        ]}
                    />

                    {data.travel_with === 'WITH_EMPLOYEE' && (
                        <>
                            <InputField
                                icon="user-plus"
                                placeholder="Co-Employee ID"
                                value={data.co_employee_id}
                                onChangeText={(v) => updateData('co_employee_id', v)}
                            />
                            <InputField
                                icon="smile"
                                placeholder="Co-Employee Name"
                                value={data.co_employee_name}
                                onChangeText={(v) => updateData('co_employee_name', v)}
                            />
                        </>
                    )}
                </GlassCard>

                <PrimaryButton
                    title={data.punch_type === 'PUNCH_IN' ? 'Punch In & Start Tracking' : 'Punch Out & Stop Tracking'}
                    onPress={handleSubmit}
                    loading={loading}
                    style={styles.submitBtn}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        padding: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl * 2,
    },
    card: {
        marginBottom: spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginLeft: spacing.sm,
    },
    trackingStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.sm,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    trackingStatusLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trackingStatusText: {
        fontSize: typography.sizes.sm,
        marginLeft: spacing.sm,
        color: colors.textDark,
    },
    punchCount: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 12,
    },
    punchCountText: {
        fontSize: typography.sizes.xs,
        color: '#fff',
        fontWeight: 'bold',
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f5f5f5',
        padding: spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10
    },
    addressText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.textDark,
        marginRight: spacing.sm,
    },
    refreshBtn: {
        padding: spacing.xs,
    },
    trackingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        padding: spacing.sm,
        borderRadius: 8,
        marginTop: spacing.sm,
    },
    trackingInfoText: {
        fontSize: typography.sizes.xs,
        color: colors.info,
        marginLeft: spacing.xs,
        flex: 1,
    },
    submitBtn: {
        marginTop: spacing.sm,
    },
    mapContainer: {
        height: 200,
        marginTop: spacing.md,
        borderRadius: 8,
        overflow: 'hidden',
    },
    map: {
        width: '100%',
        height: '100%',
    }
});

export default PunchScreen;
