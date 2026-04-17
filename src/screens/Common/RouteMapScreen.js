// src/screens/RouteMapScreen.js

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../api/api';
import LocationService from '../../services/LocationService';
import GlassCard from '../../components/GlassCard';
import { colors, typography, spacing } from '../../theme/tokens';

const { width, height } = Dimensions.get('window');

const RouteMapScreen = ({ navigation, route }) => {
    const mapRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [routeData, setRouteData] = useState(null);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(route?.params?.date || new Date().toISOString().split('T')[0]);
    const [showDelayed, setShowDelayed] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchRoute = async () => {
        try {
            setError(null);
            const response = await api.get('/attendance/tracking/delayed-route/', {
                params: { date: selectedDate }
            });
            setRouteData(response.data);
        } catch (err) {
            console.error('Failed to fetch route:', err);
            setError('Failed to load route data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRoute();

        const interval = setInterval(() => {
            if (showDelayed) {
                fetchRoute();
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [selectedDate, showDelayed]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRoute();
    };

    const centerOnCurrentLocation = () => {
        if (coordinates.length === 0) return;
        
        const latestPoint = coordinates[coordinates.length - 1];
        
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: latestPoint.latitude,
                longitude: latestPoint.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01
            }, 500);
        }
    };

    const fitAllCoordinates = () => {
        if (coordinates.length > 1 && mapRef.current) {
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 100, left: 50 },
                animated: true
            });
        }
    };

    const getAllCoordinates = () => {
        if (!routeData?.routes) return [];

        const allCoords = [];
        routeData.routes.forEach(route => {
            if (showDelayed) {
                route.points.forEach(point => {
                    allCoords.push({
                        latitude: point.lat,
                        longitude: point.lng,
                        timestamp: point.timestamp
                    });
                });
            } else {
                const delayThreshold = new Date(Date.now() - 10 * 60 * 1000);
                route.points.forEach(point => {
                    const pointTime = new Date(point.timestamp);
                    if (pointTime <= delayThreshold) {
                        allCoords.push({
                            latitude: point.lat,
                            longitude: point.lng,
                            timestamp: point.timestamp
                        });
                    }
                });
            }
        });

        return allCoords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    };

    const coordinates = getAllCoordinates();
    const latestPoint = coordinates.length > 0 ? coordinates[0] : null;
    const oldestPoint = coordinates.length > 0 ? coordinates[coordinates.length - 1] : null;

    const getMapRegion = () => {
        if (coordinates.length === 0) {
            return {
                latitude: 23.0225,
                longitude: 72.5714,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05
            };
        }

        if (coordinates.length === 1) {
            return {
                latitude: coordinates[0].latitude,
                longitude: coordinates[0].longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01
            };
        }

        if (latestPoint) {
            return {
                latitude: latestPoint.latitude,
                longitude: latestPoint.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05
            };
        }

        const lats = coordinates.map(c => c.latitude);
        const lngs = coordinates.map(c => c.longitude);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
            longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5)
        };
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading route data...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={colors.textDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Route Map</Text>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                    <Icon name="refresh-cw" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    region={getMapRegion()}
                    onMapReady={() => {
                        if (coordinates.length > 1) {
                            mapRef.current?.fitToCoordinates(coordinates, {
                                edgePadding: { top: 50, right: 50, bottom: 100, left: 50 },
                                animated: true
                            });
                        }
                    }}
                >
                    {latestPoint && (
                        <Marker
                            coordinate={{ latitude: latestPoint.latitude, longitude: latestPoint.longitude }}
                            pinColor="red"
                            title="Latest Point"
                            description={`Time: ${formatTime(latestPoint.timestamp)}`}
                        />
                    )}

                    {oldestPoint && latestPoint !== oldestPoint && (
                        <Marker
                            coordinate={{ latitude: oldestPoint.latitude, longitude: oldestPoint.longitude }}
                            pinColor="green"
                            title="Start"
                            description={`Time: ${formatTime(oldestPoint.timestamp)}`}
                        />
                    )}

                    {coordinates.length > 1 && (
                        <Polyline
                            coordinates={[...coordinates].reverse().map(c => ({
                                latitude: c.latitude,
                                longitude: c.longitude
                            }))}
                            strokeColor={colors.primary}
                            strokeWidth={4}
                        />
                    )}
                </MapView>

                {/* Map Control Buttons */}
                <View style={styles.mapControls}>
                    <TouchableOpacity 
                        style={styles.mapControlBtn} 
                        onPress={centerOnCurrentLocation}
                        activeOpacity={0.8}
                    >
                        <Icon name="crosshair" size={22} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.mapControlBtn} 
                        onPress={fitAllCoordinates}
                        activeOpacity={0.8}
                    >
                        <Icon name="maximize-2" size={22} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.mapOverlay}>
                    <Text style={styles.mapOverlayText}>
                        {showDelayed ? 'Showing delayed route (10 min)' : 'Showing real-time route'}
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.infoContainer} showsVerticalScrollIndicator={false}>
                <GlassCard style={styles.infoCard}>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Icon name="navigation" size={20} color={colors.primary} />
                            <Text style={styles.statValue}>{routeData?.total_sessions || 0}</Text>
                            <Text style={styles.statLabel}>Sessions</Text>
                        </View>

                        <View style={styles.statItem}>
                            <Icon name="map-pin" size={20} color={colors.success} />
                            <Text style={styles.statValue}>{coordinates.length}</Text>
                            <Text style={styles.statLabel}>Points</Text>
                        </View>

                        <View style={styles.statItem}>
                            <Icon name="activity" size={20} color={colors.warning} />
                            <Text style={styles.statValue}>{routeData?.total_distance || 0} km</Text>
                            <Text style={styles.statLabel}>Distance</Text>
                        </View>
                    </View>
                </GlassCard>

                <GlassCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Route Details</Text>
                    
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date</Text>
                        <Text style={styles.detailValue}>{formatDate(selectedDate)}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Tracking Status</Text>
                        <View style={styles.trackingBadge}>
                            <Icon 
                                name="activity" 
                                size={12} 
                                color={showDelayed ? colors.warning : colors.success} 
                            />
                            <Text style={[
                                styles.trackingBadgeText,
                                { color: showDelayed ? colors.warning : colors.success }
                            ]}>
                                {showDelayed ? 'Delayed' : 'Real-time'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={styles.delayToggle}
                        onPress={() => setShowDelayed(!showDelayed)}
                    >
                        <Icon 
                            name={showDelayed ? "eye-off" : "eye"} 
                            size={16} 
                            color={colors.primary} 
                        />
                        <Text style={styles.delayToggleText}>
                            {showDelayed ? 'Hide 10-min delayed points' : 'Show all points'}
                        </Text>
                    </TouchableOpacity>
                </GlassCard>

                {routeData?.routes?.map((route, index) => (
                    <GlassCard key={route.session_id} style={styles.routeCard}>
                        <View style={styles.routeHeader}>
                            <Icon name="clock" size={16} color={colors.primary} />
                            <Text style={styles.routeTitle}>Session {index + 1}</Text>
                            {route.is_active && (
                                <View style={styles.activeBadge}>
                                    <Text style={styles.activeBadgeText}>Active</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.routeDetails}>
                            <View style={styles.routeDetailItem}>
                                <Text style={styles.routeDetailLabel}>Start</Text>
                                <Text style={styles.routeDetailValue}>{formatTime(route.start_time)}</Text>
                            </View>

                            <View style={styles.routeDetailItem}>
                                <Text style={styles.routeDetailLabel}>End</Text>
                                <Text style={styles.routeDetailValue}>
                                    {route.end_time ? formatTime(route.end_time) : 'In progress'}
                                </Text>
                            </View>

                            <View style={styles.routeDetailItem}>
                                <Text style={styles.routeDetailLabel}>Points</Text>
                                <Text style={styles.routeDetailValue}>{route.total_points}</Text>
                            </View>

                            <View style={styles.routeDetailItem}>
                                <Text style={styles.routeDetailLabel}>Distance</Text>
                                <Text style={styles.routeDetailValue}>{route.distance} km</Text>
                            </View>
                        </View>

                        {route.pending_points > 0 && (
                            <View style={styles.pendingBadge}>
                                <Icon name="clock" size={12} color={colors.warning} />
                                <Text style={styles.pendingText}>
                                    {route.pending_points} points pending (10 min delay)
                                </Text>
                            </View>
                        )}
                    </GlassCard>
                ))}

                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textMuted,
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
    refreshBtn: {
        padding: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    mapContainer: {
        height: height * 0.35,
        width: '100%',
    },
    map: {
        flex: 1,
    },
    mapOverlay: {
        position: 'absolute',
        bottom: spacing.sm,
        left: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 4,
    },
    mapOverlayText: {
        color: '#fff',
        fontSize: typography.sizes.xs,
    },
    mapControls: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    mapControlBtn: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    mapControlBtnLast: {
        borderBottomWidth: 0,
    },
    infoContainer: {
        flex: 1,
        padding: spacing.md,
    },
    infoCard: {
        marginBottom: spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginTop: spacing.xs,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginBottom: spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    detailLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    },
    detailValue: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
    },
    trackingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 12,
    },
    trackingBadgeText: {
        fontSize: typography.sizes.xs,
        marginLeft: spacing.xs,
    },
    delayToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        padding: spacing.sm,
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
    },
    delayToggleText: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        marginLeft: spacing.sm,
    },
    routeCard: {
        marginBottom: spacing.md,
    },
    routeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    routeTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textDark,
        marginLeft: spacing.sm,
        flex: 1,
    },
    activeBadge: {
        backgroundColor: colors.success,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 10,
    },
    activeBadgeText: {
        color: '#fff',
        fontSize: typography.sizes.xs,
        fontWeight: 'bold',
    },
    routeDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    routeDetailItem: {
        width: '50%',
        marginBottom: spacing.xs,
    },
    routeDetailLabel: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    },
    routeDetailValue: {
        fontSize: typography.sizes.sm,
        fontWeight: 'bold',
        color: colors.textDark,
    },
    pendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff3e0',
        padding: spacing.sm,
        borderRadius: 8,
        marginTop: spacing.sm,
    },
    pendingText: {
        fontSize: typography.sizes.xs,
        color: colors.warning,
        marginLeft: spacing.xs,
    },
    bottomPadding: {
        height: spacing.xxl,
    },
});

export default RouteMapScreen;
