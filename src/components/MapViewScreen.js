import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const MapViewScreen = () => {
    const auth = useAuth();
    const token = auth?.accessToken;
    const [punches, setPunches] = useState([]);

    const fetchPunches = async () => {
        try {
            const res = await api.get(
                '/attendance/punches/today_punches/',
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const sorted = (res.data?.results || res.data || [])
                .filter(p => p.latitude && p.longitude)
                .sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at));

            setPunches(sorted);

        } catch (err) {
            console.log(err);
        }
    };

    useEffect(() => {
        fetchPunches();
    }, []);

    const coordinates = punches.map(p => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
    }));

    return (
        <View style={{ flex: 1 }}>
            <MapView
                style={{ flex: 1 }}
                initialRegion={{
                    latitude: coordinates[0]?.latitude || 23.0225,
                    longitude: coordinates[0]?.longitude || 72.5714,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >

                {/* START */}
                {coordinates[0] && (
                    <Marker coordinate={coordinates[0]} title="Start" pinColor="green" />
                )}

                {/* END */}
                {coordinates.length > 1 && (
                    <Marker
                        coordinate={coordinates[coordinates.length - 1]}
                        title="Latest"
                        pinColor="red"
                    />
                )}

                {/* ALL POINTS */}
                {coordinates.map((c, i) => (
                    <Marker key={i} coordinate={c} />
                ))}

                {/* ROUTE */}
                <Polyline
                    coordinates={coordinates}
                    strokeWidth={4}
                    strokeColor="blue"
                />

            </MapView>
        </View>
    );
};

export default MapViewScreen;