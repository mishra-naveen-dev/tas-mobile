import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { usePunch } from '../context/PunchContext';
import { colors, typography, spacing } from '../theme/tokens';
import LocationService from '../services/LocationService';
import GeocodingService from '../services/GeocodingService';

const MapViewScreen = ({ navigation, route }) => {
  const auth = useAuth();
  const { currentLocation, trackingCoords, todayPunches, isActive } = usePunch();
  const token = auth?.accessToken;
  
  const mapRef = useRef(null);
  const [punches, setPunches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    fetchPunches();
    getCurrentLocation();
  }, []);

  const fetchPunches = async () => {
    try {
      const res = await api.get('/attendance/punches/today_punches/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sorted = (res.data?.results || res.data || [])
        .filter(p => p.latitude && p.longitude)
        .sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at));
      setPunches(sorted);
    } catch (err) {
      if (__DEV__) console.log('Failed to fetch punches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const result = await LocationService.getCurrentLocationInfo({ useCache: true });
      if (result.latitude && result.longitude) {
        setUserLocation({
          latitude: result.latitude,
          longitude: result.longitude,
        });
        animateToLocation(result.latitude, result.longitude);
      }
    } catch (err) {
      if (__DEV__) console.log('Failed to get location:', err);
    }
  };

  const animateToLocation = (lat, lng, delta = 0.01) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }, 500);
    }
  };

  const centerOnUser = () => {
    if (userLocation) {
      animateToLocation(userLocation.latitude, userLocation.longitude, 0.005);
    } else {
      getCurrentLocation();
    }
  };

  const openInGoogleMaps = (lat, lng, label = '') => {
    GeocodingService.openInGoogleMaps(lat, lng, label);
  };

  const getDirections = (lat, lng) => {
    openInGoogleMaps(lat, lng);
  };

  const coordinates = punches.map(p => ({
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
  }));

  const routeCoordinates = trackingCoords.length > 0
    ? trackingCoords.map(c => ({
        latitude: c.latitude,
        longitude: c.longitude,
      }))
    : coordinates;

  const getMarkerColor = (punchType) => {
    if (punchType === 'PUNCH_IN') return colors.success;
    if (punchType === 'PUNCH_OUT') return colors.danger;
    return colors.primary;
  };

  const getMarkerIcon = (punchType) => {
    if (punchType === 'PUNCH_IN') return 'log-in';
    if (punchType === 'PUNCH_OUT') return 'log-out';
    return 'map-pin';
  };

  const initialRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : coordinates[0]
    ? {
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 23.0225,
        longitude: 72.5714,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };

  const handleMarkerPress = (punch) => {
    Alert.alert(
      `${punch.visit_type || punch.punch_type} - ${new Date(punch.punched_at).toLocaleTimeString()}`,
      punch.current_address || 'No address available',
      [
        { text: 'Navigate', onPress: () => openInGoogleMaps(punch.latitude, punch.longitude) },
        { text: 'Directions', onPress: () => getDirections(punch.latitude, punch.longitude) },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        onMapReady={() => setMapReady(true)}
      >
        {coordinates.map((c, i) => (
          <Marker
            key={`punch-${i}`}
            coordinate={c}
            onPress={() => handleMarkerPress(punches[i])}
          >
            <View style={[styles.markerContainer, { backgroundColor: getMarkerColor(punches[i]?.punch_type) }]}>
              <Icon
                name={getMarkerIcon(punches[i]?.punch_type)}
                size={16}
                color="#FFFFFF"
              />
            </View>
          </Marker>
        ))}

        {coordinates.length > 1 && (
          <Polyline
            coordinates={coordinates}
            strokeWidth={4}
            strokeColor={colors.primary}
            lineDashPattern={[1]}
          />
        )}

        {isActive && trackingCoords.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={3}
            strokeColor={colors.success}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Today's Route</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Icon name="map-pin" size={18} color={colors.primary} />
          <Text style={styles.statValue}>{punches.length}</Text>
          <Text style={styles.statLabel}>Stops</Text>
        </View>
        {isActive && (
          <View style={styles.statItem}>
            <Icon name="activity" size={18} color={colors.success} />
            <Text style={styles.statValue}>{trackingCoords.length}</Text>
            <Text style={styles.statLabel}>Tracking</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={centerOnUser}>
          <Icon name="crosshair" size={24} color={colors.primary} />
          <Text style={styles.actionText}>Center</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('FullRoute')}
        >
          <Icon name="maximize-2" size={24} color={colors.primary} />
          <Text style={styles.actionText}>Full Route</Text>
        </TouchableOpacity>

        {userLocation && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openInGoogleMaps(userLocation.latitude, userLocation.longitude)}
          >
            <Icon name="navigation" size={24} color={colors.primary} />
            <Text style={styles.actionText}>Navigate</Text>
          </TouchableOpacity>
        )}
      </View>

      {userLocation && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => getDirections(userLocation.latitude, userLocation.longitude)}
        >
          <Icon name="navigation" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
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
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textDark,
  },
  placeholder: {
    width: 40,
  },
  statsBar: {
    position: 'absolute',
    top: 110,
    left: spacing.md,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  statValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textDark,
    marginLeft: spacing.xs,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginLeft: spacing.xxs,
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionBtn: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  actionText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

export default MapViewScreen;
