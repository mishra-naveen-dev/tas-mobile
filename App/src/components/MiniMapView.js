import React, { useMemo } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

const getRandomColor = () => {
    const colors = ['red', 'blue', 'green', 'orange', 'purple'];
    return colors[Math.floor(Math.random() * colors.length)];
};

const MiniMapView = ({ punches = [] }) => {

    // ✅ filter + sort
    const sortedPunches = useMemo(() => {
        return punches
            .filter(p => p.latitude && p.longitude)
            .sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at));
    }, [punches]);

    // ✅ coordinates
    const coordinates = sortedPunches.map(p => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
    }));

    // ✅ assign colors (same location = same key)
    const locationColorMap = {};
    const coloredMarkers = sortedPunches.map((p) => {
        const key = `${p.latitude}_${p.longitude}`;

        if (!locationColorMap[key]) {
            locationColorMap[key] = getRandomColor();
        }

        return {
            ...p,
            color: locationColorMap[key],
        };
    });

    return (
        <View style={{ height: 200, borderRadius: 10, overflow: 'hidden' }}>
            <MapView
                style={{ flex: 1 }}
                initialRegion={{
                    latitude: coordinates[0]?.latitude || 23.0225,
                    longitude: coordinates[0]?.longitude || 72.5714,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >

                {/* ROUTE */}
                <Polyline
                    coordinates={coordinates}
                    strokeWidth={3}
                    strokeColor="blue"
                />

                {/* MARKERS */}
                {coloredMarkers.map((p, i) => (
                    <Marker
                        key={i}
                        coordinate={{
                            latitude: Number(p.latitude),
                            longitude: Number(p.longitude),
                        }}
                        pinColor={p.color}
                    />
                ))}

            </MapView>
        </View>
    );
};

export default MiniMapView;